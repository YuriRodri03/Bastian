// src/components/BarraComandoIA.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare, Mic, Users, RefreshCw } from 'lucide-react';

import { GeminiLiveConnection } from '../services/liveAiService';
import { GerenciadorDeAudio } from '../services/audioManager';

import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore';
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useFitnessStore } from '../store/useFitnessStore';
import { useChatStore } from '../store/useChatStore';
import { buscarNaWebComGemini } from '../services/webSearchService';

import {
  CATEGORIAS_RECEITA,
  CATEGORIAS_DESPESA,
  CATEGORIA_APORTE,
  CATEGORIA_RENDIMENTO,
  CATEGORIA_RESGATE,
  normalizeDateISO,
  parseFaturaDescription,
  serializeFaturaDescription
} from '../utils/financeUtils';

/* ================================================================== */
/* Constantes e helpers                                                */
/* ================================================================== */

const PROCESSING_TIMEOUT_MS = 25000; // se a IA não responder, volta a ouvir
const RESERVA_MINIMA = 300; // colchão mantido na sugestão de reserva
const MUTACOES = new Set(['registrar_dado', 'alterar_dado', 'gerenciar_ficha_treino']);

const getLocalTodayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Sem acento, minúsculo: "Finanças" == "financas"
const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Aceita 20, "20.5", "R$ 1.234,56"; devolve 0 se não der para entender
const parseValor = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[^\d,.-]/g, '');
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : 0;
};

// A IA pode mandar "amanhã" ou "31/12": só deixa passar o que vira AAAA-MM-DD
const normalizarData = (valor, fallback) => {
  if (!valor) return fallback;
  const iso = normalizeDateISO(String(valor));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(new Date(`${iso}T00:00:00`).getTime())) {
    throw new Error(`Data inválida "${valor}". Use o formato AAAA-MM-DD.`);
  }
  return iso;
};

// Remove marcações de markdown sem destruir hífens e underscores do texto ("guarda-roupa")
const limparMarkdown = (texto) => {
  if (!texto) return '';
  return texto
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/^\s*[#>]+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*/g, '')
    .trim();
};

const textoFinanca = (t) => parseFaturaDescription(t.description, t.category).mainTitle;
const textoTitulo = (i) => i.title || '';

// Encontra UM registro por id ou nome. Nunca "chuta": se não achar ou houver ambiguidade,
// lança erro para a IA perguntar ao usuário (antes, apagava/alterava o primeiro que contivesse o texto).
const resolverRegistro = (lista, idOuTexto, getTexto, rotulo = 'registro') => {
  if (idOuTexto === undefined || idOuTexto === null || norm(idOuTexto) === '') {
    throw new Error(`Informe qual ${rotulo}.`);
  }
  const porId = lista.find((i) => String(i.id) === String(idOuTexto));
  if (porId) return porId;

  const alvo = norm(idOuTexto);
  const exatos = lista.filter((i) => norm(getTexto(i)) === alvo);
  if (exatos.length === 1) return exatos[0];

  const candidatos = exatos.length > 1 ? exatos : lista.filter((i) => norm(getTexto(i)).includes(alvo));
  if (candidatos.length === 1) return candidatos[0];
  if (candidatos.length === 0) throw new Error(`Nenhum ${rotulo} encontrado para "${idOuTexto}".`);

  const opcoes = candidatos.slice(0, 5).map((i) => `${getTexto(i)} (id ${i.id})`).join('; ');
  throw new Error(`Encontrei ${candidatos.length} ${rotulo}s parecidos: ${opcoes}. Peça ao Yuri para especificar e use o id.`);
};

// Garante categoria válida e o tipo certo (aporte é despesa; rendimento e resgate são receita)
const TIPO_FIXO = {
  [CATEGORIA_APORTE]: 'despesa',
  [CATEGORIA_RENDIMENTO]: 'receita',
  [CATEGORIA_RESGATE]: 'receita'
};
const resolverCategoriaFinanceira = (categoria, tipo) => {
  const lista = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const alvo = norm(categoria);
  const achada = [...CATEGORIAS_RECEITA, ...CATEGORIAS_DESPESA].find((c) => norm(c) === alvo);
  if (achada && TIPO_FIXO[achada]) return { category: achada, type: TIPO_FIXO[achada] };
  if (achada && lista.includes(achada)) return { category: achada, type: tipo };
  return { category: 'Outros', type: tipo };
};

// Ações irreversíveis em massa exigem repetir o comando em até 60s (a IA pergunta ao usuário entre as duas)
const confirmacoesPendentes = new Map();
const confirmarAcaoDestrutiva = (chave) => {
  const agora = Date.now();
  const expira = confirmacoesPendentes.get(chave);
  if (expira && expira > agora) {
    confirmacoesPendentes.delete(chave);
    return true;
  }
  confirmacoesPendentes.set(chave, agora + 60000);
  return false;
};

const vazio = (v) => !v || v.length === 0;

/* ================================================================== */
/* Pesquisa na internet (APIs públicas, em paralelo e com timeout)     */
/* ================================================================== */

const fetchJson = async (url, ms = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const buscarCambio = async () => {
  const d = await fetchJson('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
  if (!d) return null;
  const usd = Number(d.USDBRL?.bid || 0).toFixed(2);
  const variacao = d.USDBRL?.pctChange !== undefined ? ` (variação de ${d.USDBRL.pctChange}% hoje)` : '';
  const eur = Number(d.EURBRL?.bid || 0).toFixed(2);
  const btc = Number(d.BTCBRL?.bid || 0).toLocaleString('pt-BR');
  return {
    texto: `Cotações comerciais agora: Dólar (USD) a R$ ${usd}${variacao}, Euro (EUR) a R$ ${eur} e Bitcoin (BTC) a R$ ${btc}.`,
    fonte: 'AwesomeAPI Câmbio'
  };
};

const buscarSelic = async () => {
  const s = await fetchJson('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json');
  if (!s?.[0]?.valor) return null;
  return {
    texto: `Taxa Selic Meta atual (Banco Central): ${s[0].valor}% ao ano (data base: ${s[0].data}).`,
    fonte: 'Banco Central do Brasil'
  };
};

const buscarClima = async () => {
  const c = await fetchJson(
    'https://api.open-meteo.com/v1/forecast?latitude=-3.7172&longitude=-38.5433&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FFortaleza&forecast_days=1'
  );
  if (!c) return null;
  const probChuva = c.daily?.precipitation_probability_max?.[0] ?? 0;
  return {
    texto: `Clima agora em Fortaleza: ${c.current?.temperature_2m}°C (sensação térmica de ${c.current?.apparent_temperature}°C, umidade em ${c.current?.relative_humidity_2m}%). Para hoje: máxima de ${c.daily?.temperature_2m_max?.[0]}°C, mínima de ${c.daily?.temperature_2m_min?.[0]}°C e probabilidade de chuva de ${probChuva}%.`,
    fonte: 'Open-Meteo Fortaleza'
  };
};

const buscarNoticias = async (termo) => {
  const queryLimpa = termo
    .replace(/(quais as|me dê|me da|not[ií]cias sobre|not[ií]cias de|hoje|agora|pesquise)/gi, '')
    .trim();
  const rssUrl =
    queryLimpa.length > 2
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(queryLimpa)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
      : 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419';

  const data = await fetchJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`, 4000);
  const manchetes = (data?.items || []).slice(0, 4).map((item, i) => `${i + 1}. ${item.title}`).join(' | ');
  return manchetes ? { texto: `Principais manchetes recentes no Google Notícias: ${manchetes}`, fonte: 'Google News BR' } : null;
};

const buscarWikipedia = async (consulta) => {
  const data = await fetchJson(
    `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(consulta)}&utf8=&format=json&origin=*`
  );
  const snippets = (data?.query?.search || [])
    .slice(0, 2)
    .map((item) => {
      const limpo = item.snippet
        .replace(/<[^>]*>?/gm, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#0?39;/g, "'");
      return `${item.title}: ${limpo}`;
    })
    .join(' | ');
  return snippets ? { texto: `Dados de referência: ${snippets}`, fonte: 'Wikipedia PT' } : null;
};

const buscarNaWeb = async (consulta) => {
  if (!consulta) return { status: 'erro', mensagem: 'Consulta vazia.' };

  const termo = consulta.toLowerCase().trim();
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const querCambio = /(d[oó]lar|euro|bitcoin|btc|moeda|cota[cç][aã]o|c[aâ]mbio|libra)/i.test(termo);
  const querSelic = /(selic|juros|ipca|infla[cç][aã]o|cdi|copom|taxa)/i.test(termo);
  const querClima = /(clima|tempo|chuva|chover|temperatura|graus|calor|previs[aã]o)/i.test(termo);
  const especifica = querCambio || querSelic || querClima;
  const querNoticias =
    /(not[ií]cia|manchete|jornal|acontecendo|novidade|atualidade|mundo|pol[ií]tica|economia|esporte|jogo)/i.test(termo) || !especifica;

  // Wikipedia só entra quando a pergunta não é cotação/juros/clima (antes poluía todas as respostas)
  const tarefas = [];
  if (querCambio) tarefas.push(buscarCambio());
  if (querSelic) tarefas.push(buscarSelic());
  if (querClima) tarefas.push(buscarClima());
  if (querNoticias) tarefas.push(buscarNoticias(termo));
  if (!especifica) tarefas.push(buscarWikipedia(consulta));

  const encontrados = (await Promise.all(tarefas)).filter(Boolean);

  if (encontrados.length === 0) {
    return {
      status: 'sem_resultados',
      data_consulta: dataHoje,
      mensagem: 'Nenhuma das fontes consultadas retornou dados para este termo. Diga ao Yuri que não conseguiu confirmar.',
      fontes_consultadas: []
    };
  }
  return {
    status: 'sucesso',
    data_consulta: dataHoje,
    resultado_atualizado: encontrados.map((r) => r.texto).join(' \n '),
    fontes_consultadas: encontrados.map((r) => r.fonte)
  };
};

/* ================================================================== */
/* Relatório executivo (mesmas regras de saldo/receita da tela)        */
/* ================================================================== */

const gerarRelatorioExecutivo = () => {
  const dataHoje = getLocalTodayISO();
  const mesAtualPrefix = dataHoje.substring(0, 7);
  const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const { transactions, balance, investedBalance, error: erroFinanceiro } = useFinanceStore.getState();
  const { agendaItems } = useAgendaStore.getState();
  const { inboxTasks } = useInboxStore.getState();
  const { tasks: kanbanTasks } = useKanbanStore.getState();
  const { healthLogs, fichasTreino } = useFitnessStore.getState();

  let receitasPagasMes = 0;
  let rendimentosMes = 0;
  let despesasOperacionaisPagasMes = 0;
  let contasAPagarMes = 0;
  let contasAReceberMes = 0;
  let aportesMes = 0;
  const gastosPorCategoria = {};

  transactions.forEach((t) => {
    const tDate = t.date ? normalizeDateISO(t.date) : '';
    if (!tDate.startsWith(mesAtualPrefix)) return;

    const val = Number(t.amount) || 0;
    const isPago = (t.status || 'pago') === 'pago';

    if (t.type === 'receita') {
      if (isPago) {
        if (t.category === CATEGORIA_RENDIMENTO) rendimentosMes += val; // vai direto à carteira, não é receita
        else if (t.category !== CATEGORIA_RESGATE) receitasPagasMes += val;
      } else if (t.category !== CATEGORIA_RENDIMENTO) {
        contasAReceberMes += val; // rendimento pendente não passa pela conta
      }
    } else if (t.type === 'despesa') {
      if (isPago) {
        if (t.category === CATEGORIA_APORTE) {
          aportesMes += val;
        } else {
          despesasOperacionaisPagasMes += val;
          gastosPorCategoria[t.category] = (gastosPorCategoria[t.category] || 0) + val;
        }
      } else {
        contasAPagarMes += val;
      }
    }
  });

  const balancoLiquidoMes = receitasPagasMes - despesasOperacionaisPagasMes;
  const saldoProjetadoFimDoMes = balance + contasAReceberMes - contasAPagarMes;
  const margemParaReserva = Math.max(0, saldoProjetadoFimDoMes - RESERVA_MINIMA);
  const r2 = (n) => Number((Number(n) || 0).toFixed(2));

  // Pendências mais próximas primeiro (antes saíam as de 60 meses à frente, por causa da ordem decrescente)
  const pendentes = transactions
    .filter((t) => (t.status || 'pago') === 'pendente')
    .map((t) => ({ t, data: t.date ? normalizeDateISO(t.date) : '' }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const contasPendentesLista = pendentes.slice(0, 12).map(({ t, data }) => ({
    id: t.id,
    descricao: textoFinanca(t),
    valor: t.amount,
    vencimento: t.date,
    atrasada: !!data && data < dataHoje,
    tipo: t.type
  }));

  const compromissosProximos = agendaItems
    .filter((e) => !e.is_completed && (e.date || '') >= dataHoje)
    .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`))
    .slice(0, 15)
    .map((e) => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, categoria: e.category }));

  const tarefasPendentes = inboxTasks
    .filter((t) => !t.completed)
    .slice(0, 15)
    .map((t) => ({ id: t.id, titulo: t.title, data: t.date }));

  const projetosKanban = kanbanTasks.slice(0, 12).map((k) => ({ id: k.id, titulo: k.title, coluna: k.status }));

  // Assume healthLogs do mais recente para o mais antigo
  const logs = healthLogs || [];
  const ultimoPesoObj = logs.find((l) => l.type === 'peso');
  const ultimasMedidas = {};
  logs.filter((l) => l.type === 'medida').forEach((m) => {
    if (!ultimasMedidas[m.title]) ultimasMedidas[m.title] = `${m.value}${m.unit || 'cm'}`;
  });

  return {
    data_hoje: dataHoje,
    hora_atual: horaAtual,
    ...(erroFinanceiro && {
      aviso_dados: 'Falha ao carregar os lançamentos financeiros: os valores abaixo podem estar incompletos. Não os trate como definitivos.'
    }),
    resumo_financeiro: {
      saldo_atual_em_conta: r2(balance),
      total_investido_na_carteira: r2(investedBalance),
      receitas_pagas_no_mes: r2(receitasPagasMes),
      rendimentos_diretos_na_carteira_no_mes: r2(rendimentosMes),
      despesas_operacionais_pagas_no_mes: r2(despesasOperacionaisPagasMes),
      aportes_investidos_no_mes: r2(aportesMes),
      balanco_operacional_do_mes: r2(balancoLiquidoMes),
      contas_pendentes_a_pagar_no_mes: r2(contasAPagarMes),
      contas_a_receber_no_mes: r2(contasAReceberMes),
      saldo_projetado_apos_pagar_pendencias: r2(saldoProjetadoFimDoMes),
      sugestao_segura_para_guardar_na_reserva_agora: r2(margemParaReserva),
      gastos_por_categoria_no_mes: gastosPorCategoria,
      total_pendencias: pendentes.length,
      contas_pendentes_detalhadas: contasPendentesLista
    },
    produtividade: {
      compromissos_agenda: compromissosProximos,
      tarefas_inbox_pendentes: tarefasPendentes,
      quadro_kanban: projetosKanban
    },
    saude_fitness: {
      fichas_de_treino_atuais: fichasTreino,
      total_treinos_concluidos: logs.filter((l) => l.type === 'treino').length,
      ultimo_peso_kg: ultimoPesoObj ? ultimoPesoObj.value : null,
      medidas_corporais_atuais: ultimasMedidas,
      ultimos_registros_sono: logs.filter((l) => l.type === 'sono').slice(0, 5),
      ultimos_registros_humor: logs.filter((l) => l.type === 'humor').slice(0, 5)
    }
  };
};

const hidratarStoresSeNecessario = async () => {
  const promises = [];
  if (vazio(useFinanceStore.getState().transactions)) promises.push(useFinanceStore.getState().fetchTransactions());
  if (vazio(useAgendaStore.getState().agendaItems)) promises.push(useAgendaStore.getState().fetchAgendaItems());
  if (vazio(useInboxStore.getState().inboxTasks)) promises.push(useInboxStore.getState().fetchInboxTasks());
  if (vazio(useKanbanStore.getState().tasks)) promises.push(useKanbanStore.getState().fetchKanbanTasks());
  if (vazio(useFitnessStore.getState().healthLogs)) promises.push(useFitnessStore.getState().fetchHealthLogs?.());
  if (promises.length > 0) await Promise.allSettled(promises);
};

/* ================================================================== */
/* Ferramentas da IA: cada uma DEVOLVE um resultado (nunca fica sem    */
/* resposta, senão a conversa ao vivo fica esperando)                  */
/* ================================================================== */

const GRUPOS = {
  inbox: ['inbox', 'tarefa'],
  agenda: ['agenda', 'evento', 'compromisso'],
  financas: ['financas', 'financa', 'transacao', 'despesa', 'receita', 'gasto'],
  kanban: ['kanban', 'projeto'],
  ficha: ['ficha_treino', 'ficha', 'treino'],
  saude: ['peso', 'medida', 'sono', 'humor', 'saude']
};
const grupoDe = (entidade) => Object.keys(GRUPOS).find((g) => GRUPOS[g].includes(norm(entidade)));

const gerenciarFichaTreino = (args, { exibirMensagem }) => {
  const fitness = useFitnessStore.getState();
  const acao = norm(args.acao || 'criar');
  const titulo = String(args.titulo || 'Nova Ficha de Treino').trim();
  const exercicios = Array.isArray(args.exercicios) ? args.exercicios : [];

  switch (acao) {
    case 'criar': {
      const ficha = fitness.addFichaTreino(titulo, exercicios);
      exibirMensagem(`💪 Ficha criada: ${ficha.title} (${ficha.exercicios.length} exercícios)`);
      return { status: 'sucesso', acao: 'ficha_criada_na_aba_treinos', ficha };
    }
    case 'substituir_todas': {
      if (!confirmarAcaoDestrutiva('substituir_todas')) {
        return {
          status: 'confirmacao_necessaria',
          mensagem: 'Isto apaga TODAS as fichas de treino atuais. Pergunte ao Yuri se confirma e, somente se ele confirmar, repita exatamente a mesma chamada.'
        };
      }
      fitness.setFichasTreino([]);
      const ficha = fitness.addFichaTreino(titulo, exercicios);
      exibirMensagem(`🔥 Base de fichas recriada: ${ficha.title}`);
      return { status: 'sucesso', acao: 'base_substituida_e_ficha_criada', ficha };
    }
    case 'atualizar': {
      let ficha = fitness.updateFichaTreino(titulo, {
        title: titulo,
        exercicios: exercicios.length > 0 ? exercicios : undefined
      });
      if (!ficha) ficha = fitness.addFichaTreino(titulo, exercicios);
      exibirMensagem(`💪 Ficha atualizada: ${ficha.title}`);
      return { status: 'sucesso', ficha };
    }
    case 'deletar': {
      if (!fitness.deleteFichaTreino(titulo)) throw new Error(`Ficha "${titulo}" não encontrada.`);
      exibirMensagem(`🗑️ Ficha removida: ${titulo}`);
      return { status: 'sucesso', ficha_deletada: titulo };
    }
    default:
      throw new Error(`Ação de ficha desconhecida: "${args.acao}".`);
  }
};

const registrarDado = async (args, { exibirMensagem }) => {
  const entidade = norm(args.entidade);
  const dados = args.dados || args;
  const dataHoje = getLocalTodayISO();

  const tituloFinal =
    String([dados.titulo, dados.title, dados.descricao, dados.description, dados.modalidade, dados.nome]
      .find((v) => v && String(v).trim()) ?? 'Novo Registro').trim();
  const valor = parseValor(dados.valor ?? dados.amount ?? dados.peso ?? dados.duracao);
  const data = normalizarData(dados.data || dados.date, dataHoje);
  const hora = dados.hora || dados.time || null;
  const categoria = dados.categoria || dados.category || null;
  const statusFinal = norm(dados.status);

  // Lista de exercícios ou entidade de ficha: vira Ficha de Treino (e não tarefa do Inbox)
  if (['ficha_treino', 'ficha'].includes(entidade) || (Array.isArray(dados.exercicios) && dados.exercicios.length > 0)) {
    const ficha = useFitnessStore.getState().addFichaTreino(tituloFinal, dados.exercicios || []);
    exibirMensagem(`💪 Ficha criada: ${ficha.title}`);
    return { status: 'sucesso', entidade: 'ficha_treino', ficha_criada: ficha };
  }

  switch (entidade) {
    case 'agenda':
    case 'evento':
    case 'compromisso': {
      const registro = await useAgendaStore.getState().addAgendaItem({
        title: tituloFinal, date: data, time: hora, category: categoria || 'evento'
      });
      exibirMensagem(`📅 Agenda: ${tituloFinal} (${data})`);
      return { status: 'sucesso', entidade: 'agenda', registro_criado: registro };
    }

    case 'inbox':
    case 'tarefa': {
      const registro = await useInboxStore.getState().addInboxTask(tituloFinal, data);
      exibirMensagem(`📥 Tarefa: ${tituloFinal}`);
      return { status: 'sucesso', entidade: 'inbox', registro_criado: registro };
    }

    case 'kanban':
    case 'projeto': {
      const coluna = ['backlog', 'in-progress', 'done'].includes(statusFinal) ? statusFinal : 'backlog';
      const registro = await useKanbanStore.getState().addTask(tituloFinal, coluna);
      exibirMensagem(`📋 Kanban: ${tituloFinal}`);
      return { status: 'sucesso', entidade: 'kanban', registro_criado: registro };
    }

    case 'despesa':
    case 'gasto':
    case 'receita':
    case 'ganho': {
      const tipoPedido = ['despesa', 'gasto'].includes(entidade) ? 'despesa' : 'receita';
      // Antes, um valor não entendido virava lançamento de R$ 0,00
      if (valor <= 0) throw new Error('Valor inválido: informe um valor maior que zero.');

      const { category, type } = resolverCategoriaFinanceira(categoria, tipoPedido);
      const registro = await useFinanceStore.getState().addTransaction({
        amount: valor,
        description: tituloFinal,
        type,
        category,
        date: data,
        status: statusFinal === 'pendente' ? 'pendente' : 'pago'
      });
      exibirMensagem(`${type === 'despesa' ? '💸 Despesa' : '📈 Receita'}: ${tituloFinal} (R$ ${valor.toFixed(2)})`);
      return {
        status: 'sucesso',
        entidade: type,
        categoria_usada: category,
        registro_criado: registro,
        novo_saldo: useFinanceStore.getState().balance
      };
    }

    case 'peso': {
      if (valor <= 0) throw new Error('Peso inválido.');
      await useFitnessStore.getState().addHealthLog('peso', 'Peso', valor, 'kg');
      exibirMensagem(`⚖️ Peso registrado: ${valor} kg`);
      return { status: 'sucesso', valor_kg: valor };
    }

    case 'treino':
    case 'treino_concluido': {
      const duracao = valor > 0 ? valor : 50;
      await useFitnessStore.getState().concluirFichaTreino(tituloFinal, duracao);
      exibirMensagem(`🏋️ Treino concluído: ${tituloFinal} (${duracao} min)`);
      return { status: 'sucesso', treino: tituloFinal };
    }

    case 'medida': {
      if (valor <= 0) throw new Error('Medida inválida.');
      await useFitnessStore.getState().addHealthLog('medida', tituloFinal, valor, 'cm');
      exibirMensagem(`📏 Medida (${tituloFinal}): ${valor} cm`);
      return { status: 'sucesso', medida: tituloFinal, valor_cm: valor };
    }

    case 'sono': {
      const horas = valor > 0 ? valor : 7.5;
      await useFitnessStore.getState().addHealthLog('sono', `Sono: ${tituloFinal}`, horas, 'h');
      exibirMensagem(`🌙 Sono registrado: ${horas}h (${tituloFinal})`);
      return { status: 'sucesso', horas_dormidas: horas };
    }

    case 'humor':
    case 'mente': {
      const nota = valor >= 1 && valor <= 5 ? valor : 4;
      await useFitnessStore.getState().addHealthLog('humor', `Humor: ${tituloFinal}`, nota, '/5');
      exibirMensagem(`🧠 Check-in Mental: ${nota}/5 (${tituloFinal})`);
      return { status: 'sucesso', nota };
    }

    default: {
      const registro = await useInboxStore.getState().addInboxTask(tituloFinal, data);
      exibirMensagem(`📥 Inbox: ${tituloFinal}`);
      return {
        status: 'sucesso',
        observacao: `Entidade "${args.entidade}" não reconhecida: salvo como tarefa no Inbox.`,
        registro_criado: registro
      };
    }
  }
};

const alterarDado = async (args, { exibirMensagem }) => {
  const acaoBruta = norm(args.acao);
  const acao = acaoBruta === 'excluir' ? 'deletar' : acaoBruta;
  const grupo = grupoDe(args.entidade);
  const rawId = args.id;
  const novos = args.dados || {};

  if (!grupo) throw new Error(`Entidade desconhecida: "${args.entidade}".`);

  const stores = {
    inbox: () => ({ lista: useInboxStore.getState().inboxTasks, texto: textoTitulo, rotulo: 'tarefa' }),
    agenda: () => ({ lista: useAgendaStore.getState().agendaItems, texto: textoTitulo, rotulo: 'compromisso' }),
    financas: () => ({ lista: useFinanceStore.getState().transactions, texto: textoFinanca, rotulo: 'lançamento' }),
    kanban: () => ({ lista: useKanbanStore.getState().tasks, texto: textoTitulo, rotulo: 'cartão' }),
    saude: () => ({ lista: useFitnessStore.getState().healthLogs || [], texto: textoTitulo, rotulo: 'registro de saúde' })
  };
  const achar = () => {
    const { lista, texto, rotulo } = stores[grupo]();
    return resolverRegistro(lista, rawId, texto, rotulo);
  };

  /* ----------------------------- concluir ----------------------------- */
  if (acao === 'concluir') {
    switch (grupo) {
      case 'ficha': {
        const duracao = parseValor(novos.valor) || 50;
        await useFitnessStore.getState().concluirFichaTreino(rawId, duracao);
        exibirMensagem(`🏋️ Ficha concluída: ${rawId}`);
        break;
      }
      case 'inbox': {
        await useInboxStore.getState().toggleInboxTask(achar().id, false);
        exibirMensagem('✅ Tarefa concluída!');
        break;
      }
      case 'agenda': {
        await useAgendaStore.getState().toggleItemCompletion(achar().id, false);
        exibirMensagem('✅ Compromisso concluído!');
        break;
      }
      case 'financas': {
        const t = achar();
        // toggle puro reabriria uma conta que já estava paga
        if ((t.status || 'pago') === 'pago') {
          return { status: 'sucesso', acao: 'ja_estava_paga', registro: textoFinanca(t) };
        }
        await useFinanceStore.getState().toggleTransactionStatus(t.id);
        exibirMensagem('✅ Conta marcada como paga!');
        break;
      }
      case 'kanban': {
        await useKanbanStore.getState().moveTask(achar().id, 'done');
        exibirMensagem('✅ Projeto movido para Concluído!');
        break;
      }
      default:
        throw new Error(`Não é possível concluir "${args.entidade}".`);
    }
    return { status: 'sucesso', acao: 'concluido' };
  }

  /* ----------------------------- deletar ------------------------------ */
  if (acao === 'deletar') {
    let removido = String(rawId);
    switch (grupo) {
      case 'ficha':
        if (!useFitnessStore.getState().deleteFichaTreino(rawId)) throw new Error(`Ficha "${rawId}" não encontrada.`);
        break;
      case 'financas': {
        const t = achar();
        removido = textoFinanca(t);
        await useFinanceStore.getState().deleteTransaction(t.id);
        break;
      }
      case 'agenda': {
        const item = achar();
        removido = item.title;
        await useAgendaStore.getState().deleteAgendaItem(item.id);
        break;
      }
      case 'inbox': {
        const item = achar();
        removido = item.title;
        await useInboxStore.getState().deleteInboxTask(item.id);
        break;
      }
      case 'kanban': {
        const item = achar();
        removido = item.title;
        await useKanbanStore.getState().deleteTask(item.id);
        break;
      }
      case 'saude': {
        const item = achar();
        removido = item.title;
        await useFitnessStore.getState().deleteHealthLog(item.id);
        break;
      }
      default:
        throw new Error(`Não é possível excluir "${args.entidade}".`);
    }
    exibirMensagem(`🗑️ Removido: ${removido}`);
    return { status: 'sucesso', acao: 'deletado', removido };
  }

  /* ----------------------------- atualizar ---------------------------- */
  if (acao === 'atualizar') {
    const novoTitulo = novos.titulo || novos.title || novos.descricao;
    const novaData = novos.data || novos.date;
    const novaHora = novos.hora || novos.time;

    switch (grupo) {
      case 'ficha': {
        const ficha = useFitnessStore.getState().updateFichaTreino(rawId, {
          title: novoTitulo || rawId,
          exercicios: novos.exercicios
        });
        if (!ficha) throw new Error(`Ficha "${rawId}" não encontrada.`);
        exibirMensagem(`💪 Ficha atualizada: ${ficha.title}`);
        break;
      }
      case 'inbox': {
        const updates = {};
        if (novoTitulo) updates.title = novoTitulo;
        if (novaData) updates.date = normalizarData(novaData);
        await useInboxStore.getState().updateInboxTask(achar().id, updates);
        exibirMensagem('✏️ Tarefa atualizada!');
        break;
      }
      case 'agenda': {
        const updates = {};
        if (novoTitulo) updates.title = novoTitulo;
        if (novaData) updates.date = normalizarData(novaData);
        if (novaHora) updates.time = novaHora;
        await useAgendaStore.getState().updateAgendaItem(achar().id, updates);
        exibirMensagem('✏️ Compromisso atualizado!');
        break;
      }
      case 'financas': {
        const original = achar();
        const { mainTitle, items } = parseFaturaDescription(original.description, original.category);

        let { category, type } = original;
        if (novos.categoria) ({ category, type } = resolverCategoriaFinanceira(novos.categoria, original.type));

        let amount = Number(original.amount);
        if (novos.valor !== undefined) {
          amount = parseValor(novos.valor);
          if (amount <= 0) throw new Error('Valor inválido: informe um valor maior que zero.');
        }

        const statusNovo = norm(novos.status);
        await useFinanceStore.getState().updateTransaction({
          ...original,
          // serializa de novo para NÃO apagar os itens de uma fatura ao trocar só o título
          description: serializeFaturaDescription(novoTitulo ? String(novoTitulo).trim() : mainTitle, category, items),
          amount,
          type,
          category,
          date: novaData ? normalizarData(novaData, original.date) : original.date,
          status: ['pago', 'pendente'].includes(statusNovo) ? statusNovo : original.status
        });
        exibirMensagem('✏️ Transação atualizada!');
        break;
      }
      case 'kanban': {
        const card = achar();
        if (novos.status) await useKanbanStore.getState().moveTask(card.id, novos.status);
        if (novoTitulo) await useKanbanStore.getState().updateTask(card.id, { title: novoTitulo });
        exibirMensagem('🔄 Cartão Kanban atualizado.');
        break;
      }
      default:
        throw new Error(`Não é possível atualizar "${args.entidade}".`);
    }
    return { status: 'sucesso', acao: 'atualizado' };
  }

  throw new Error(`Ação desconhecida: "${args.acao}". Use concluir, deletar ou atualizar.`);
};

const consultarDados = (args, { exibirMensagem }) => {
  const relatorio = gerarRelatorioExecutivo();
  exibirMensagem(`📊 Consultando base (${args.entidade || 'geral'})...`);

  const grupo = grupoDe(args.entidade);
  let recorte = relatorio;
  if (grupo === 'financas') recorte = relatorio.resumo_financeiro;
  else if (grupo === 'ficha' || grupo === 'saude') recorte = relatorio.saude_fitness;
  else if (['agenda', 'inbox', 'kanban'].includes(grupo)) recorte = relatorio.produtividade;

  return relatorio.aviso_dados ? { aviso_dados: relatorio.aviso_dados, ...recorte } : recorte;
};

const executarFerramenta = async (name, args, ctx) => {
  switch (name) {
    case 'pesquisar_internet': {
      const consulta = String(args.consulta || args.query || '').trim();
      ctx.exibirMensagem(`🌐 Pesquisando na web: "${consulta}"...`);
      // Primeiro o Google Search (Edge Function); se der limite de uso, erro ou resposta sem fontes, cai nas APIs públicas
      const profundidade = args.profundidade === 'rapida' ? 'rapida' : 'detalhada';
      let resultado = await buscarNaWebComGemini(consulta, profundidade);
      if (resultado.status !== 'sucesso') resultado = await buscarNaWeb(consulta);
      if (resultado.fontes_consultadas?.length) ctx.exibirMensagem(`🌐 Fonte: ${resultado.fontes_consultadas[0]}`);
      return resultado;
    }
    case 'gerenciar_ficha_treino':
      return gerenciarFichaTreino(args, ctx);
    case 'registrar_dado':
      return registrarDado(args, ctx);
    case 'alterar_dado':
      return alterarDado(args, ctx);
    case 'consultar_dados':
      return consultarDados(args, ctx);
    default:
      return { status: 'erro', mensagem: `Ferramenta desconhecida: ${name}` };
  }
};

/* ================================================================== */
/* Componente                                                          */
/* ================================================================== */

export default function BarraComandoIA() {
  const [aiState, setAiState] = useState('idle');
  const aiStateRef = useRef('idle');

  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [ultimaMensagem, setUltimaMensagem] = useState(null);

  // Locutor identificado pela biometria vocal: { locutor: 'Yuri' | 'Visitante', confianca, pitchHz }
  const [speakerInfo, setSpeakerInfo] = useState(null);

  const liveConnectionRef = useRef(null);
  const audioManagerRef = useRef(null);
  const speakingTimeoutRef = useRef(null);
  const mensagemTimeoutRef = useRef(null);
  const processingTimeoutRef = useRef(null);
  const saudacaoTimeoutRef = useRef(null);
  const hasGreetedRef = useRef(false);
  const sessaoRef = useRef(0); // invalida callbacks e inicializações de sessões já encerradas
  const ultimoLocutorRef = useRef(null);

  const updateAiState = (newState) => {
    aiStateRef.current = newState;
    setAiState(newState);

    // Se a IA decidir não responder (ex.: conversa paralela), não fica "processando" para sempre
    clearTimeout(processingTimeoutRef.current);
    if (newState === 'processing') {
      processingTimeoutRef.current = setTimeout(() => {
        if (aiStateRef.current === 'processing') updateAiState('listening');
      }, PROCESSING_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    useChatStore.getState().fetchMemoria?.();
  }, []);

  const exibirMensagem = (texto) => {
    setUltimaMensagem(texto);
    clearTimeout(mensagemTimeoutRef.current);
    mensagemTimeoutRef.current = setTimeout(() => setUltimaMensagem(null), 8000);
  };

  const obterSaudacaoTemporal = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleRecalibrarVoz = () => {
    if (audioManagerRef.current?.resetarPerfilVocal) {
      audioManagerRef.current.resetarPerfilVocal();
      setSpeakerInfo(null);
      ultimoLocutorRef.current = null;
      exibirMensagem('🎙️ Perfil resetado! Fale uma frase normalmente para calibrar sua voz.');
    }
  };

  const ligarSistema = async () => {
    const sessao = ++sessaoRef.current;
    const ativa = () => sessaoRef.current === sessao;

    updateAiState('starting');
    setIsIntercomActive(true);

    try {
      await hidratarStoresSeNecessario();
      if (!ativa()) return;

      const audio = new GerenciadorDeAudio();
      audioManagerRef.current = audio;

      const aoCaptarSom = (base64Pcm) => {
        if (ativa()) liveConnectionRef.current?.enviarAudioVoz(base64Pcm);
      };

      // Silêncio detectado + biometria vocal (Yuri vs. Visitante)
      const aoDetectarSilencio = (analiseLocutor) => {
        if (!ativa() || !liveConnectionRef.current || aiStateRef.current !== 'listening') return;

        ultimoLocutorRef.current = analiseLocutor?.locutor ?? null;

        if (analiseLocutor) {
          setSpeakerInfo(analiseLocutor);
          if (analiseLocutor.recemCalibrado) {
            exibirMensagem(`🎙️ Biometria vocal do Yuri calibrada (${analiseLocutor.pitchHz} Hz)`);
          }
        }

        if (analiseLocutor?.locutor === 'Visitante') {
          exibirMensagem(`👥 Voz externa detectada (${analiseLocutor.confianca}% similaridade)`);
          // A trava real fica no código (ver aoReceberChamadaDeFuncao); este aviso só orienta a conversa
          liveConnectionRef.current.enviarComandoSilencioso(
            `[AVISO DO SENSOR ACÚSTICO: A fala anterior partiu de uma VOZ EXTERNA/VISITANTE (timbre ${analiseLocutor.pitchHz}Hz vs perfil do Yuri ${analiseLocutor.perfilPitchHz}Hz). Se a pessoa estiver falando com você, responda cordialmente como a um convidado do Yuri. O sistema BLOQUEIA registrar, alterar ou apagar dados por voz externa; apenas consultas e pesquisas funcionam. Se for conversa paralela que não é com você, ignore.]`
          );
        } else {
          liveConnectionRef.current.forcarResposta();
        }

        updateAiState('processing');
      };

      const aoComecarFalar = () => {
        if (!ativa()) return;
        // Só interrompe a IA quando ela está FALANDO. Durante 'processing' (ex.: uma pesquisa em andamento),
        // qualquer ruído acionava interromperGeracao() e o servidor cancelava a chamada da ferramenta.
        if (aiStateRef.current === 'speaking') {
          audioManagerRef.current?.pararAudioAtual();
          liveConnectionRef.current?.interromperGeracao();
        }
        // Em 'processing' o estado não muda: voltar para 'listening' faria o silêncio seguinte enviar
        // forcarResposta(), que também interrompe o turno e cancela a ferramenta.
        if (aiStateRef.current !== 'processing') updateAiState('listening');
      };

      const aoReceberAudioDaIA = (base64Audio) => {
        if (!ativa()) return;
        updateAiState('speaking');
        audioManagerRef.current?.tocarAudio(base64Audio);
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => {
          if (aiStateRef.current === 'speaking') updateAiState('listening');
        }, 1500);
      };

      const aoReceberTextoDaIA = (textoBruto) => {
        if (!ativa()) return;
        const textoLimpo = limparMarkdown(textoBruto);
        if (/^(Complying|Prioritizing|I've|I will|I am|Thinking|Understood|Processing)/i.test(textoLimpo)) return;
        if (textoLimpo.length > 0) {
          exibirMensagem(textoLimpo);
          useChatStore.getState().adicionarMemoria?.(textoLimpo);
        }
      };

      // Roteador: toda chamada recebe exatamente UMA resposta (sucesso ou erro)
      const aoReceberChamadaDeFuncao = async (info) => {
        if (!ativa()) return;
        updateAiState('processing');
        const { id, name } = info;
        const args = info.args || {};
        let resposta;

        try {
          if (MUTACOES.has(name) && ultimoLocutorRef.current === 'Visitante') {
            exibirMensagem('🔒 Comando bloqueado: voz não reconhecida como a do Yuri.');
            resposta = {
              status: 'erro',
              mensagem: 'Bloqueado: a última fala veio de uma voz externa. Peça ao Yuri para repetir o comando por voz.'
            };
          } else {
            resposta = await executarFerramenta(name, args, { exibirMensagem });
          }
        } catch (erro) {
          console.error('[Bastian] Erro ao executar ferramenta:', erro);
          exibirMensagem(`⚠️ ${erro.message || 'Falha ao processar comando'}`);
          resposta = { status: 'erro', mensagem: erro.message || 'Falha ao executar comando.' };
        }

        if (ativa()) liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, resposta);
      };

      const conexao = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao, {
        // O usuário falou por cima da IA: para o áudio que ainda estava na fila
        onInterrupted: () => {
          if (ativa()) audioManagerRef.current?.pararAudioAtual();
        },
        // O servidor cancelou a ferramenta em andamento: não há mais o que esperar, volta a ouvir
        onToolCancelled: () => {
          if (ativa() && aiStateRef.current === 'processing') updateAiState('listening');
        },
        // A conexão caiu e não foi possível retomar a sessão: desliga de forma limpa e avisa
        onClose: () => {
          if (!ativa()) return;
          desligarSistema();
          exibirMensagem('⚠️ A conexão com a IA caiu. Toque no orbe para reativar.');
        }
      });
      liveConnectionRef.current = conexao;
      // Função (e não texto fixo): o snapshot é refeito se a sessão for retomada
      await conexao.conectar(() => JSON.stringify(gerarRelatorioExecutivo(), null, 2));
      if (!ativa()) return; // desligarSistema já encerrou conexão e áudio

      await audio.inicializar(aoCaptarSom, aoDetectarSilencio, aoComecarFalar);
      if (!ativa()) {
        audio.parar(); // o desligar pode ter rodado antes de o microfone abrir
        return;
      }

      const saudacao = obterSaudacaoTemporal();
      saudacaoTimeoutRef.current = setTimeout(() => {
        if (!ativa() || !liveConnectionRef.current) return;
        if (!hasGreetedRef.current) {
          liveConnectionRef.current.enviarComandoSilencioso(
            `Responda apenas com esta frase exata: "${saudacao}, senhor. Como posso ajudar?"`
          );
          hasGreetedRef.current = true;
        } else {
          liveConnectionRef.current.enviarComandoSilencioso("Responda apenas com a frase: 'Pois não?'");
        }
      }, 1000);

      updateAiState('listening');
    } catch (erro) {
      if (!ativa()) return;
      console.error('[Bastian] Erro crítico ao ligar sistema:', erro);
      desligarSistema();
      exibirMensagem('⚠️ Não foi possível ativar o Bastian. Verifique a conexão e a permissão do microfone.');
    }
  };

  const desligarSistema = () => {
    sessaoRef.current += 1; // invalida qualquer inicialização ou callback em andamento

    if (audioManagerRef.current) { audioManagerRef.current.parar(); audioManagerRef.current = null; }
    if (liveConnectionRef.current) { liveConnectionRef.current.desconectar(); liveConnectionRef.current = null; }

    clearTimeout(speakingTimeoutRef.current);
    clearTimeout(processingTimeoutRef.current);
    clearTimeout(saudacaoTimeoutRef.current);
    clearTimeout(mensagemTimeoutRef.current);
    confirmacoesPendentes.clear();
    ultimoLocutorRef.current = null;

    setIsIntercomActive(false);
    setSpeakerInfo(null);
    aiStateRef.current = 'idle';
    setAiState('idle');
    setUltimaMensagem(null);
  };

  const toggleIntercom = () => {
    if (isIntercomActive) desligarSistema();
    else ligarSistema();
  };

  useEffect(() => () => desligarSistema(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const getRingColorClass = () => {
    if (!isIntercomActive) return 'text-slate-600/40 drop-shadow-none';
    switch (aiState) {
      case 'listening': return 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]';
      case 'processing': return 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]';
      case 'speaking': return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]';
      default: return 'text-cyan-700/60';
    }
  };

  const getCoreStyles = () => {
    if (!isIntercomActive) return 'border-slate-700/80 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-slate-900/90';
    switch (aiState) {
      case 'listening': return 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] bg-slate-900 scale-105';
      case 'processing': return 'border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)] bg-slate-900 animate-pulse';
      case 'speaking': return 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)] bg-slate-900';
      default: return 'border-cyan-700/50 bg-slate-900';
    }
  };

  return (
    <div className="fixed bottom-6 right-4 sm:right-8 z-50 flex flex-col items-end gap-2.5 pointer-events-none">

      {/* BALÃO DE FALA E FEEDBACK DA IA */}
      {ultimaMensagem && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto max-w-[280px] sm:max-w-xs bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-2xl rounded-br-sm shadow-2xl animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${aiState === 'speaking' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
              {aiState === 'speaking' ? <Activity size={12} /> : <MessageSquare size={12} />}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">{ultimaMensagem}</p>
          </div>
        </div>
      )}

      {/* BIOMETRIA VOCAL + RECALIBRAÇÃO */}
      {isIntercomActive && (
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full shadow-lg animate-in fade-in duration-200">
          {speakerInfo ? (
            <span className={`flex items-center gap-1 text-[10px] font-bold tracking-wide ${speakerInfo.locutor === 'Yuri' ? 'text-cyan-300' : 'text-amber-300'}`}>
              {speakerInfo.locutor === 'Yuri' ? <Mic size={11} className="text-cyan-400" /> : <Users size={11} className="text-amber-400" />}
              {speakerInfo.locutor} ({speakerInfo.inconclusivo && !speakerInfo.confianca ? '?' : `${speakerInfo.confianca}%`})
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
              <Mic size={11} className="text-cyan-400 animate-pulse" /> Escuta Biométrica
            </span>
          )}

          <div className="w-px h-3 bg-white/10 mx-0.5" />

          <button
            type="button"
            onClick={handleRecalibrarVoz}
            title="Recalibrar minha assinatura de voz"
            className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={10} /> Calibrar
          </button>
        </div>
      )}

      {/* ORBE PRINCIPAL */}
      <div className="pointer-events-auto relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 transition-all duration-300">

        {isIntercomActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute inset-[-10%] border border-transparent border-t-current border-r-current rounded-full transition-colors duration-500 opacity-50 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_4s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[5%] border-2 border-transparent border-b-current border-l-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1.5s_linear_reverse_infinite]' : 'animate-[spin_5s_linear_reverse_infinite]'}`}></div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleIntercom}
          aria-pressed={isIntercomActive}
          aria-label={isIntercomActive ? 'Desativar Bastian' : 'Ativar Bastian'}
          className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center backdrop-blur-md border-2 z-20 cursor-pointer active:scale-95 transition-all duration-300 ${getCoreStyles()}`}
          title={!isIntercomActive ? 'Ativar Bastian' : 'Desativar Bastian'}
        >
          <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors duration-300 ${!isIntercomActive ? 'bg-slate-500' : aiState === 'processing' ? 'bg-amber-400 animate-ping' : aiState === 'speaking' ? 'bg-emerald-400 animate-bounce' : 'bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]'}`}></div>
          {isIntercomActive && <div className="absolute w-1.5 h-1.5 bg-white/90 rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]"></div>}
        </button>
      </div>
    </div>
  );
}
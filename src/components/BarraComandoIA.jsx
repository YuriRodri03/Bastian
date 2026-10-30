// src/components/BarraComandoIA.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare } from 'lucide-react';

import { GeminiLiveConnection } from '../services/liveAiService';
import { GerenciadorDeAudio } from '../services/audioManager';

import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useFitnessStore } from '../store/useFitnessStore';
import { useChatStore } from '../store/useChatStore'; 

const getLocalTodayISO = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function BarraComandoIA() {
  const [aiState, setAiState] = useState('idle'); 
  const aiStateRef = useRef('idle'); 

  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [ultimaMensagem, setUltimaMensagem] = useState(null);
  
  const liveConnectionRef = useRef(null);
  const audioManagerRef = useRef(null);
  const speakingTimeoutRef = useRef(null);
  const mensagemTimeoutRef = useRef(null);
  const hasGreetedRef = useRef(false); 

  const updateAiState = (newState) => {
    aiStateRef.current = newState;
    setAiState(newState);
  };

  useEffect(() => {
    useChatStore.getState().fetchMemoria?.();
  }, []);

  const limparMarkdown = (texto) => {
    if (!texto) return '';
    return texto.replace(/[*_~`#>-]/g, '').trim();
  };

  const hidratarStoresSeNecessario = async () => {
    const promises = [];
    if (useFinanceStore.getState().transactions.length === 0) {
      promises.push(useFinanceStore.getState().fetchTransactions());
    }
    if (useAgendaStore.getState().agendaItems.length === 0) {
      promises.push(useAgendaStore.getState().fetchAgendaItems());
    }
    if (useInboxStore.getState().inboxTasks.length === 0) {
      promises.push(useInboxStore.getState().fetchInboxTasks());
    }
    if (useKanbanStore.getState().tasks.length === 0) {
      promises.push(useKanbanStore.getState().fetchKanbanTasks());
    }
    if (useFitnessStore.getState().healthLogs.length === 0) {
      promises.push(useFitnessStore.getState().fetchHealthLogs?.());
    }
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  };

  const gerarRelatorioExecutivo = () => {
    const dataHoje = getLocalTodayISO();
    const mesAtualPrefix = dataHoje.substring(0, 7);
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const { transactions, balance, investedBalance } = useFinanceStore.getState();
    const { agendaItems } = useAgendaStore.getState();
    const { inboxTasks } = useInboxStore.getState();
    const { tasks: kanbanTasks } = useKanbanStore.getState();
    const { healthLogs, fichasTreino } = useFitnessStore.getState();

    let receitasPagasMes = 0;
    let despesasOperacionaisPagasMes = 0;
    let contasAPagarMes = 0;
    let contasAReceberMes = 0;
    let aportesMes = 0;
    const gastosPorCategoria = {};

    transactions.forEach((t) => {
      const tDate = t.date && t.date.includes('/') 
        ? t.date.split('/').reverse().join('-') 
        : (t.date || '');
      
      if (tDate.startsWith(mesAtualPrefix)) {
        const val = Number(t.amount) || 0;
        const isPago = (t.status || 'pago') === 'pago';
        const isAporte = t.category === 'Aporte de Investimento';
        const isResgate = t.category === 'Resgate de Investimento';

        if (t.type === 'receita') {
          if (isPago && !isResgate) receitasPagasMes += val;
          else if (!isPago) contasAReceberMes += val;
        } else if (t.type === 'despesa') {
          if (isPago) {
            if (isAporte) aportesMes += val;
            else {
              despesasOperacionaisPagasMes += val;
              gastosPorCategoria[t.category] = (gastosPorCategoria[t.category] || 0) + val;
            }
          } else {
            contasAPagarMes += val;
          }
        }
      }
    });

    const balancoLiquidoMes = receitasPagasMes - despesasOperacionaisPagasMes;
    const saldoProjetadoFimDoMes = balance + contasAReceberMes - contasAPagarMes;
    const margemParaReserva = Math.max(0, saldoProjetadoFimDoMes - 300);

    const contasPendentesLista = transactions
      .filter(t => (t.status || 'pago') === 'pendente')
      .slice(0, 12)
      .map(t => ({ id: t.id, descricao: t.description.split(' [')[0], valor: t.amount, vencimento: t.date, tipo: t.type }));

    const compromissosProximos = agendaItems
      .filter(e => !e.is_completed && e.date >= dataHoje)
      .slice(0, 15)
      .map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, categoria: e.category }));

    const tarefasPendentes = inboxTasks
      .filter(t => !t.completed)
      .slice(0, 15)
      .map(t => ({ id: t.id, titulo: t.title, data: t.date }));

    const projetosKanban = kanbanTasks
      .slice(0, 12)
      .map(k => ({ id: k.id, titulo: k.title, coluna: k.status }));

    const treinosRealizados = (healthLogs || []).filter(l => l.type === 'treino');
    const ultimoPesoObj = (healthLogs || []).find(l => l.type === 'peso');
    const ultimasMedidas = {};
    (healthLogs || [])
      .filter(l => l.type === 'medida')
      .forEach(m => {
        if (!ultimasMedidas[m.title]) ultimasMedidas[m.title] = `${m.value}${m.unit || 'cm'}`;
      });

    return {
      data_hoje: dataHoje,
      hora_atual: horaAtual,
      resumo_financeiro: {
        saldo_atual_em_conta: Number(balance.toFixed(2)),
        total_investido_na_carteira: Number((investedBalance || 0).toFixed(2)),
        receitas_pagas_no_mes: Number(receitasPagasMes.toFixed(2)),
        despesas_operacionais_pagas_no_mes: Number(despesasOperacionaisPagasMes.toFixed(2)),
        aportes_investidos_no_mes: Number(aportesMes.toFixed(2)),
        balanco_operacional_do_mes: Number(balancoLiquidoMes.toFixed(2)),
        contas_pendentes_a_pagar_no_mes: Number(contasAPagarMes.toFixed(2)),
        saldo_projetado_apos_pagar_pendencias: Number(saldoProjetadoFimDoMes.toFixed(2)),
        sugestao_segura_para_guardar_na_reserva_agora: Number(margemParaReserva.toFixed(2)),
        gastos_por_categoria_no_mes: gastosPorCategoria,
        contas_pendentes_detalhadas: contasPendentesLista
      },
      produtividade: {
        compromissos_agenda: compromissosProximos,
        tarefas_inbox_pendentes: tarefasPendentes,
        quadro_kanban: projetosKanban
      },
      saude_fitness: {
        fichas_de_treino_atuais: fichasTreino,
        total_treinos_concluidos: treinosRealizados.length,
        ultimo_peso_kg: ultimoPesoObj ? ultimoPesoObj.value : null,
        medidas_corporais_atuais: ultimasMedidas,
        ultimos_registros_sono: (healthLogs || []).filter(l => l.type === 'sono').slice(0, 5),
        ultimos_registros_humor: (healthLogs || []).filter(l => l.type === 'humor').slice(0, 5)
      }
    };
  };

  const gerarContextoDinâmico = () => {
    return JSON.stringify(gerarRelatorioExecutivo(), null, 2);
  };

  const resolverIdPorNomeOuId = (lista, idOuTexto, campoTexto = 'title') => {
    if (!idOuTexto) return null;
    const alvoStr = String(idOuTexto).toLowerCase().trim();
    const porId = lista.find(item => String(item.id) === String(idOuTexto));
    if (porId) return porId.id;
    const porNome = lista.find(item => (item[campoTexto] || '').toLowerCase().includes(alvoStr));
    return porNome ? porNome.id : idOuTexto;
  };

  const exibirMensagem = (texto) => {
    setUltimaMensagem(texto);
    if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
    mensagemTimeoutRef.current = setTimeout(() => setUltimaMensagem(null), 8000);
  };

  const obterSaudacaoTemporal = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const ligarSistema = async () => {
    updateAiState('starting');
    setIsIntercomActive(true);

    try {
      await hidratarStoresSeNecessario();

      audioManagerRef.current = new GerenciadorDeAudio();
      
      const aoCaptarSom = (base64Pcm) => {
        if (liveConnectionRef.current) liveConnectionRef.current.enviarAudioVoz(base64Pcm);
      };

      const aoDetectarSilencio = () => {
        if (liveConnectionRef.current && aiStateRef.current === 'listening') {
          liveConnectionRef.current.forcarResposta();
          updateAiState('processing'); 
        }
      };

      const aoComecarFalar = () => {
        if (aiStateRef.current === 'speaking' || aiStateRef.current === 'processing') {
          if (audioManagerRef.current) audioManagerRef.current.pararAudioAtual();
          if (liveConnectionRef.current) liveConnectionRef.current.interromperGeracao();
        }
        updateAiState('listening');
      };

      const aoReceberAudioDaIA = (base64Audio) => {
        updateAiState('speaking'); 
        if (audioManagerRef.current) audioManagerRef.current.tocarAudio(base64Audio);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => {
          if (aiStateRef.current === 'speaking') updateAiState('listening');
        }, 1500); 
      };

      const aoReceberTextoDaIA = (textoBruto) => {
        const textoLimpo = limparMarkdown(textoBruto);
        if (textoLimpo.match(/^(Complying|Prioritizing|I've|I will|I am|Thinking|Understood|Processing)/i)) return;

        if (textoLimpo.length > 0) {
          exibirMensagem(textoLimpo);
          useChatStore.getState().adicionarMemoria?.(textoLimpo);
        }
      };

      // =========================================================================
      // ROTEADOR DE FUNÇÕES DA IA
      // =========================================================================
      const aoReceberChamadaDeFuncao = async (functionCallInfo) => {
        updateAiState('processing'); 
        const { id, name, args } = functionCallInfo;
        const dataHoje = getLocalTodayISO();

        try {
          // 1. FERRAMENTA DEDICADA DE FICHAS DE TREINO
          if (name === "gerenciar_ficha_treino") {
            const acao = (args.acao || 'criar').toLowerCase().trim();
            const titulo = (args.titulo || 'Nova Ficha de Treino').trim();
            const exercicios = Array.isArray(args.exercicios) ? args.exercicios : [];

            if (acao === 'criar') {
              const novaFicha = useFitnessStore.getState().addFichaTreino(titulo, exercicios);
              exibirMensagem(`💪 Ficha criada: ${novaFicha.title} (${novaFicha.exercicios.length} exercícios)`);
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                status: "sucesso",
                acao: "ficha_criada_na_aba_treinos",
                ficha: novaFicha
              });
            } 
            else if (acao === 'substituir_todas') {
              useFitnessStore.getState().setFichasTreino([]);
              const novaFicha = useFitnessStore.getState().addFichaTreino(titulo, exercicios);
              exibirMensagem(`🔥 Base de fichas recriada: ${novaFicha.title}`);
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                status: "sucesso",
                acao: "base_substituida_e_ficha_criada",
                ficha: novaFicha
              });
            }
            else if (acao === 'atualizar') {
              let fichaEditada = useFitnessStore.getState().updateFichaTreino(titulo, {
                title: titulo,
                exercicios: exercicios.length > 0 ? exercicios : undefined
              });
              // Se não encontrou ficha com esse nome para atualizar, cria uma nova automaticamente!
              if (!fichaEditada) {
                fichaEditada = useFitnessStore.getState().addFichaTreino(titulo, exercicios);
              }
              exibirMensagem(`💪 Ficha atualizada: ${fichaEditada.title}`);
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                status: "sucesso",
                ficha: fichaEditada
              });
            } 
            else if (acao === 'deletar') {
              useFitnessStore.getState().deleteFichaTreino(titulo);
              exibirMensagem(`🗑️ Ficha removida: ${titulo}`);
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                status: "sucesso",
                ficha_deletada: titulo
              });
            }
            return;
          }

          // 2. FERRAMENTA DE REGISTROS GERAIS
          if (name === "registrar_dado") {
            const entidade = (args.entidade || '').toLowerCase().trim();
            const dados = args.dados || args || {};

            const tituloFinal = (
              dados.titulo || dados.title || dados.descricao || 
              dados.description || dados.modalidade || dados.nome || "Novo Registro"
            ).trim();

            const valorFinal = Number(
              dados.valor ?? dados.amount ?? dados.peso ?? dados.duracao ?? 0
            );

            const dataFinal = dados.data || dados.date || dataHoje;
            const horaFinal = dados.hora || dados.time || null;
            const categoriaFinal = dados.categoria || dados.category || null;
            const statusFinal = dados.status || null;

            // INTERCEPTADOR ANTI-INBOX: Se vier lista de exercícios ou entidade de ficha, salva como Ficha de Treino!
            if (
              entidade === 'ficha_treino' || 
              entidade === 'ficha' || 
              (Array.isArray(dados.exercicios) && dados.exercicios.length > 0)
            ) {
              const novaFicha = useFitnessStore.getState().addFichaTreino(tituloFinal, dados.exercicios || []);
              exibirMensagem(`💪 Ficha criada: ${novaFicha.title}`);
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                status: "sucesso",
                entidade: "ficha_treino",
                ficha_criada: novaFicha
              });
              return;
            }

            switch (entidade) {
              case 'agenda':
              case 'evento':
              case 'compromisso': {
                const novoEvento = await useAgendaStore.getState().addAgendaItem({ 
                  title: tituloFinal, 
                  date: dataFinal, 
                  time: horaFinal,
                  category: categoriaFinal || 'evento'
                });
                exibirMensagem(`📅 Agenda: ${tituloFinal} (${dataFinal})`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                  status: "sucesso",
                  entidade: "agenda",
                  registro_criado: novoEvento
                });
                break;
              }

              case 'inbox':
              case 'tarefa': {
                const novaTarefa = await useInboxStore.getState().addInboxTask(tituloFinal, dataFinal);
                exibirMensagem(`📥 Tarefa: ${tituloFinal}`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                  status: "sucesso",
                  entidade: "inbox",
                  registro_criado: novaTarefa
                });
                break;
              }

              case 'kanban':
              case 'projeto': {
                const colStatus = ['backlog', 'in-progress', 'done'].includes(statusFinal) ? statusFinal : 'backlog';
                const novoCard = await useKanbanStore.getState().addTask(tituloFinal, colStatus);
                exibirMensagem(`📋 Kanban: ${tituloFinal}`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                  status: "sucesso",
                  entidade: "kanban",
                  registro_criado: novoCard
                });
                break;
              }

              case 'despesa':
              case 'gasto': {
                const novaDespesa = await useFinanceStore.getState().addTransaction({ 
                  amount: valorFinal, 
                  description: tituloFinal, 
                  type: 'despesa', 
                  category: categoriaFinal || 'Outros', 
                  date: dataFinal, 
                  status: statusFinal === 'pendente' ? 'pendente' : 'pago' 
                });
                exibirMensagem(`💸 Despesa: ${tituloFinal} (R$ ${valorFinal.toFixed(2)})`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                  status: "sucesso",
                  entidade: "despesa",
                  registro_criado: novaDespesa,
                  novo_saldo: useFinanceStore.getState().balance
                });
                break;
              }

              case 'receita':
              case 'ganho': {
                const novaReceita = await useFinanceStore.getState().addTransaction({ 
                  amount: valorFinal, 
                  description: tituloFinal, 
                  type: 'receita', 
                  category: categoriaFinal || 'Outros', 
                  date: dataFinal, 
                  status: statusFinal === 'pendente' ? 'pendente' : 'pago' 
                });
                exibirMensagem(`📈 Receita: ${tituloFinal} (R$ ${valorFinal.toFixed(2)})`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                  status: "sucesso",
                  entidade: "receita",
                  registro_criado: novaReceita,
                  novo_saldo: useFinanceStore.getState().balance
                });
                break;
              }

              case 'peso': {
                await useFitnessStore.getState().addHealthLog('peso', 'Peso', valorFinal, 'kg');
                exibirMensagem(`⚖️ Peso registrado: ${valorFinal} kg`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", valor_kg: valorFinal });
                break;
              }

              case 'treino':
              case 'treino_concluido': {
                const duracao = valorFinal > 0 ? valorFinal : 50;
                await useFitnessStore.getState().concluirFichaTreino(tituloFinal, duracao);
                exibirMensagem(`🏋️ Treino concluído: ${tituloFinal} (${duracao} min)`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", treino: tituloFinal });
                break;
              }

              case 'medida': {
                await useFitnessStore.getState().addHealthLog('medida', tituloFinal, valorFinal, 'cm');
                exibirMensagem(`📏 Medida (${tituloFinal}): ${valorFinal} cm`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", medida: tituloFinal, valor_cm: valorFinal });
                break;
              }

              case 'sono': {
                const horas = valorFinal > 0 ? valorFinal : 7.5;
                await useFitnessStore.getState().addHealthLog('sono', `Sono: ${tituloFinal}`, horas, 'h');
                exibirMensagem(`🌙 Sono registrado: ${horas}h (${tituloFinal})`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", horas_dormidas: horas });
                break;
              }

              case 'humor':
              case 'mente': {
                const notaHumor = valorFinal >= 1 && valorFinal <= 5 ? valorFinal : 4;
                await useFitnessStore.getState().addHealthLog('humor', `Humor: ${tituloFinal}`, notaHumor, '/5');
                exibirMensagem(`🧠 Check-in Mental: ${notaHumor}/5 (${tituloFinal})`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", nota: notaHumor });
                break;
              }

              default: {
                const fallbackTask = await useInboxStore.getState().addInboxTask(tituloFinal, dataFinal);
                exibirMensagem(`📥 Inbox: ${tituloFinal}`);
                liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
                  status: "sucesso",
                  registro_criado: fallbackTask
                });
              }
            }
          } 
          
          // 3. FERRAMENTA DE ALTERAÇÃO / CONCLUSÃO / EXCLUSÃO
          else if (name === "alterar_dado") {
            const acao = (args.acao || '').toLowerCase().trim();
            const entidade = (args.entidade || '').toLowerCase().trim();
            const rawId = args.id;

            if (acao === 'concluir') {
              if (entidade === 'ficha_treino' || entidade === 'treino') {
                const duracao = args.dados?.valor || 50;
                await useFitnessStore.getState().concluirFichaTreino(rawId, duracao);
                exibirMensagem(`🏋️ Ficha concluída: ${rawId}`);
              } else if (entidade === 'inbox' || entidade === 'tarefa') {
                const targetId = resolverIdPorNomeOuId(useInboxStore.getState().inboxTasks, rawId, 'title');
                await useInboxStore.getState().toggleInboxTask(targetId, false);
                exibirMensagem(`✅ Tarefa concluída!`);
              } else if (entidade === 'agenda' || entidade === 'evento') {
                const targetId = resolverIdPorNomeOuId(useAgendaStore.getState().agendaItems, rawId, 'title');
                await useAgendaStore.getState().toggleItemCompletion(targetId, false);
                exibirMensagem(`✅ Compromisso concluído!`);
              } else if (entidade === 'financas') {
                const targetId = resolverIdPorNomeOuId(useFinanceStore.getState().transactions, rawId, 'description');
                await useFinanceStore.getState().toggleTransactionStatus(targetId);
                exibirMensagem(`✅ Conta marcada como paga!`);
              } else if (entidade === 'kanban') {
                const targetId = resolverIdPorNomeOuId(useKanbanStore.getState().tasks, rawId, 'title');
                await useKanbanStore.getState().moveTask(targetId, 'done');
                exibirMensagem(`✅ Projeto movido para Concluído!`);
              }
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", acao: "concluido" });
            } 
            else if (acao === 'deletar' || acao === 'excluir') {
              if (entidade === 'ficha_treino') {
                useFitnessStore.getState().deleteFichaTreino(rawId);
              } else if (entidade === 'financas') {
                const targetId = resolverIdPorNomeOuId(useFinanceStore.getState().transactions, rawId, 'description');
                await useFinanceStore.getState().deleteTransaction(targetId);
              } else if (entidade === 'agenda') {
                const targetId = resolverIdPorNomeOuId(useAgendaStore.getState().agendaItems, rawId, 'title');
                await useAgendaStore.getState().deleteAgendaItem(targetId);
              } else if (entidade === 'inbox') {
                const targetId = resolverIdPorNomeOuId(useInboxStore.getState().inboxTasks, rawId, 'title');
                await useInboxStore.getState().deleteInboxTask(targetId);
              } else if (entidade === 'kanban') {
                const targetId = resolverIdPorNomeOuId(useKanbanStore.getState().tasks, rawId, 'title');
                await useKanbanStore.getState().deleteTask(targetId);
              } else {
                const targetId = resolverIdPorNomeOuId(useFitnessStore.getState().healthLogs, rawId, 'title');
                await useFitnessStore.getState().deleteHealthLog(targetId);
              }
              exibirMensagem(`🗑️ Registro removido.`);
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", acao: "deletado" });
            }
            else if (acao === 'atualizar') {
              const novosDados = args.dados || {};
              if (entidade === 'ficha_treino') {
                const fichaEditada = useFitnessStore.getState().updateFichaTreino(rawId, {
                  title: novosDados.titulo || novosDados.title || rawId,
                  exercicios: novosDados.exercicios
                });
                exibirMensagem(`💪 Ficha atualizada: ${fichaEditada?.title || rawId}`);
              } else if (entidade === 'kanban' && novosDados.status) {
                const targetId = resolverIdPorNomeOuId(useKanbanStore.getState().tasks, rawId, 'title');
                await useKanbanStore.getState().moveTask(targetId, novosDados.status);
                exibirMensagem(`🔄 Cartão Kanban movido.`);
              }
              liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, { status: "sucesso", acao: "atualizado" });
            }
          } 
          
          // 4. FERRAMENTA DE CONSULTA
          else if (name === "consultar_dados") {
            const relatorioCompleto = gerarRelatorioExecutivo();
            let respostaConsulta = {};

            if (args.entidade === 'financas') respostaConsulta = relatorioCompleto.resumo_financeiro;
            else if (args.entidade === 'treino') respostaConsulta = relatorioCompleto.saude_fitness;
            else if (['agenda', 'inbox', 'kanban'].includes(args.entidade)) respostaConsulta = relatorioCompleto.produtividade;
            else respostaConsulta = relatorioCompleto;

            exibirMensagem(`📊 Consultando base (${args.entidade || 'geral'})...`);
            liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, respostaConsulta);
          }

        } catch (erro) {
          console.error("[Bastian] Erro ao executar ferramenta:", erro);
          exibirMensagem(`⚠️ Erro ao processar comando: ${erro.message || 'Falha'}`);
          liveConnectionRef.current?.enviarRespostaDeFuncao(id, name, {
            status: "erro",
            mensagem: erro.message || "Falha ao executar comando."
          });
        }
      };

      liveConnectionRef.current = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao);
      await liveConnectionRef.current.conectar(gerarContextoDinâmico());
      await audioManagerRef.current.inicializar(aoCaptarSom, aoDetectarSilencio, aoComecarFalar); 

      const saudacao = obterSaudacaoTemporal();

      setTimeout(() => {
        if (liveConnectionRef.current) {
          if (!hasGreetedRef.current) {
            liveConnectionRef.current.enviarComandoSilencioso(`Responda apenas com esta frase exata: "${saudacao}, senhor. Como posso ajudar?"`);
            hasGreetedRef.current = true;
          } else {
            liveConnectionRef.current.enviarComandoSilencioso("Responda apenas com a frase: 'Pois não?'");
          }
        }
      }, 1000); 

      updateAiState('listening');

    } catch (erro) {
      console.error("[Bastian] Erro crítico ao ligar sistema:", erro);
      desligarSistema();
      alert("Falha crítica no sistema neural.");
    }
  };

  const desligarSistema = () => {
    if (audioManagerRef.current) { audioManagerRef.current.parar(); audioManagerRef.current = null; }
    if (liveConnectionRef.current) { liveConnectionRef.current.desconectar(); liveConnectionRef.current = null; }
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    setIsIntercomActive(false);
    updateAiState('idle');
    setUltimaMensagem(null);
  };

  const toggleIntercom = () => {
    if (isIntercomActive) desligarSistema();
    else ligarSistema();
  };

  useEffect(() => { return () => desligarSistema(); }, []);

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
    <div className="fixed bottom-6 right-4 sm:right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
      
      {ultimaMensagem && (
        <div className="pointer-events-auto max-w-[280px] sm:max-w-xs bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-2xl rounded-br-sm shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${aiState === 'speaking' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
              {aiState === 'speaking' ? <Activity size={12} /> : <MessageSquare size={12} />}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {ultimaMensagem}
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-auto relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 transition-all duration-300">
        
        {isIntercomActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute inset-[-10%] border border-transparent border-t-current border-r-current rounded-full transition-colors duration-500 opacity-50 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_4s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[5%] border-2 border-transparent border-b-current border-l-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1.5s_linear_reverse_infinite]' : 'animate-[spin_5s_linear_reverse_infinite]'}`}></div>
          </div>
        )}

        <button 
          onClick={toggleIntercom}
          className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center backdrop-blur-md border-2 z-20 cursor-pointer active:scale-95 transition-all duration-300 ${getCoreStyles()}`}
          title={!isIntercomActive ? "Ativar Bastian" : "Desativar Bastian"}
        >
          <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors duration-300 ${!isIntercomActive ? 'bg-slate-500' : aiState === 'processing' ? 'bg-amber-400 animate-ping' : aiState === 'speaking' ? 'bg-emerald-400 animate-bounce' : 'bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]'}`}></div>
          {isIntercomActive && <div className="absolute w-1.5 h-1.5 bg-white/90 rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]"></div>}
        </button>

      </div>
    </div>
  );
}
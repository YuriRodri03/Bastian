import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFitnessStore } from '../store/useFitnessStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const AcoesDoSistema = {
  // ==========================================
  // RELATÓRIOS E CONSULTAS INTELIGENTES
  // ==========================================
  relatorio_diario: () => {
    const hoje = new Date().toISOString().split('T')[0];
    const agendaHoje = useAgendaStore.getState().agendaItems.filter(e => e.date === hoje);
    const inboxPendentes = useInboxStore.getState().inboxTasks.filter(t => !t.completed && (!t.date || t.date === hoje));
    
    const transacoes = useFinanceStore.getState().transactions || [];
    
    // Calcula Saldo e Investimentos globais
    let saldo = 0;
    let investido = 0;
    
    transacoes.forEach(t => {
      if ((t.status || 'pago') === 'pago') {
        if (t.type === 'receita') saldo += t.amount;
        if (t.type === 'despesa') saldo -= t.amount;
        if (t.category === 'Aporte de Investimento') investido += t.amount;
        if (t.category === 'Resgate de Investimento') investido -= t.amount;
      }
    });
    
    const healthLogs = useFitnessStore.getState().healthLogs || [];
    const ultimoPeso = healthLogs.filter(l => l.type === 'peso').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    let resumo = `Iniciando briefing operacional, senhor Yuri. `;
    
    if (agendaHoje.length > 0) {
      resumo += `O seu calendário indica ${agendaHoje.length} compromissos para hoje. `;
    } else {
      resumo += `Sua agenda de eventos está livre hoje. `;
    }
    
    if (inboxPendentes.length > 0) {
      resumo += `Há ${inboxPendentes.length} tarefas pendentes aguardando sua ação. `;
    } else {
      resumo += `Sua caixa de tarefas está zerada. `;
    }
    
    resumo += `No panorama financeiro, seu saldo em conta é de ${saldo.toFixed(2)} reais, `;
    if (investido > 0) {
      resumo += `com um patrimônio investido de ${investido.toFixed(2)} reais. `;
    }
    
    if (ultimoPeso) {
      resumo += `Seu último registro físico consta com ${ultimoPeso.value} quilos. `;
    }
    
    resumo += `Os sistemas estão operando em capacidade máxima. Como deseja prosseguir?`;
    
    return resumo;
  },

  // ==========================================
  // FINANÇAS & SAÚDE
  // ==========================================
  registrar_peso: (args) => {
    useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', args.peso, 'kg');
    return `Peso de ${args.peso} quilos atualizado na base de dados, senhor.`;
  },

  registrar_habito: (args) => {
    useFitnessStore.getState().addHealthLog('habito', args.habito, args.quantidade || 1, args.unidade || 'vez');
    return `Hábito "${args.habito}" registrado no seu histórico.`;
  },
  
  adicionar_despesa: (args) => {
    const { addTransaction } = useFinanceStore.getState(); 
    addTransaction({
      type: 'despesa',
      amount: Number(args.valor),
      description: args.descricao,
      category: args.categoria || 'Outros',
      date: args.data || new Date().toISOString().split('T')[0], 
      status: args.status || 'pago' 
    });
    return `Despesa de ${args.valor} reais classificada como ${args.categoria || 'Outros'} foi registrada no painel.`;
  },

  adicionar_receita: (args) => {
    const { addTransaction } = useFinanceStore.getState(); 
    addTransaction({
      type: 'receita',
      amount: Number(args.valor),
      description: args.descricao,
      category: args.categoria || 'Outros',
      date: args.data || new Date().toISOString().split('T')[0], 
      status: args.status || 'pago' 
    });
    return `Receita de ${args.valor} reais contabilizada com sucesso no seu caixa.`;
  },

  iniciar_pomodoro: (args) => {
    return `Modo de foco ativado. Cronômetro configurado para ${args.minutos} minutos. Tenha uma excelente sessão de estudos, senhor.`;
  },

  // ==========================================
  // AGENDA (COMPROMISSOS NO CALENDÁRIO)
  // ==========================================
  adicionar_agenda: (args) => {
    const { addAgendaItem } = useAgendaStore.getState(); 
    addAgendaItem({
      title: args.titulo,
      description: args.descricao || null,
      date: args.data, 
      time: args.hora ? `${args.hora}:00` : null, 
      category: args.categoria || 'evento'
    });
    const msgHora = args.hora ? ` às ${args.hora}` : '';
    const dataFormatada = args.data.split('-').reverse().join('/');
    return `Entendido. Agendei "${args.titulo}" para ${dataFormatada}${msgHora}.`;
  },

  excluir_agenda: (args) => {
    const { deleteAgendaItem } = useAgendaStore.getState();
    deleteAgendaItem(args.id);
    return `O compromisso foi removido do seu calendário.`;
  },

  atualizar_agenda: (args) => {
    const { updateAgendaItem } = useAgendaStore.getState();
    updateAgendaItem(args.id, { 
      date: args.nova_data, 
      time: args.nova_hora ? `${args.nova_hora}:00` : undefined,
      title: args.novo_titulo 
    });
    return `Agenda atualizada conforme solicitado.`;
  },

  // ==========================================
  // INBOX DIÁRIO & CAPTURA RÁPIDA
  // ==========================================
  salvar_insight: (args) => {
    const { addInboxTask } = useInboxStore.getState();
    const dataHoje = new Date().toISOString().split('T')[0];
    addInboxTask(`[Insight] ${args.texto}`, dataHoje);
    return `Insight devidamente capturado e armazenado, senhor.`;
  },

  adicionar_tarefa: (args) => {
    const { addInboxTask } = useInboxStore.getState();
    const dataHoje = new Date().toISOString().split('T')[0];
    addInboxTask(args.titulo, dataHoje);
    return `A tarefa "${args.titulo}" foi adicionada à sua fila de processamento diário.`;
  },

  concluir_tarefa: (args) => {
    const { toggleInboxTask } = useInboxStore.getState();
    toggleInboxTask(args.id, false);
    return `Concluído. Menos uma pendência na sua lista.`;
  },

  excluir_tarefa: (args) => {
    const { deleteInboxTask } = useInboxStore.getState();
    deleteInboxTask(args.id);
    return `Tarefa descartada com sucesso.`;
  },

  // ==========================================
  // KANBAN (PROJETOS)
  // ==========================================
  adicionar_kanban: (args) => {
    const { addTask } = useKanbanStore.getState();
    addTask(args.titulo, args.coluna || 'backlog');
    return `Projeto estruturado. O cartão "${args.titulo}" foi criado no Kanban.`;
  },

  mover_kanban: (args) => {
    const { moveTask } = useKanbanStore.getState();
    moveTask(args.id, args.nova_coluna);
    return `Fluxo de trabalho atualizado. O cartão foi movido.`;
  },

  excluir_kanban: (args) => {
    const { deleteTask } = useKanbanStore.getState();
    deleteTask(args.id);
    return `Cartão removido do painel de projetos.`;
  },

  // ==========================================
  // COMUNICAÇÃO NEURAL BÁSICA
  // ==========================================
  conversar: (args) => {
    return args.resposta; 
  }
};

export async function enviarComandoParaIA(comandoTexto) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest", 
      generationConfig: { responseMimeType: "application/json" }
    });

    const hoje = new Date();
    const offsetTempo = hoje.getTimezoneOffset() * 60000;
    const dataLocal = new Date(hoje.getTime() - offsetTempo);
    const dataAtual = dataLocal.toISOString().split('T')[0]; 
    const dataFormatadaPT = dataLocal.toLocaleDateString('pt-BR');
    
    const diasDaSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const diaSemanaAtual = diasDaSemana[dataLocal.getDay()];
    const mesAtual = dataAtual.substring(0, 7); // YYYY-MM

    // =========================================================================
    // 1. INJEÇÃO DE CONTEXTO & IDS (Memória RAM Mapeada)
    // =========================================================================
    
    // Captura as transações DO MÊS para análises 
    const financeState = useFinanceStore.getState();
    const transacoesMes = (financeState.transactions || [])
      .filter(t => t.date && t.date.startsWith(mesAtual))
      .map(t => ({ descricao: t.description, valor: t.amount, tipo: t.type, categoria: t.category, data: t.date, status: t.status }));
    
    // AGENDA: Futuro e Hoje
    const agendaState = useAgendaStore.getState();
    const eventosAgenda = (agendaState.agendaItems || [])
      .filter(e => e.date >= dataAtual)
      .map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, categoria: e.category }));
    
    // INBOX: Pendentes
    const inboxState = useInboxStore.getState();
    const tarefasPendentes = (inboxState.inboxTasks || [])
      .filter(t => !t.completed)
      .map(t => ({ id: t.id, titulo: t.title, data: t.date }));

    // KANBAN: Projetos
    const kanbanState = useKanbanStore.getState();
    const tarefasKanban = (kanbanState.tasks || []).map(t => ({ 
      id: t.id, 
      titulo: t.title, 
      coluna_atual: t.status
    }));

    // =========================================================================
    // 2. O PROMPT NEURAL (Ciente de Contexto Profundo)
    // =========================================================================
    const prompt = `
      Você é "Bastian", a IA assistente pessoal de classe executiva do sistema "Centro de Comando".
      Sua personalidade é educada, altamente analítica e cirúrgica. Você fala com a precisão de um mordomo de alta tecnologia.
      
      PERFIL DO SEU USUÁRIO E CRIADOR:
      Nome: Senhor Yuri Rodrigues.
      Ocupação: Mestrando em Economia (CAEN/UFC).
      Localização: Fortaleza, CE.
      (Use essas informações sutilmente para gerar empatia e contexto quando adequado).

      INFORMAÇÕES DE TEMPO E SISTEMA:
      - Hoje é: ${diaSemanaAtual}, ${dataFormatadaPT} (Formato ISO para cálculos: ${dataAtual}).
      (Atenção redobrada: Se o usuário pedir para agendar para "amanhã" ou "próxima terça", calcule a data correta baseada no ISO acima).
      
      DADOS DE MEMÓRIA (Base de Conhecimento Dinâmica):
      - Calendário/Agenda: ${JSON.stringify(eventosAgenda)}
      - Inbox Diário (Pendentes): ${JSON.stringify(tarefasPendentes)}
      - Quadro Kanban: ${JSON.stringify(tarefasKanban)}
      - Finanças do Mês: ${JSON.stringify(transacoesMes)}
      
      DIRETRIZES ANALÍTICAS E DE ROTEAMENTO:
      - Se o usuário pedir um briefing, "resumo do dia" ou "como estamos", use a função "relatorio_diario".
      - Se o usuário perguntar sobre gastos ou o que tem para hoje, analise a "Base de Conhecimento" acima, raciocine e responda detalhadamente usando a função "conversar".
      - Para excluir, concluir ou mover itens, procure OBRIGATORIAMENTE o "id" exato no JSON fornecido.
      - Para Finanças: Reconheça implicitamente categorias como "Aporte de Investimento", "Mercado", "Cartão de Crédito".
      
      DIRETRIZES DE SÍNTESE DE VOZ (Estrito para a função "conversar"):
      1. NUNCA use formatação markdown (sem asteriscos, sem hashtags).
      2. NUNCA use emojis.
      3. Escreva TODOS os números e símbolos por extenso para o sintetizador de voz (Ex: "R$ 150,50" vira "cento e cinquenta reais e cinquenta centavos", "18:00" vira "dezoito horas").
      4. Seja direto, culto e elegante nas respostas.
      
      Você deve retornar APENAS um JSON estrito neste formato, sem explicações adicionais:
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      LISTA DE FUNÇÕES E ARGUMENTOS:
      - "conversar" -> args: "resposta" (string limpa)
      - "relatorio_diario" -> args: {} 
      
      - "adicionar_agenda" -> args: "titulo" (string), "data" (YYYY-MM-DD), "hora" (HH:MM ou null), "categoria" (string: evento, tarefa, aula, reuniao, saude, financeiro, lazer)
      - "atualizar_agenda" -> args: "id" (string), "nova_data" (YYYY-MM-DD), "nova_hora" (HH:MM ou null), "novo_titulo" (string)
      - "excluir_agenda" -> args: "id" (string)
      
      - "adicionar_tarefa" -> args: "titulo" (string)
      - "concluir_tarefa" -> args: "id" (string)
      - "excluir_tarefa" -> args: "id" (string)
      - "salvar_insight" -> args: "texto" (string)
      
      - "adicionar_kanban" -> args: "titulo" (string), "coluna" (string: "backlog", "in-progress" ou "done")
      - "mover_kanban" -> args: "id" (string), "nova_coluna" (string)
      - "excluir_kanban" -> args: "id" (string)
      
      - "registrar_peso" -> args: "peso" (numero)
      - "registrar_habito" -> args: "habito" (string), "quantidade" (numero), "unidade" (string)
      - "adicionar_despesa" -> args: "valor" (numero), "descricao" (string), "categoria" (string), "data" (YYYY-MM-DD), "status" ("pago" ou "pendente")
      - "adicionar_receita" -> args: "valor" (numero), "descricao" (string), "categoria" (string), "data" (YYYY-MM-DD), "status" ("pago" ou "pendente")
      - "iniciar_pomodoro" -> args: "minutos" (numero)

      Comando detectado do Senhor Yuri: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    let respostaTexto = result.response.text();
    
    // Limpeza de segurança para JSON
    respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const comandoEstruturado = JSON.parse(respostaTexto);
    
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      let mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos || {});
      mensagemRetorno = mensagemRetorno.replace(/[*_#~]/g, ''); // Limpa resíduos markdown
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Senhor Yuri, a intenção foi compreendida, mas houve uma falha de mapeamento de protocolos na minha rede neural." };
    }

  } catch (error) {
    console.error("Erro no processamento neural (Gemini):", error);
    return { sucesso: false, mensagem: "Houve uma leve instabilidade de comunicação com a minha base de dados. Por favor, repita o comando." };
  }
}
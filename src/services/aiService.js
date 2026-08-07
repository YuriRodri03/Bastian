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
    const saldo = transacoes.reduce((acc, t) => {
      if ((t.status || 'pago') !== 'pago') return acc;
      return (t.type === 'receita' || t.type === 'income') ? acc + t.amount : acc - t.amount;
    }, 0);
    
    const healthLogs = useFitnessStore.getState().healthLogs || [];
    const ultimoPeso = healthLogs.filter(l => l.type === 'peso').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    let resumo = `Bom dia, senhor Yuri. Aqui está o seu panorama operacional. `;
    
    if (agendaHoje.length > 0) {
      resumo += `Temos ${agendaHoje.length} compromissos marcados para hoje. `;
    } else {
      resumo += `Sua agenda de eventos está livre hoje. `;
    }
    
    if (inboxPendentes.length > 0) {
      resumo += `Existem ${inboxPendentes.length} tarefas prioritárias na sua lista diária. `;
    } else {
      resumo += `Sua caixa de tarefas está limpa. `;
    }
    
    resumo += `O saldo atual do caixa é de ${saldo.toFixed(2)} reais. `;
    
    if (ultimoPeso) {
      resumo += `E seu último registro corporal foi de ${ultimoPeso.value} quilos. `;
    }
    
    resumo += `Como deseja prosseguir?`;
    
    return resumo;
  },

  // ==========================================
  // FINANÇAS & SAÚDE
  // ==========================================
  registrar_peso: (args) => {
    useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', args.peso, 'kg');
    return `Peso de ${args.peso} quilos atualizado no sistema, senhor.`;
  },

  registrar_habito: (args) => {
    useFitnessStore.getState().addHealthLog('habito', args.habito, args.quantidade || 1, args.unidade || 'vez');
    return `Hábito "${args.habito}" registrado no seu histórico de performance.`;
  },
  
  adicionar_despesa: (args) => {
    const { addTransaction } = useFinanceStore.getState(); 
    addTransaction({
      type: 'despesa',
      amount: Number(args.valor),
      description: args.descricao,
      category: args.categoria || 'Outros',
      date: new Date().toISOString().split('T')[0], 
      status: 'pago' 
    });
    return `Despesa de ${args.valor} reais referente a ${args.descricao} foi registrada no painel financeiro.`;
  },

  adicionar_receita: (args) => {
    const { addTransaction } = useFinanceStore.getState(); 
    addTransaction({
      type: 'receita',
      amount: Number(args.valor),
      description: args.descricao,
      category: args.categoria || 'Outros',
      date: new Date().toISOString().split('T')[0], 
      status: 'pago' 
    });
    return `Excelente. A receita de ${args.valor} reais referente a ${args.descricao} foi adicionada ao seu caixa.`;
  },

  iniciar_pomodoro: (args) => {
    return `Modo de foco ativado. Cronômetro Pomodoro configurado para ${args.minutos} minutos. Bom trabalho, senhor.`;
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
    return `Entendido. "${args.titulo}" adicionado à sua agenda para ${dataFormatada}${msgHora}.`;
  },

  excluir_agenda: (args) => {
    const { deleteAgendaItem } = useAgendaStore.getState();
    deleteAgendaItem(args.id);
    return `O compromisso foi excluído do seu calendário.`;
  },

  atualizar_agenda: (args) => {
    const { updateAgendaItem } = useAgendaStore.getState();
    updateAgendaItem(args.id, { 
      date: args.nova_data, 
      time: args.nova_hora ? `${args.nova_hora}:00` : undefined,
      title: args.novo_titulo 
    });
    return `A agenda foi atualizada conforme solicitado, senhor.`;
  },

  // ==========================================
  // INBOX DIÁRIO & CAPTURA RÁPIDA
  // ==========================================
  salvar_insight: (args) => {
    const { addInboxTask } = useInboxStore.getState();
    const dataHoje = new Date().toISOString().split('T')[0];
    addInboxTask(`[Insight] ${args.texto}`, dataHoje);
    return `Ideia capturada e salva na sua caixa de entrada, senhor.`;
  },

  adicionar_tarefa: (args) => {
    const { addInboxTask } = useInboxStore.getState();
    const dataHoje = new Date().toISOString().split('T')[0];
    addInboxTask(args.titulo, dataHoje);
    return `A tarefa "${args.titulo}" foi adicionada à sua caixa de entrada de hoje.`;
  },

  concluir_tarefa: (args) => {
    const { toggleInboxTask } = useInboxStore.getState();
    toggleInboxTask(args.id, false);
    return `Excelente, senhor. Tarefa marcada como concluída.`;
  },

  excluir_tarefa: (args) => {
    const { deleteInboxTask } = useInboxStore.getState();
    deleteInboxTask(args.id);
    return `Tarefa removida da sua lista de pendências.`;
  },

  // ==========================================
  // KANBAN (PROJETOS)
  // ==========================================
  adicionar_kanban: (args) => {
    const { addTask } = useKanbanStore.getState();
    addTask(args.titulo, args.coluna || 'backlog');
    return `O cartão "${args.titulo}" foi criado no quadro Kanban.`;
  },

  mover_kanban: (args) => {
    const { moveTask } = useKanbanStore.getState();
    moveTask(args.id, args.nova_coluna);
    return `O cartão foi movido para a nova coluna no projeto.`;
  },

  excluir_kanban: (args) => {
    const { deleteTask } = useKanbanStore.getState();
    deleteTask(args.id);
    return `O cartão foi excluído do quadro Kanban definitivamente.`;
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
    
    const mesAtual = dataAtual.substring(0, 7); // YYYY-MM

    // =========================================================================
    // 1. INJEÇÃO DE CONTEXTO & IDS (Memória RAM Mapeada)
    // =========================================================================
    
    // Captura as transações DO MÊS para permitir análises e perguntas sobre gastos
    const financeState = useFinanceStore.getState();
    const transacoesMes = (financeState.transactions || [])
      .filter(t => t.date && t.date.startsWith(mesAtual))
      .map(t => ({ descricao: t.description, valor: t.amount, tipo: t.type, categoria: t.category, data: t.date }));
    
    // AGENDA: Mapeia apenas eventos futuros ou de hoje com IDs
    const agendaState = useAgendaStore.getState();
    const eventosAgenda = (agendaState.agendaItems || [])
      .filter(e => e.date >= dataAtual)
      .map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time }));
    
    // INBOX DIÁRIO: Tarefas pendentes
    const inboxState = useInboxStore.getState();
    const tarefasPendentes = (inboxState.inboxTasks || [])
      .filter(t => !t.completed)
      .map(t => ({ id: t.id, titulo: t.title, data: t.date }));

    // KANBAN: Tarefas organizadas no quadro de projetos
    const kanbanState = useKanbanStore.getState();
    const tarefasKanban = (kanbanState.tasks || []).map(t => ({ 
      id: t.id, 
      titulo: t.title, 
      coluna_atual: t.status // 'backlog', 'in-progress' ou 'done'
    }));

    // =========================================================================
    // 2. O PROMPT CIENTE DO CONTEXTO
    // =========================================================================
    const prompt = `
      Você é "Bastian", a IA assistente pessoal avançada do sistema "Centro de Comando".
      Seu criador e usuário é o senhor Yuri. Sua personalidade é educada, altamente analítica e cirúrgica, semelhante a um mordomo de alta tecnologia.
      
      INFORMAÇÕES DE SISTEMA:
      - Data de hoje: ${dataFormatadaPT} (Formato ISO: ${dataAtual}).
      
      DADOS ATUAIS DO USUÁRIO (Base de Conhecimento):
      - Calendário/Agenda (Futuros): ${JSON.stringify(eventosAgenda)}
      - Inbox Diário (Pendentes): ${JSON.stringify(tarefasPendentes)}
      - Quadro Kanban (Projetos): ${JSON.stringify(tarefasKanban)}
      - Finanças do Mês Atual: ${JSON.stringify(transacoesMes)}
      
      DIRETRIZES CRÍTICAS DE MANIPULAÇÃO:
      - Se o usuário pedir o "relatório de hoje", "briefing", ou "resumo do dia", use a função "relatorio_diario".
      - Se o usuário perguntar sobre gastos ou dados específicos ("Quanto gastei com X?", "O que tenho agendado?"), analise os "DADOS ATUAIS DO USUÁRIO" acima, faça os cálculos necessários e responda usando a função "conversar".
      - Para excluir, concluir, atualizar ou mover um item existente (Agenda, Inbox ou Kanban), OBRIGATORIAMENTE procure o "id" exato no JSON fornecido acima e passe-o no argumento.
      - As colunas válidas para o Kanban são: "backlog", "in-progress" e "done".

      DIRETRIZES DE SÍNTESE DE VOZ (Para a função "conversar"):
      1. NUNCA use formatação markdown (sem asteriscos, sem negritos).
      2. NUNCA use emojis.
      3. ESCREVA NÚMEROS E SÍMBOLOS POR EXTENSO (Ex: "R$ 1500" vira "mil e quinhentos reais", "18:00" vira "dezoito horas", "10%" vira "dez por cento").
      4. Seja direto, assertivo e elegante nas respostas.
      
      Sua tarefa é retornar APENAS um JSON estrito no formato:
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      Lista de Funções e Argumentos exigidos:
      - "conversar" -> args: "resposta" (string formatada para áudio sem símbolos)
      - "relatorio_diario" -> args: {} (vazio)
      
      - "adicionar_agenda" -> args: "titulo" (string), "data" (YYYY-MM-DD), "hora" (HH:MM ou null)
      - "atualizar_agenda" -> args: "id" (string dos dados), "nova_data" (YYYY-MM-DD), "nova_hora" (HH:MM ou null), "novo_titulo" (string)
      - "excluir_agenda" -> args: "id" (string dos dados)
      
      - "adicionar_tarefa" -> args: "titulo" (string)
      - "concluir_tarefa" -> args: "id" (string dos dados)
      - "excluir_tarefa" -> args: "id" (string dos dados)
      - "salvar_insight" -> args: "texto" (string - use para ideias/anotações rápidas)
      
      - "adicionar_kanban" -> args: "titulo" (string), "coluna" (string: "backlog", "in-progress" ou "done")
      - "mover_kanban" -> args: "id" (string dos dados), "nova_coluna" (string)
      - "excluir_kanban" -> args: "id" (string dos dados)
      
      - "registrar_peso" -> args: "peso" (numero)
      - "registrar_habito" -> args: "habito" (string), "quantidade" (numero), "unidade" (string)
      - "adicionar_despesa" -> args: "valor" (numero), "descricao" (string)
      - "adicionar_receita" -> args: "valor" (numero), "descricao" (string)
      - "iniciar_pomodoro" -> args: "minutos" (numero)

      Comando do usuário: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    let respostaTexto = result.response.text();
    
    // Limpeza de segurança 
    respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const comandoEstruturado = JSON.parse(respostaTexto);
    
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      let mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos || {});
      mensagemRetorno = mensagemRetorno.replace(/[*_#~]/g, ''); // Limpa resíduos para síntese de voz
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Senhor, a intenção foi compreendida, mas os protocolos de execução deste módulo falharam." };
    }

  } catch (error) {
    console.error("Erro no processamento neural (Gemini):", error);
    return { sucesso: false, mensagem: "Houve uma instabilidade na minha rede neural. Por favor, tente novamente." };
  }
}
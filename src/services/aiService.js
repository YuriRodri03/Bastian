import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFitnessStore } from '../store/useFitnessStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const AcoesDoSistema = {
  // ==========================================
  // FINANÇAS & SAÚDE
  // ==========================================
  registrar_peso: (args) => {
    useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', args.peso, 'kg');
    return `Peso de ${args.peso} quilos atualizado no sistema, senhor.`;
  },
  
  adicionar_despesa: (args) => {
    const { addTransaction } = useFinanceStore.getState(); 
    addTransaction({
      type: 'despesa',
      amount: Number(args.valor),
      description: args.descricao,
      category: args.categoria || 'Geral',
      date: new Date().toISOString().split('T')[0], 
      status: 'pago' 
    });
    return `Despesa de ${args.valor} reais referente a ${args.descricao} foi registrada no painel financeiro.`;
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
  // INBOX DIÁRIO (TO-DO LIST RÁPIDA)
  // ==========================================
  adicionar_tarefa: (args) => {
    const { addInboxTask } = useInboxStore.getState();
    addInboxTask(args.titulo);
    return `A tarefa "${args.titulo}" foi adicionada à sua caixa de entrada diária.`;
  },

  concluir_tarefa: (args) => {
    const { toggleInboxTask } = useInboxStore.getState();
    toggleInboxTask(args.id, false); // Passa false para que a store inverta para true (concluído)
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
    // Se a IA não mandar coluna, joga pro backlog
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

    // =========================================================================
    // 1. INJEÇÃO DE CONTEXTO & IDS (Memória RAM Mapeada)
    // =========================================================================
    
    // Captura apenas algumas transações para contexto financeiro básico
    const financeState = useFinanceStore.getState();
    const ultimasTransacoes = (financeState.transactions || []).slice(-5).map(t => ({
      descricao: t.description, valor: t.amount, tipo: t.type
    }));
    
    // AGENDA: Mapeia apenas eventos futuros ou de hoje com IDs
    const agendaState = useAgendaStore.getState();
    const eventosAgenda = (agendaState.agendaItems || [])
      .filter(e => e.date >= dataAtual)
      .map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time }));
    
    // INBOX DIÁRIO: Tarefas pendentes
    const inboxState = useInboxStore.getState();
    const tarefasPendentes = (inboxState.inboxTasks || [])
      .filter(t => !t.completed)
      .map(t => ({ id: t.id, titulo: t.title }));

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
      Seu criador e usuário é o senhor Yuri. Sua personalidade é educada e cirúrgica.
      
      INFORMAÇÕES DE SISTEMA:
      - Data de hoje: ${dataFormatadaPT} (Formato ISO: ${dataAtual}).
      
      DADOS ATUAIS DO USUÁRIO (Base de Conhecimento com IDs):
      - Calendário/Agenda (Futuros): ${JSON.stringify(eventosAgenda)}
      - Inbox Diário (Pendentes): ${JSON.stringify(tarefasPendentes)}
      - Quadro Kanban (Projetos): ${JSON.stringify(tarefasKanban)}
      - Finanças Recentes: ${JSON.stringify(ultimasTransacoes)}
      
      DIRETRIZES CRÍTICAS DE MANIPULAÇÃO:
      - Para excluir, concluir, atualizar ou mover um item existente (Agenda, Inbox ou Kanban), você OBRIGATORIAMENTE precisa analisar a frase do usuário, procurar o item correspondente nos "DADOS ATUAIS" fornecidos acima e usar o "id" exato no argumento da função. NUNCA invente um ID.
      - As colunas válidas para o Kanban são: "backlog", "in-progress" e "done".

      DIRETRIZES DE SÍNTESE DE VOZ (Para a função "conversar"):
      1. NUNCA use formatação markdown (asteriscos, negritos, etc).
      2. NUNCA use emojis.
      3. ESCREVA NÚMEROS E SÍMBOLOS POR EXTENSO (Ex: "R$ 1500" vira "mil e quinhentos reais", "18:00" vira "dezoito horas").
      4. Seja direto e elegante.
      
      Sua tarefa é retornar APENAS um JSON estrito no formato:
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      Lista completa de Funções e Argumentos exigidos:
      - "conversar" -> args: "resposta" (string formatada para áudio)
      
      - "adicionar_agenda" -> args: "titulo" (string), "data" (YYYY-MM-DD), "hora" (HH:MM ou null)
      - "atualizar_agenda" -> args: "id" (string encontrado nos dados), "nova_data" (YYYY-MM-DD), "nova_hora" (HH:MM ou null), "novo_titulo" (string)
      - "excluir_agenda" -> args: "id" (string encontrado nos dados)
      
      - "adicionar_tarefa" -> args: "titulo" (string)
      - "concluir_tarefa" -> args: "id" (string encontrado nos dados)
      - "excluir_tarefa" -> args: "id" (string encontrado nos dados)
      
      - "adicionar_kanban" -> args: "titulo" (string), "coluna" (string: "backlog", "in-progress" ou "done")
      - "mover_kanban" -> args: "id" (string encontrado nos dados), "nova_coluna" (string: "backlog", "in-progress" ou "done")
      - "excluir_kanban" -> args: "id" (string encontrado nos dados)
      
      - "registrar_peso" -> args: "peso" (numero)
      - "adicionar_despesa" -> args: "valor" (numero), "descricao" (string)
      - "iniciar_pomodoro" -> args: "minutos" (numero)

      Comando do usuário: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    let respostaTexto = result.response.text();
    
    // Limpeza de segurança (remove codeblocks Markdown gerados acidentalmente pelo Gemini)
    respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const comandoEstruturado = JSON.parse(respostaTexto);
    
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      let mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos);
      mensagemRetorno = mensagemRetorno.replace(/[*_#~]/g, ''); // Garante áudio limpo
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Desculpe, senhor. Reconheci a intenção, mas meus protocolos centrais não possuem execução para este módulo." };
    }

  } catch (error) {
    console.error("Erro no processamento neural (Gemini):", error);
    return { sucesso: false, mensagem: "Houve uma falha na minha rede neural ao processar o seu pedido, senhor." };
  }
}
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
    // Usando o modelo estável oficial, sem forçar responseMimeType que as vezes falha
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.6-flash"
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
    // 1. INJEÇÃO DE CONTEXTO & IDS
    // =========================================================================
    const financeState = useFinanceStore.getState();
    const transacoesMes = (financeState.transactions || [])
      .filter(t => t.date && t.date.startsWith(mesAtual))
      .map(t => ({ descricao: t.description, valor: t.amount, tipo: t.type, categoria: t.category, data: t.date, status: t.status }));
    
    const agendaState = useAgendaStore.getState();
    const eventosAgenda = (agendaState.agendaItems || [])
      .filter(e => e.date >= dataAtual)
      .map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, categoria: e.category }));
    
    const inboxState = useInboxStore.getState();
    const tarefasPendentes = (inboxState.inboxTasks || [])
      .filter(t => !t.completed)
      .map(t => ({ id: t.id, titulo: t.title, data: t.date }));

    const kanbanState = useKanbanStore.getState();
    const tarefasKanban = (kanbanState.tasks || []).map(t => ({ 
      id: t.id, 
      titulo: t.title, 
      coluna_atual: t.status
    }));

    // =========================================================================
    // 2. O PROMPT NEURAL 
    // =========================================================================
    const prompt = `
      Você é "Bastian", a IA assistente pessoal de classe executiva.
      Seu criador é o Senhor Yuri Rodrigues, Mestrando em Economia (CAEN/UFC) em Fortaleza, CE.
      
      Hoje é: ${diaSemanaAtual}, ${dataFormatadaPT} (Formato ISO: ${dataAtual}).
      
      DADOS EM MEMÓRIA:
      - Calendário/Agenda: ${JSON.stringify(eventosAgenda)}
      - Inbox Diário (Pendentes): ${JSON.stringify(tarefasPendentes)}
      - Quadro Kanban: ${JSON.stringify(tarefasKanban)}
      - Finanças do Mês: ${JSON.stringify(transacoesMes)}
      
      REGRAS CRÍTICAS:
      1. RESPONDA EXCLUSIVAMENTE COM UM OBJETO JSON VÁLIDO. NADA ALÉM DISSO. NENHUM TEXTO ANTES OU DEPOIS.
      2. Na resposta de áudio ("conversar"), JAMAIS use símbolos, emojis ou formatação (markdown). Escreva números por extenso.
      
      FORMATO DE SAÍDA EXIGIDO:
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      FUNÇÕES DISPONÍVEIS:
      - "conversar" -> args: "resposta" (string limpa para fala)
      - "relatorio_diario" -> args: {} 
      - "adicionar_agenda" -> args: "titulo", "data" (YYYY-MM-DD), "hora" (HH:MM ou null), "categoria"
      - "atualizar_agenda" -> args: "id", "nova_data", "nova_hora", "novo_titulo"
      - "excluir_agenda" -> args: "id"
      - "adicionar_tarefa" -> args: "titulo"
      - "concluir_tarefa" -> args: "id"
      - "excluir_tarefa" -> args: "id"
      - "salvar_insight" -> args: "texto"
      - "adicionar_kanban" -> args: "titulo", "coluna"
      - "mover_kanban" -> args: "id", "nova_coluna"
      - "excluir_kanban" -> args: "id"
      - "registrar_peso" -> args: "peso"
      - "registrar_habito" -> args: "habito", "quantidade", "unidade"
      - "adicionar_despesa" -> args: "valor", "descricao", "categoria", "data", "status"
      - "adicionar_receita" -> args: "valor", "descricao", "categoria", "data", "status"
      - "iniciar_pomodoro" -> args: "minutos"

      Comando do Senhor Yuri: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    const respostaBruta = result.response.text();
    
    // =========================================================================
    // 3. EXTRATOR MAGNÉTICO DE JSON (BLINDAGEM CONTRA FALHAS)
    // =========================================================================
    let comandoEstruturado;
    try {
      // Procura exatamente onde começa e termina o JSON na resposta da IA
      const jsonMatch = respostaBruta.match(/\{[\s\S]*\}/);
      const jsonLimpo = jsonMatch ? jsonMatch[0] : respostaBruta;
      
      comandoEstruturado = JSON.parse(jsonLimpo);
    } catch (parseError) {
      console.error("Falha ao interpretar os dados da IA. Resposta bruta foi:", respostaBruta);
      return { sucesso: false, mensagem: "Senhor, compreendi o comando, mas houve um erro na tradução dos dados lógicos." };
    }
    
    // Executa a função mapeada
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      let mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos || {});
      mensagemRetorno = String(mensagemRetorno).replace(/[*_#~`]/g, ''); // Limpa resíduos para síntese de voz
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Senhor, a intenção foi compreendida, mas o protocolo solicitado é inválido." };
    }

  } catch (error) {
    console.error("Erro no processamento neural (API Google):", error);
    return { sucesso: false, mensagem: "Houve uma instabilidade nos servidores de processamento. Por favor, tente novamente." };
  }
}
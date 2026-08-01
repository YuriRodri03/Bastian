import { GoogleGenerativeAI } from "@google/generative-ai";
import { useFitnessStore } from '../store/useFitnessStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const AcoesDoSistema = {
  registrar_peso: (args) => {
    useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', args.peso, 'kg');
    return `⚖️ Peso de ${args.peso}kg atualizado com sucesso, senhor.`;
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
    return `💸 Despesa de R$ ${args.valor} (${args.descricao}) registrada. O banco de dados foi atualizado.`;
  },

  adicionar_agenda: (args) => {
    const { addAgendaItem } = useAgendaStore.getState(); 
    addAgendaItem({
      title: args.titulo,
      description: args.descricao || null,
      date: args.data, 
      time: args.hora ? `${args.hora}:00` : null, 
      category: args.categoria || 'Geral'
    });
    const msgHora = args.hora ? ` às ${args.hora}` : '';
    const dataFormatada = args.data.split('-').reverse().join('/');
    return `📅 Entendido, senhor. "${args.titulo}" foi adicionado aos seus compromissos para ${dataFormatada}${msgHora}.`;
  },
  
  iniciar_pomodoro: (args) => {
    return `🍅 Pomodoro de ${args.minutos} minutos ativado. Modo de foco iniciado.`;
  },

  // A função conversar agora é onde a mágica de leitura acontece
  conversar: (args) => {
    return args.resposta; 
  }
};

export async function enviarComandoParaIA(comandoTexto) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest", // Nome atualizado da engine do Gemini
      generationConfig: { responseMimeType: "application/json" }
    });

    // =========================================================================
    // CORREÇÃO DE FUSO HORÁRIO: Garante a data local exata do Brasil (YYYY-MM-DD)
    // =========================================================================
    const hoje = new Date();
    const offsetTempo = hoje.getTimezoneOffset() * 60000;
    const dataLocal = new Date(hoje.getTime() - offsetTempo);
    const dataAtual = dataLocal.toISOString().split('T')[0]; 
    const dataFormatadaPT = dataLocal.toLocaleDateString('pt-BR');

    // =========================================================================
    // 1. INJEÇÃO DE CONTEXTO (A "Memória" RAM do Bastian)
    // =========================================================================
    
    // Captura Finanças
    const financeState = useFinanceStore.getState();
    const transacoes = financeState.transactions || financeState.despesas || [];
    const resumoFinanceiro = JSON.stringify(transacoes.slice(-15)); 
    
    // Captura Agenda (Agora com o nome EXATO da sua store)
    const agendaState = useAgendaStore.getState();
    const eventosAgenda = agendaState.agendaItems || [];
    
    const eventosFuturos = eventosAgenda.filter(e => e.date >= dataAtual);
    const resumoAgenda = JSON.stringify(eventosFuturos);

    // LOG DE DEPURAÇÃO: Abra o console do navegador (F12) para ver o que o Bastian está lendo!
    console.log("Bastian Vision - Data Atual:", dataAtual);
    console.log("Bastian Vision - Todos os Eventos na Store:", eventosAgenda);
    console.log("Bastian Vision - Eventos Filtrados p/ Hoje ou Futuro:", eventosFuturos);

    // =========================================================================
    // 2. O NOVO PROMPT CIENTE DO CONTEXTO
    // =========================================================================
    const prompt = `
      Você é "Bastian", a IA assistente pessoal avançada do "Centro de Comando".
      Seu criador e usuário é o senhor Yuri. Sua personalidade é educada, altamente eficiente e sutilmente sarcástica.
      
      INFORMAÇÕES DE SISTEMA:
      - Data de hoje: ${dataFormatadaPT} (Formato ISO: ${dataAtual}).
      
      DADOS ATUAIS DO USUÁRIO (Base de Conhecimento):
      - Últimas Transações Financeiras: ${resumoFinanceiro}
      - Eventos na Agenda (Hoje e Futuro): ${resumoAgenda}
      
      IMPORTANTE: Se o usuário perguntar sobre a agenda de hoje, olhe nos 'Eventos na Agenda' e use a função "conversar" para descrever os compromissos marcados para a data ${dataAtual}. Se estiver vazio, informe que o dia está livre.

      DIRETRIZES ESTUDADAS PARA SÍNTESE DE VOZ:
      Como suas respostas serão lidas por um motor de voz automatizado, você deve obedecer estritamente às seguintes regras na função "conversar":
      1. NUNCA use formatação markdown (sem asteriscos, sem sublinhados, sem hashtags).
      2. NUNCA use emojis ou caracteres especiais.
      3. ESCREVA NÚMEROS E SÍMBOLOS POR EXTENSO (Exemplo: "R$ 1717,00" vira "mil setecentos e dezessete reais", "18:00" vira "dezoito horas").
      
      O usuário vai te dar um comando ou fazer uma pergunta.
      Sua tarefa é extrair a intenção e retornar APENAS um JSON estrito no seguinte formato:
      
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      Funções disponíveis:
      - "registrar_peso" -> argumentos: "peso" (número)
      - "adicionar_despesa" -> argumentos: "valor" (número), "descricao" (string), "categoria" (string)
      - "iniciar_pomodoro" -> argumentos: "minutos" (número)
      - "adicionar_agenda" -> argumentos: "titulo" (string), "descricao" (string), "data" (YYYY-MM-DD), "hora" (HH:MM ou null), "categoria" (string)
      - "conversar" -> argumentos: "resposta" (string formatada perfeitamente para leitura em áudio, sem símbolos)

      Comando do usuário: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    let respostaTexto = result.response.text();
    
    respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const comandoEstruturado = JSON.parse(respostaTexto);
    
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      let mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos);
      mensagemRetorno = mensagemRetorno.replace(/[*_#~]/g, '');
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Desculpe, senhor. Reconheci o comando, mas meus protocolos não possuem essa função." };
    }

  } catch (error) {
    console.error("Erro na IA:", error);
    return { sucesso: false, mensagem: "Houve uma falha na minha rede neural ao processar o seu pedido, senhor." };
  }
}
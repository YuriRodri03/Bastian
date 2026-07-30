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
      model: "gemini-flash-latest", // Recomendo usar a nomenclatura atualizada
      generationConfig: { responseMimeType: "application/json" }
    });

    const dataAtual = new Date().toLocaleDateString('en-CA'); 
    const dataFormatadaPT = new Date().toLocaleDateString('pt-BR');

    // =========================================================================
    // 1. INJEÇÃO DE CONTEXTO (A "Memória" RAM do Bastian)
    // Vamos buscar os dados reais das suas stores antes de chamar a IA.
    // DICA: Ajuste os nomes "transactions" e "items" para os nomes exatos
    // que o senhor declarou dentro do Zustand e do Supabase.
    // =========================================================================
    
    // Captura Finanças (Exemplo: apenas as transações do mês atual para não estourar o limite de tokens)
    const transacoes = useFinanceStore.getState().transactions || [];
    const resumoFinanceiro = JSON.stringify(transacoes.slice(-15)); // Manda só as 15 últimas movimentações
    
    // Captura Agenda (Exemplo: eventos futuros)
    const eventosAgenda = useAgendaStore.getState().items || [];
    const resumoAgenda = JSON.stringify(eventosAgenda.filter(e => e.date >= dataAtual));

    // =========================================================================
    // 2. O NOVO PROMPT CIENTE DO CONTEXTO
    // =========================================================================
    const prompt = `
      Você é "Bastian", a IA assistente pessoal avançada do "Centro de Comando" (inspirado no J.A.R.V.I.S).
      Seu criador e usuário é o senhor Yuri. Sua personalidade é educada, altamente eficiente, um pouco sarcástica.
      
      INFORMAÇÕES DE SISTEMA:
      - Data de hoje: ${dataFormatadaPT} (Formato ISO: ${dataAtual}).
      
      DADOS ATUAIS DO USUÁRIO (Base de Conhecimento):
      - Últimas Transações Financeiras: ${resumoFinanceiro}
      - Próximos Eventos na Agenda: ${resumoAgenda}
      
      DIRETRIZES ESTUDADAS PARA SÍNTESE DE VOZ (MUITO IMPORTANTE):
      Como suas respostas serão lidas por um motor de voz automatizado, você deve obedecer estritamente às seguintes regras na função "conversar":
      1. NUNCA use formatação markdown (sem asteriscos, sem sublinhados, sem hashtags).
      2. NUNCA use emojis ou caracteres especiais.
      3. ESCREVA NÚMEROS POR EXTENSO ou de forma corrida sem pontos de milhar. (Exemplo: em vez de "R$ 1.717,00", escreva "mil setecentos e dezessete reais" ou "1717 reais". Em vez de "1,5 kg", escreva "um quilo e meio").
      
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
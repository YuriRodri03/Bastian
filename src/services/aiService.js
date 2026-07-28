import { GoogleGenerativeAI } from "@google/generative-ai";
// Importe suas stores do Zustand
import { useFitnessStore } from '../store/useFitnessStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 

// Inicializa a IA com a sua chave
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Dicionário de ações que o seu App sabe fazer
const AcoesDoSistema = {
  registrar_peso: (args) => {
    // Acessa a função da store diretamente
    useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', args.peso, 'kg');
    return `⚖️ Peso de ${args.peso}kg atualizado com sucesso, senhor.`;
  },
  
  adicionar_despesa: (args) => {
    const { addTransaction } = useFinanceStore.getState(); 
    
    // Mapeando exatamente para o formato da sua tabela no Supabase
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

    // Mapeando para as colunas da sua tabela agenda_items
    addAgendaItem({
      title: args.titulo,
      description: args.descricao || null,
      date: args.data, // O Gemini enviará no formato YYYY-MM-DD
      // Se houver hora, adiciona os segundos (HH:MM:00) para evitar problemas no tipo time do banco
      time: args.hora ? `${args.hora}:00` : null, 
      category: args.categoria || 'Geral'
    });

    const msgHora = args.hora ? ` às ${args.hora}` : '';
    // Invertendo a data de YYYY-MM-DD para DD/MM/YYYY só para a mensagem visual ficar mais amigável
    const dataFormatada = args.data.split('-').reverse().join('/');
    
    return `📅 Entendido, senhor. "${args.titulo}" foi adicionado aos seus compromissos para ${dataFormatada}${msgHora}.`;
  },
  
  iniciar_pomodoro: (args) => {
    // Lógica para iniciar seu timer (quando você tiver a store do Pomodoro)
    return `🍅 Pomodoro de ${args.minutos} minutos ativado. Modo de foco iniciado.`;
  },

  // NOVO: Função para o Bastian bater papo e responder perguntas normais
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

    const dataAtual = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const dataFormatadaPT = new Date().toLocaleDateString('pt-BR');

    const prompt = `
      Você é "Bastian", a IA assistente pessoal avançada do "Centro de Comando" (inspirado no J.A.R.V.I.S).
      Seu criador e usuário é o senhor Yuri. Sua personalidade é educada, altamente eficiente, um pouco sarcástica, e você sempre se refere a ele como "senhor Yuri" ou apenas "senhor".
      Hoje é dia ${dataFormatadaPT} (Formato sistema: ${dataAtual}).
      
      O usuário vai te dar um comando em linguagem natural.
      Sua tarefa é extrair a intenção e retornar APENAS um JSON estrito no seguinte formato:
      
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      Regra importante:
      Se o usuário pedir para registrar despesa, peso, agenda ou pomodoro, use a função correspondente.
      Se o usuário fizer uma pergunta genérica, disser "olá", testar o microfone, ou quiser apenas bater papo, USE A FUNÇÃO "conversar" e crie uma resposta verbal curta, direta e com a sua personalidade J.A.R.V.I.S.

      Funções disponíveis:
      1. "registrar_peso" -> argumentos: "peso" (número)
      2. "adicionar_despesa" -> argumentos: "valor" (número), "descricao" (string), "categoria" (string)
      3. "iniciar_pomodoro" -> argumentos: "minutos" (número)
      4. "adicionar_agenda" -> argumentos: "titulo" (string), "descricao" (string), "data" (string no formato YYYY-MM-DD baseada no dia de hoje), "hora" (string no formato HH:MM ou null), "categoria" (string)
      5. "conversar" -> argumentos: "resposta" (string com a sua resposta conversada)

      Comando do usuário: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    let respostaTexto = result.response.text();
    
    // CORREÇÃO DE BUG: Remove blocos de markdown que o Gemini às vezes envia e quebram o código
    respostaTexto = respostaTexto.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Converte a string JSON da IA em um objeto JavaScript
    const comandoEstruturado = JSON.parse(respostaTexto);
    
    // Verifica se a função existe no nosso dicionário e a executa
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      const mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos);
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Desculpe, senhor. Reconheci o comando, mas meus protocolos não possuem essa função." };
    }

  } catch (error) {
    console.error("Erro na IA:", error);
    return { sucesso: false, mensagem: "Houve uma falha na minha rede neural ao processar o seu pedido, senhor." };
  }
}
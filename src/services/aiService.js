import { GoogleGenerativeAI } from "@google/generative-ai";
// Importe suas stores do Zustand
import { useFitnessStore } from '../store/useFitnessStore';
import { useFinanceStore } from '../store/useFinanceStore';
// NOVO: Importe a store da Agenda (Ajuste o caminho/nome se precisar)
import { useAgendaStore } from '../store/useAgendaStore'; 

// Inicializa a IA com a sua chave
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Dicionário de ações que o seu App sabe fazer
const AcoesDoSistema = {
  registrar_peso: (args) => {
    // Acessa a função da store diretamente
    useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', args.peso, 'kg');
    return `⚖️ Peso de ${args.peso}kg atualizado com sucesso!`;
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

    return `💸 Despesa de R$ ${args.valor} (${args.descricao}) registrada!`;
  },

  // NOVO: Ação para lidar com a Agenda
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
      // id, user_id, created_at, e is_completed são definidos pelo banco
    });

    const msgHora = args.hora ? ` às ${args.hora}` : '';
    // Invertendo a data de YYYY-MM-DD para DD/MM/YYYY só para a mensagem visual ficar mais amigável
    const dataFormatada = args.data.split('-').reverse().join('/');
    
    return `📅 "${args.titulo}" anotado para ${dataFormatada}${msgHora}!`;
  },
  
  iniciar_pomodoro: (args) => {
    // Lógica para iniciar seu timer (quando você tiver a store do Pomodoro)
    return `🍅 Pomodoro de ${args.minutos} minutos ativado. Foco total!`;
  }
};

export async function enviarComandoParaIA(comandoTexto) {
  try {
    // Usando o modelo super rápido e recente
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" }
    });

    // Pega a data local de hoje no formato YYYY-MM-DD para dar contexto à IA
    // Assim, quando você disser "amanhã", ela sabe calcular a data exata!
    const dataAtual = new Date().toLocaleDateString('en-CA'); 

    const prompt = `
      Você é a IA assistente do "Centro de Comando".
      Hoje é dia ${dataAtual}.
      O usuário vai te dar um comando em linguagem natural.
      Sua tarefa é extrair a intenção e retornar APENAS um JSON estrito no seguinte formato:
      
      {
        "funcao": "nome_da_funcao",
        "argumentos": { ... }
      }

      Funções disponíveis:
      1. "registrar_peso" -> argumentos: "peso" (número)
      2. "adicionar_despesa" -> argumentos: "valor" (número), "descricao" (string), "categoria" (string)
      3. "iniciar_pomodoro" -> argumentos: "minutos" (número)
      4. "adicionar_agenda" -> argumentos: "titulo" (string), "descricao" (string), "data" (string no formato YYYY-MM-DD baseada no dia de hoje), "hora" (string no formato HH:MM ou null se não especificado), "categoria" (string)

      Comando do usuário: "${comandoTexto}"
    `;

    const result = await model.generateContent(prompt);
    const respostaTexto = result.response.text();
    
    // Converte a string JSON da IA em um objeto JavaScript
    const comandoEstruturado = JSON.parse(respostaTexto);
    
    // Verifica se a função existe no nosso dicionário e a executa
    if (AcoesDoSistema[comandoEstruturado.funcao]) {
      const mensagemRetorno = AcoesDoSistema[comandoEstruturado.funcao](comandoEstruturado.argumentos);
      return { sucesso: true, mensagem: mensagemRetorno };
    } else {
      return { sucesso: false, mensagem: "Entendi o comando, mas ainda não sei executar essa ação." };
    }

  } catch (error) {
    console.error("Erro na IA:", error);
    return { sucesso: false, mensagem: "Falha ao processar o comando com a IA." };
  }
}
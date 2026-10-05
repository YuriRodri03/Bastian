// src/services/liveAiService.js

export class GeminiLiveConnection {
  constructor(onAudioChunk, onTextChunk, onFunctionCall) {
    this.ws = null;
    this.onAudioChunk = onAudioChunk; 
    this.onTextChunk = onTextChunk;   
    this.onFunctionCall = onFunctionCall; 
    this.API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    this.HOST = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.API_KEY}`;
  }

  conectar(contextoDoSistema = "") {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.HOST);

      this.ws.onopen = () => {
        console.log("[Bastian Core] Tubo Neural Aberto. Injetando Ferramentas Unificadas...");
        this.enviarConfiguracaoInicial(contextoDoSistema);
        resolve(true);
      };

      this.ws.onmessage = (evento) => {
        this.processarResposta(evento.data);
      };

      this.ws.onerror = (erro) => {
        console.error("[Bastian Core] Erro no WebSocket:", erro);
        reject(erro);
      };

      this.ws.onclose = () => {
        console.log(`[Bastian Core] Conexão Encerrada.`);
      };
    });
  }

  enviarConfiguracaoInicial(contextoDoSistema) {
    const fusoLocal = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const horaLocal = new Date().toLocaleString('pt-BR');

    const setupMensagem = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio-latest", 
        
        systemInstruction: {
          parts: [{ 
            text: `Você é Bastian, um assistente virtual pessoal e executivo.
            Seu usuário é Yuri, mestrando em economia. Trate-o com respeito, sendo analítico e elegante.
            
            [CONTEXTO DE ESPAÇO-TEMPO]
            Localização: Fortaleza, CE. Data e hora exata: ${horaLocal} (Fuso: ${fusoLocal}).
            
            [DADOS DO SISTEMA ATUAL]
            ${contextoDoSistema}
            
            [REGRAS DE CONVERSA E AÇÃO]
            - NUNCA verbalize, escreva ou narre o seu processo de pensamento, justificativas ou análises internas. Entregue APENAS a resposta final.
            - Responda de forma direta, concisa e natural em Português do Brasil.
            - NUNCA utilize formatação Markdown.
            - Você possui ferramentas unificadas de banco de dados. Sempre que o usuário pedir para registrar, alterar, concluir ou deletar algo (finanças, agenda, peso, tarefas, kanban), chame a ferramenta correspondente ANTES de responder.
            - Construa o JSON adequadamente na ferramenta de acordo com o contexto da solicitação.`
          }]
        },

        // Ferramentas consolidadas - o "Canivete Suíço"
        tools: [
          {
            functionDeclarations: [
              {
                name: "registrar_dado",
                description: "Salva qualquer novo registro no sistema (finanças, peso, treino, tarefas, agenda).",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: { 
                      type: "STRING", 
                      description: "Onde salvar. Valores permitidos: 'despesa', 'receita', 'peso', 'treino', 'inbox', 'agenda', 'kanban'." 
                    },
                    payload_json: { 
                      type: "STRING", 
                      description: "Uma string em formato JSON contendo os dados estruturados a serem salvos. Ex: '{\"valor\": 50, \"descricao\": \"Uber\", \"categoria\": \"Transporte\"}'" 
                    }
                  },
                  required: ["entidade", "payload_json"]
                }
              },
              {
                name: "alterar_dado",
                description: "Conclui, atualiza ou deleta um registro existente na Memória.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: { type: "STRING", description: "Valores permitidos: 'concluir', 'deletar', 'atualizar'" },
                    entidade: { type: "STRING", description: "Onde alterar ('inbox', 'agenda', 'financas', 'kanban')" },
                    id: { type: "STRING", description: "O ID exato lido na sua Memória Atual." },
                    novo_payload_json: { type: "STRING", description: "Se a ação for 'atualizar', passe o JSON em string com os novos dados." }
                  },
                  required: ["acao", "entidade", "id"]
                }
              },
              {
                name: "consultar_dados",
                description: "Lê relatórios gerais ou busca informações no banco de dados.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: { type: "STRING", description: "Qual módulo consultar ('relatorio_diario', 'financas', 'agenda')." }
                  },
                  required: ["entidade"]
                }
              }
            ]
          }
        ],
        
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Charon" }
            }
          }
        }
      }
    };
    this.ws.send(JSON.stringify(setupMensagem));
  }

  enviarAudioVoz(base64Audio) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Audio }] }
      }));
    }
  }

  enviarComandoSilencioso(texto) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: { turns: [{ role: "user", parts: [{ text: texto }] }], turnComplete: true }
      }));
    }
  }

  // Usado quando o VAD detecta que o usuário parou de falar
  forcarResposta() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  }

  // NOVO: Corta a fala atual da IA se o usuário interromper
  interromperGeracao() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Enviar um clientContent vazio retoma o controle para o usuário instantaneamente
      this.ws.send(JSON.stringify({
        clientContent: { turns: [{ role: "user", parts: [] }], turnComplete: false }
      }));
    }
  }

  // Como deve ser chamado no Frontend para garantir agilidade
  enviarRespostaDeFuncao(idChamada, nomeFuncao, resultado) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = {
        toolResponse: {
          functionResponses: [{
            id: idChamada,
            name: nomeFuncao,
            response: { result: resultado } // Pode enviar algo fixo para não esperar o BD
          }]
        }
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  processarResposta(dados) {
    const interpretarJSON = (texto) => {
      try {
        const resposta = JSON.parse(texto);
        if (resposta.error) return;

        if (resposta.serverContent && resposta.serverContent.modelTurn) {
          const partes = resposta.serverContent.modelTurn.parts;
          partes.forEach(parte => {
            if (parte.inlineData && parte.inlineData.data) this.onAudioChunk(parte.inlineData.data);
            if (parte.text) this.onTextChunk(parte.text);
            if (parte.functionCall) this.onFunctionCall(parte.functionCall);
          });
        }
      } catch (e) {}
    };

    if (dados instanceof Blob) dados.text().then(interpretarJSON);
    else interpretarJSON(dados);
  }

  desconectar() {
    if (this.ws) this.ws.close();
  }
}
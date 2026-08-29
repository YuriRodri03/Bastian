// src/services/liveAiService.js

export class GeminiLiveConnection {
  constructor(onAudioChunk, onTextChunk, onFunctionCall) {
    this.ws = null;
    this.onAudioChunk = onAudioChunk; 
    this.onTextChunk = onTextChunk;   
    this.onFunctionCall = onFunctionCall; // NOVO: O canal para rodar as funções do app
    this.API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    this.HOST = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.API_KEY}`;
  }

  conectar() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.HOST);

      this.ws.onopen = () => {
        console.log("[Bastian Core] Tubo Neural Aberto. Injetando Ferramentas...");
        this.enviarConfiguracaoInicial();
        resolve(true);
      };

      this.ws.onmessage = (evento) => {
        this.processarResposta(evento.data);
      };

      this.ws.onerror = (erro) => {
        console.error("[Bastian Core] Erro no WebSocket:", erro);
        reject(erro);
      };

      this.ws.onclose = (evento) => {
        console.log(`[Bastian Core] Conexão Encerrada. Código: ${evento.code}`);
      };
    });
  }

  enviarConfiguracaoInicial() {
    // 1. Capturamos o tempo e o espaço exatos do seu navegador
    const fusoLocal = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const horaLocal = new Date().toLocaleString('pt-BR');

    const setupMensagem = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio-latest", 
        
        systemInstruction: {
          parts: [{ 
            text: `Você é Bastian, um assistente virtual pessoal estilo J.A.R.V.I.S.
            
            [CONTEXTO DE ESPAÇO-TEMPO]
            O usuário está localizado em Fortaleza, Ceará, Brasil. 
            A data e hora exata agora é: ${horaLocal} (Fuso: ${fusoLocal}). Use essas informações se for perguntado sobre o tempo.
            
            [REGRAS DE LATÊNCIA E VAD]
            Responda IMEDIATAMENTE após o usuário fazer a pergunta. Seja extremamente conciso, curto e objetivo para diminuir o tempo de processamento.
            O usuário falará EXCLUSIVAMENTE em Português do Brasil. NUNCA utilize formatação Markdown.
            
            [FERRAMENTAS]
            Se o usuário pedir para adicionar um gasto ou evento, acione a ferramenta imediatamente.`
          }]
        },

        tools: [
          {
            functionDeclarations: [
              {
                name: "adicionarGasto",
                description: "Adiciona um novo gasto ou despesa financeira no aplicativo.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    descricao: { type: "STRING", description: "O que foi comprado ou pago." },
                    valor: { type: "NUMBER", description: "O valor numérico do gasto." }
                  },
                  required: ["descricao", "valor"]
                }
              },
              {
                name: "adicionarEvento",
                description: "Adiciona um evento, lembrete ou compromisso na agenda do aplicativo.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING", description: "O título ou nome do evento." },
                    detalhes: { type: "STRING", description: "Data, hora ou informações extras ditas pelo usuário." }
                  },
                  required: ["titulo"]
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
      const realTimeInput = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: "audio/pcm;rate=16000",
            data: base64Audio
          }]
        }
      };
      this.ws.send(JSON.stringify(realTimeInput));
    }
  }

  // NOVO: Função para devolver o resultado do banco de dados para a IA
  enviarRespostaDeFuncao(idChamada, nomeFuncao, resultado) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const functionResponseMsg = {
        clientContent: {
          turnComplete: true, // Diz para a IA que ela já pode falar o resultado final
          parts: [{
            functionResponse: {
              id: idChamada,
              name: nomeFuncao,
              response: { result: resultado }
            }
          }]
        }
      };
      this.ws.send(JSON.stringify(functionResponseMsg));
    }
  }

  processarResposta(dados) {
    const interpretarJSON = (texto) => {
      try {
        const resposta = JSON.parse(texto);
        
        if (resposta.error) return console.error("[Bastian API] Erro:", resposta.error.message);

        if (resposta.serverContent && resposta.serverContent.modelTurn) {
          const partes = resposta.serverContent.modelTurn.parts;
          partes.forEach(parte => {
            if (parte.inlineData && parte.inlineData.data) {
              this.onAudioChunk(parte.inlineData.data);
            }
            if (parte.text) {
              this.onTextChunk(parte.text);
            }
            // NOVO: O Google pediu para rodar uma função!
            if (parte.functionCall) {
              console.log("[Bastian Core] A IA solicitou a ferramenta:", parte.functionCall.name);
              this.onFunctionCall(parte.functionCall);
            }
          });
        }
      } catch (e) {
        console.error("[Bastian Core] Falha no pacote:", e);
      }
    };

    if (dados instanceof Blob) {
      dados.text().then(interpretarJSON);
    } else {
      interpretarJSON(dados);
    }
  }

  desconectar() {
    if (this.ws) this.ws.close();
  }
}
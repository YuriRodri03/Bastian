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
        console.log("[Bastian Core] Tubo Neural Aberto.");
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
            Seu usuário é Yuri, mestrando em economia.
            
            [CONTEXTO DE ESPAÇO-TEMPO]
            Localização: Fortaleza, CE. Data e hora exata: ${horaLocal} (Fuso: ${fusoLocal}).
            
            [DADOS DO SISTEMA ATUAL]
            ${contextoDoSistema}
            
            [REGRAS DE CONVERSA E AÇÃO]
            - Responda de forma direta, concisa e natural em Português do Brasil.
            - NUNCA utilize formatação Markdown.
            - AO LER RELATÓRIOS: Seja extremamente direto. Fale os totais e faça um resumo executivo rápido. NUNCA leia listas item por item a menos que o usuário exija explicitamente.
            - Sempre chame a ferramenta de banco de dados correspondente ANTES de responder.`
          }]
        },

        tools: [
          {
            functionDeclarations: [
              {
                name: "registrar_dado",
                description: "Salva qualquer novo registro no sistema.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: { type: "STRING", description: "'despesa', 'receita', 'peso', 'treino', 'inbox', 'agenda', 'kanban'." },
                    payload_json: { type: "STRING", description: "Dados estruturados em JSON." }
                  },
                  required: ["entidade", "payload_json"]
                }
              },
              {
                name: "alterar_dado",
                description: "Conclui, atualiza ou deleta um registro existente.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: { type: "STRING", description: "'concluir', 'deletar', 'atualizar'" },
                    entidade: { type: "STRING", description: "'inbox', 'agenda', 'financas', 'kanban'" },
                    id: { type: "STRING", description: "ID exato." }
                  },
                  required: ["acao", "entidade", "id"]
                }
              },
              {
                name: "consultar_dados",
                description: "Busca informações no banco de dados.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: { type: "STRING", description: "Qual módulo consultar: 'financas', 'agenda', 'inbox', 'kanban', 'geral'." }
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
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } }
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

  forcarResposta() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  }

  // CORRIGIDO: Agora avisa a API corretamente para interromper sem confundi-la
  interromperGeracao() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        clientContent: { turnComplete: false } // Apenas avisa que o usuário tomou a palavra
      }));
    }
  }

  enviarRespostaDeFuncao(idChamada, nomeFuncao, resultado) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = {
        toolResponse: {
          functionResponses: [{
            id: idChamada,
            name: nomeFuncao,
            response: { result: resultado } 
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
// src/services/liveAiService.js

export class GeminiLiveConnection {
  constructor(onAudioChunk, onTextChunk) {
    this.ws = null;
    this.onAudioChunk = onAudioChunk; 
    this.onTextChunk = onTextChunk;   
    this.API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    this.HOST = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.API_KEY}`;
  }

  conectar() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.HOST);

      this.ws.onopen = () => {
        console.log("[Bastian Core] Tubo de Conexão Neural Aberto. Enviando credenciais...");
        this.enviarConfiguracaoInicial();
        resolve(true);
      };

      this.ws.onmessage = (evento) => {
        this.processarResposta(evento.data);
      };

      this.ws.onerror = (erro) => {
        console.error("[Bastian Core] Erro bruto no WebSocket:", erro);
        reject(erro);
      };

      this.ws.onclose = (evento) => {
        console.log(`[Bastian Core] Conexão Encerrada. Código: ${evento.code}`);
      };
    });
  }

  enviarConfiguracaoInicial() {
    const setupMensagem = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio-latest", 
        
        systemInstruction: {
          parts: [{ 
            text: "Você é Bastian, um assistente virtual pessoal estilo J.A.R.V.I.S., direto, elegante e objetivo. Você opera EXCLUSIVAMENTE em Português do Brasil. NUNCA responda em inglês. NUNCA utilize formatação Markdown, títulos, asteriscos, numerações ou tópicos no seu texto; forneça apenas sentenças diretas em linguagem natural e contínua." 
          }]
        },
        
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Charon"
              }
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

  processarResposta(dados) {
    const interpretarJSON = (texto) => {
      try {
        const resposta = JSON.parse(texto);
        
        if (resposta.error) {
          console.error("[Bastian API] Erro dentro do Tubo:", resposta.error.message);
          return;
        }

        if (resposta.serverContent && resposta.serverContent.modelTurn) {
          const partes = resposta.serverContent.modelTurn.parts;
          partes.forEach(parte => {
            if (parte.inlineData && parte.inlineData.data) {
              this.onAudioChunk(parte.inlineData.data);
            }
            if (parte.text) {
              this.onTextChunk(parte.text);
            }
          });
        }
      } catch (e) {
        console.error("[Bastian Core] Falha ao traduzir o pacote:", e);
      }
    };

    if (dados instanceof Blob) {
      dados.text().then(interpretarJSON);
    } else {
      interpretarJSON(dados);
    }
  }

  desconectar() {
    if (this.ws) this.ws.close(1000, "Desligamento manual pelo usuário.");
  }
}
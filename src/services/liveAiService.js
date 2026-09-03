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
        console.log("[Bastian Core] Tubo Neural Aberto. Injetando Ferramentas...");
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
            - Responda de forma direta, concisa e natural em Português do Brasil.
            - NUNCA utilize formatação Markdown.
            - Sempre que o usuário der uma ordem que corresponda a uma de suas ferramentas (ex: "adicione 50 reais de gasolina", "agende um estudo", "peso de hoje é 80", "coloque no kanban para ler o artigo"), chame a função ANTES de responder.
            - Para concluir uma tarefa ou compromisso, olhe o ID correspondente na sua Memória Atual e use a ferramenta 'concluir_tarefa'.
            - Para excluir algo ou editar, use 'deletar_registro' (e no caso de edição, recrie com os dados novos em seguida).`
          }]
        },

        tools: [
          {
            functionDeclarations: [
              {
                name: "relatorio_diario",
                description: "Lê a memória de curto prazo (Agenda, Finanças, Tarefas) para informar o usuário sobre o dia."
              },
              {
                name: "adicionar_despesa",
                description: "Registra uma despesa ou gasto no sistema financeiro.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    valor: { type: "NUMBER", description: "O valor numérico (ex: 50.00)." },
                    descricao: { type: "STRING", description: "Descrição do gasto (ex: 'Uber', 'Almoço')." },
                    categoria: { type: "STRING", description: "Categoria (Alimentação, Transporte, Saúde, Educação, Outros)." }
                  },
                  required: ["valor", "descricao"]
                }
              },
              {
                name: "adicionar_receita",
                description: "Registra um dinheiro recebido no caixa.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    valor: { type: "NUMBER", description: "O valor numérico." },
                    descricao: { type: "STRING", description: "Origem da receita." },
                    categoria: { type: "STRING", description: "Categoria (Salário, Bolsa, Freelance, Outros)." }
                  },
                  required: ["valor", "descricao"]
                }
              },
              {
                name: "adicionar_agenda",
                description: "Marca um compromisso no calendário.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING", description: "O nome do compromisso." },
                    data: { type: "STRING", description: "Data no formato YYYY-MM-DD. Use o contexto de tempo para calcular 'hoje' ou 'amanhã'." },
                    hora: { type: "STRING", description: "Hora no formato HH:MM (ex: '14:30')." }
                  },
                  required: ["titulo", "data"]
                }
              },
              {
                name: "registrar_peso",
                description: "Salva o registro de pesagem corporal.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    peso: { type: "NUMBER", description: "Valor do peso em kg." }
                  },
                  required: ["peso"]
                }
              },
              {
                name: "adicionar_treino",
                description: "Registra um exercício físico realizado.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    modalidade: { type: "STRING", description: "Tipo de treino (Musculação, Corrida, etc)." },
                    duracao: { type: "NUMBER", description: "Duração total em minutos." }
                  },
                  required: ["modalidade", "duracao"]
                }
              },
              {
                name: "adicionar_tarefa_inbox",
                description: "Coloca uma lembrança ou pendência na Caixa de Entrada.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING", description: "A tarefa em si." },
                    data: { type: "STRING", description: "Data limite YYYY-MM-DD, se fornecida." }
                  },
                  required: ["titulo"]
                }
              },
              {
                name: "adicionar_kanban",
                description: "Cria um cartão no projeto Kanban.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING", description: "O que deve ser feito." },
                    status: { type: "STRING", description: "Em qual coluna entrar ('backlog', 'todo', 'in_progress', 'done'). Padrão é 'backlog'." }
                  },
                  required: ["titulo"]
                }
              },
              {
                name: "concluir_tarefa",
                description: "Marca uma tarefa da Caixa de Entrada (Inbox) ou compromisso da Agenda como concluído.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "O ID exato da tarefa fornecido na Memória Atual." },
                    origem: { type: "STRING", description: "Escreva 'inbox' se for da Caixa de Entrada, ou 'agenda' se for um compromisso." }
                  },
                  required: ["id", "origem"]
                }
              },
              // A NOVA FERRAMENTA DE EXCLUSÃO (DELETAR/EDITAR)
              {
                name: "deletar_registro",
                description: "Apaga um registro existente do banco de dados (finanças, agenda, inbox, kanban). Use o ID exato lido na sua Memória.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "O ID único do registro a ser apagado." },
                    modulo: { type: "STRING", description: "O módulo do registro: 'financeiro', 'agenda', 'inbox' ou 'kanban'." }
                  },
                  required: ["id", "modulo"]
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

  forcarResposta() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  }

  enviarRespostaDeFuncao(idChamada, nomeFuncao, resultado) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = {
        clientContent: {
          turnComplete: true, 
          parts: [{ functionResponse: { id: idChamada, name: nomeFuncao, response: { result: resultado } } }]
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
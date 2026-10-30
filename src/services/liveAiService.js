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

      this.ws.onclose = (ev) => {
        console.log(`[Bastian Core] Conexão Encerrada (Código: ${ev.code}).`);
      };
    });
  }

  enviarConfiguracaoInicial(contextoDoSistema) {
    const fusoLocal = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const agora = new Date();
    const horaLocal = agora.toLocaleString('pt-BR');
    const dataIsoHoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;

    const setupMensagem = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio-latest",

        systemInstruction: {
          parts: [
            {
              text: `Você é Bastian, o assistente executivo, estrategista de produtividade, consultor financeiro e treinador de performance pessoal de Yuri Rodrigues (mestrando em economia no CAEN/UFC e desenvolvedor full-stack).

[CONTEXTO DE ESPAÇO-TEMPO]
Localização: Fortaleza, CE.
Data e hora exata: ${horaLocal} (Data ISO de Hoje: ${dataIsoHoje} | Fuso: ${fusoLocal}).

[SNAPSHOT ATUAL DO SISTEMA DO YURI]
${contextoDoSistema || "Use a ferramenta consultar_dados se precisar ler dados atualizados."}

[DIRETRIZES DE ATUAÇÃO]
1. CONSULTORIA FINANCEIRA E PRODUTIVIDADE:
   - Quando o Yuri pedir sua opinião ou análise (ex: "quanto posso guardar na reserva?", "como está minha semana?", "analise meus treinos"), NUNCA diga que não tem função para isso!
   - Analise os números do SNAPSHOT (ou chame 'consultar_dados') e dê recomendações precisas com valores e estratégia.
2. GESTÃO COMPLETA DE TREINOS, FICHAS E BIOMETRIA (FITNESS):
   - Você tem controle total sobre a página de Treinos do Yuri!
   - Quando o Yuri pedir para CRIAR ou MONTAR um treino/ficha (ex: "cria um treino de pernas", "monta uma ficha de peito e ombro", "cria um treino para hoje"), chame IMEDIATAMENTE a ferramenta 'registrar_dado' com entidade: 'ficha_treino', passando o 'titulo' da ficha e o array 'exercicios' (cada exercício com 'nome', 'series', 'reps', 'carga').
   - Contexto de treino do Yuri: caso ele não especifique equipamentos de academia, lembre-se que ele treina em casa focado em hipertrofia e calistenia (30-45 min), dispondo de 2 halteres de 10kg (total 20kg), peso corporal e corda de pular. Monte fichas inteligentes e intensas!
   - Se ele disser que JÁ TREINOU ou CONCLUIU uma ficha/treino hoje (ex: "concluí o Treino A", "registra que treinei costas por 45 min"), use 'registrar_dado' com entidade: 'treino' (ou 'alterar_dado' com acao: 'concluir' e entidade: 'ficha_treino').
   - Para peso corporal use entidade: 'peso'. Para medidas (Bíceps Dir., Bíceps Esq., Peitoral, Cintura, Coxa Dir., Coxa Esq.) use entidade: 'medida'.
3. TAREFAS, AGENDA E FINANÇAS:
   - 'inbox': Tarefas do dia a dia.
   - 'agenda': Compromissos com data e/ou hora.
   - 'kanban': Projetos ('backlog', 'in-progress', 'done').
   - 'despesa' / 'receita': Lançamentos financeiros.
4. TOM DE VOZ:
   - Português do Brasil, inteligente, parceiro, direto e conciso (2 a 4 frases na fala).`
            }
          ]
        },

        tools: [
          {
            functionDeclarations: [
              {
                name: "registrar_dado",
                description: "Cria e salva qualquer novo registro no sistema: ficha de treino completa (ficha_treino), treino concluído (treino), peso corporal (peso), medida corporal (medida), tarefa (inbox), compromisso (agenda), projeto (kanban), receita ou despesa.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      description: "Valores permitidos: 'ficha_treino', 'treino', 'peso', 'medida', 'inbox', 'agenda', 'kanban', 'despesa', 'receita'."
                    },
                    dados: {
                      type: "OBJECT",
                      description: "Dados estruturados do registro.",
                      properties: {
                        titulo: {
                          type: "STRING",
                          description: "Título da ficha de treino (ex: 'Treino D - Full Body'), nome da medida (ex: 'Peitoral', 'Bíceps Dir.', 'Cintura'), modalidade do treino, ou descrição da tarefa/evento/finança."
                        },
                        valor: {
                          type: "NUMBER",
                          description: "Valor numérico: Reais (para receita/despesa), kg (para peso), cm (para medida) ou minutos de duração (para treino concluído)."
                        },
                        data: {
                          type: "STRING",
                          description: "Data no formato YYYY-MM-DD."
                        },
                        hora: {
                          type: "STRING",
                          description: "Horário no formato HH:MM (para agenda)."
                        },
                        categoria: {
                          type: "STRING",
                          description: "Categoria do evento na agenda ou da transação financeira."
                        },
                        status: {
                          type: "STRING",
                          description: "Para finanças: 'pago' ou 'pendente'. Para kanban: 'backlog', 'in-progress' ou 'done'."
                        },
                        exercicios: {
                          type: "ARRAY",
                          description: "Obrigatório quando entidade for 'ficha_treino'. Lista de exercícios que compõem a ficha.",
                          items: {
                            type: "OBJECT",
                            properties: {
                              nome: { type: "STRING", description: "Nome do exercício (ex: 'Flexão Diamante', 'Desenvolvimento c/ Halteres')." },
                              series: { type: "STRING", description: "Número de séries (ex: '4x', '3x')." },
                              reps: { type: "STRING", description: "Repetições ou tempo (ex: '10-12', '15', '1 min')." },
                              carga: { type: "STRING", description: "Carga utilizada (ex: '10kg', '20kg', 'Peso Corp.')." }
                            },
                            required: ["nome", "series", "reps", "carga"]
                          }
                        }
                      },
                      required: ["titulo"]
                    }
                  },
                  required: ["entidade", "dados"]
                }
              },
              {
                name: "alterar_dado",
                description: "Conclui (dá baixa em tarefa, conta ou ficha de treino), atualiza (edita ficha de treino, kanban, etc.) ou deleta qualquer registro existente.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: {
                      type: "STRING",
                      description: "Valores permitidos: 'concluir', 'deletar', 'atualizar'."
                    },
                    entidade: {
                      type: "STRING",
                      description: "Valores permitidos: 'ficha_treino', 'treino', 'peso', 'medida', 'inbox', 'agenda', 'financas', 'kanban'."
                    },
                    id: {
                      type: "STRING",
                      description: "ID exato ou nome/título do item (ex: 'Treino A', 'Aluguel')."
                    },
                    dados: {
                      type: "OBJECT",
                      description: "Novos dados para atualização (ex: { titulo, valor, status, exercicios })."
                    }
                  },
                  required: ["acao", "entidade", "id"]
                }
              },
              {
                name: "consultar_dados",
                description: "Consulta dados atualizados de finanças, agenda, inbox, kanban ou treino (incluindo fichas de treino, histórico de treinos, peso e medidas).",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      description: "Qual módulo consultar: 'treino', 'financas', 'agenda', 'inbox', 'kanban', 'geral'."
                    }
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
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Audio }]
          }
        })
      );
    }
  }

  enviarComandoSilencioso(texto) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: texto }] }],
            turnComplete: true
          }
        })
      );
    }
  }

  forcarResposta() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
    }
  }

  interromperGeracao() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          clientContent: { turns: [{ role: "user", parts: [] }], turnComplete: true }
        })
      );
    }
  }

  enviarRespostaDeFuncao(idChamada, nomeFuncao, resultadoObj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const safeResponse =
        resultadoObj && typeof resultadoObj === "object" && !Array.isArray(resultadoObj)
          ? resultadoObj
          : { result: resultadoObj };

      const msg = {
        toolResponse: {
          functionResponses: [
            {
              id: idChamada,
              name: nomeFuncao,
              response: safeResponse
            }
          ]
        }
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  processarResposta(dados) {
    const interpretarJSON = (texto) => {
      try {
        const resposta = JSON.parse(texto);
        if (resposta.error) {
          console.error("[Bastian Core] Erro retornado pela API:", resposta.error);
          return;
        }

        if (resposta.serverContent && resposta.serverContent.modelTurn) {
          const partes = resposta.serverContent.modelTurn.parts || [];
          partes.forEach((parte) => {
            if (parte.inlineData && parte.inlineData.data) {
              this.onAudioChunk(parte.inlineData.data);
            }
            if (parte.text) {
              this.onTextChunk(parte.text);
            }
            if (parte.functionCall) {
              this.onFunctionCall(parte.functionCall);
            }
          });
        }

        if (resposta.toolCall && Array.isArray(resposta.toolCall.functionCalls)) {
          resposta.toolCall.functionCalls.forEach((fnCall) => {
            console.log("[Bastian Core] ToolCall recebida:", fnCall.name, fnCall.args);
            this.onFunctionCall(fnCall);
          });
        }
      } catch (e) {
        console.error("[Bastian Core] Falha ao processar pacote JSON:", e);
      }
    };

    if (dados instanceof Blob) dados.text().then(interpretarJSON);
    else interpretarJSON(dados);
  }

  desconectar() {
    if (this.ws) this.ws.close();
  }
}
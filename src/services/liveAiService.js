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
              text: `Você é Bastian, o assistente executivo, consultor financeiro e treinador pessoal de Yuri Rodrigues (mestrando em economia no CAEN/UFC e desenvolvedor full-stack).

[CONTEXTO DE ESPAÇO-TEMPO]
Localização: Fortaleza, CE.
Data e hora exata: ${horaLocal} (Data ISO de Hoje: ${dataIsoHoje} | Fuso: ${fusoLocal}).

[SNAPSHOT ATUAL DO SISTEMA DO YURI]
${contextoDoSistema || "Use a ferramenta consultar_dados se precisar ler dados atualizados."}

[REGRAS CRÍTICAS DE USO DE FERRAMENTAS]
1. CRIAR OU MONTAR FICHAS DE TREINO (PROIBIDO USAR INBOX!):
   - Sempre que o Yuri pedir para "criar um treino", "montar uma ficha", "fazer uma base de treino", "adicionar uma ficha de treino" ou "atualizar exercícios de uma ficha", você DEVE OBRIGATORIAMENTE chamar a ferramenta 'gerenciar_ficha_treino'.
   - NUNCA salve uma ficha de treino como tarefa na 'inbox'!
   - Se o Yuri pedir para você montar uma divisão (ex: "monta um treino A, B e C" ou "cria duas fichas para mim"), chame a ferramenta 'gerenciar_ficha_treino' para cada ficha, preenchendo a lista completa de 'exercicios' (com nome, series, reps e carga).
   - Equipamentos que o Yuri possui em casa: 2 halteres de 10kg (total 20kg), peso corporal (calistenia), barra/apoios e corda de pular.
2. DEMAIS REGISTROS ('registrar_dado'):
   - 'inbox': APENAS tarefas comuns do dia a dia (ex: "ler artigo", "enviar e-mail").
   - 'agenda': Compromissos com data e hora.
   - 'kanban': Projetos ('backlog', 'in-progress', 'done').
   - 'despesa' / 'receita': Finanças.
   - 'treino_concluido': Quando o Yuri disser que JÁ FEZ um treino hoje e quer apenas registrar no histórico.
   - 'peso' / 'medida' / 'sono' / 'humor': Indicadores de saúde e mente.
3. OPINIÃO E CONSULTORIA:
   - Quando perguntado sobre finanças, reserva de emergência, agenda ou treinos, analise os dados do sistema e dê sua opinião técnica e direta.
4. TOM DE VOZ:
   - Português do Brasil, executivo, parceiro e direto (2 a 4 frases na fala).`
            }
          ]
        },

        tools: [
          {
            functionDeclarations: [
              // FERRAMENTA 1: EXCLUSIVA PARA FICHAS DE TREINO (Garante que nunca caia no Inbox)
              {
                name: "gerenciar_ficha_treino",
                description: "Cria uma nova Ficha de Treino completa (com lista de exercícios, séries, repetições e cargas), atualiza uma ficha existente, substitui todas as fichas ou exclui uma ficha na página de Treinos.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: {
                      type: "STRING",
                      enum: ["criar", "atualizar", "deletar", "substituir_todas"],
                      description: "'criar' adiciona uma nova ficha; 'atualizar' edita uma ficha existente; 'deletar' apaga uma ficha; 'substituir_todas' limpa as antigas e cria uma nova base do zero."
                    },
                    titulo: {
                      type: "STRING",
                      description: "Nome da ficha de treino (ex: 'Treino A - Peito, Ombro e Tríceps')."
                    },
                    exercicios: {
                      type: "ARRAY",
                      description: "Lista de exercícios da ficha (obrigatório para 'criar', 'atualizar' ou 'substituir_todas').",
                      items: {
                        type: "OBJECT",
                        properties: {
                          nome: { type: "STRING", description: "Nome do exercício (ex: 'Supino com Halteres', 'Flexão Declinada')." },
                          series: { type: "STRING", description: "Quantidade de séries (ex: '4x', '3x')." },
                          reps: { type: "STRING", description: "Repetições ou tempo (ex: '10-12', '15', '1 min')." },
                          carga: { type: "STRING", description: "Carga sugerida (ex: '10kg', '20kg', 'Peso Corp.')." }
                        },
                        required: ["nome", "series", "reps", "carga"]
                      }
                    }
                  },
                  required: ["acao", "titulo"]
                }
              },

              // FERRAMENTA 2: REGISTROS GERAIS DO SISTEMA
              {
                name: "registrar_dado",
                description: "Salva uma tarefa (inbox), compromisso (agenda), cartão de projeto (kanban), receita, despesa, peso, medida corporal, noite de sono, humor ou treino concluído.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      enum: ["inbox", "agenda", "kanban", "despesa", "receita", "treino_concluido", "peso", "medida", "sono", "humor"],
                      description: "Módulo onde o registro será salvo."
                    },
                    dados: {
                      type: "OBJECT",
                      description: "Dados do item.",
                      properties: {
                        titulo: {
                          type: "STRING",
                          description: "Descrição da tarefa, evento, transação, medida (ex: 'Peitoral', 'Cintura') ou observação."
                        },
                        valor: {
                          type: "NUMBER",
                          description: "Valor em R$ (finanças), kg (peso), cm (medida), horas (sono), nota 1 a 5 (humor) ou minutos (treino_concluido)."
                        },
                        data: {
                          type: "STRING",
                          description: "Data YYYY-MM-DD."
                        },
                        hora: {
                          type: "STRING",
                          description: "Horário HH:MM (para agenda)."
                        },
                        categoria: {
                          type: "STRING",
                          description: "Categoria da agenda ou da transação financeira."
                        },
                        status: {
                          type: "STRING",
                          description: "Para finanças: 'pago' ou 'pendente'. Para kanban: 'backlog', 'in-progress' ou 'done'."
                        }
                      },
                      required: ["titulo"]
                    }
                  },
                  required: ["entidade", "dados"]
                }
              },

              // FERRAMENTA 3: ALTERAR / CONCLUIR / DELETAR REGISTROS
              {
                name: "alterar_dado",
                description: "Conclui (dá baixa em tarefa, conta ou ficha de treino realizada hoje), atualiza ou deleta um item existente.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: {
                      type: "STRING",
                      enum: ["concluir", "deletar", "atualizar"],
                      description: "Ação a executar."
                    },
                    entidade: {
                      type: "STRING",
                      enum: ["ficha_treino", "inbox", "agenda", "financas", "kanban", "treino", "peso", "medida", "sono", "humor"],
                      description: "Módulo alvo."
                    },
                    id: {
                      type: "STRING",
                      description: "ID ou título/nome do item."
                    },
                    dados: {
                      type: "OBJECT",
                      description: "Dados adicionais opcionais."
                    }
                  },
                  required: ["acao", "entidade", "id"]
                }
              },

              // FERRAMENTA 4: CONSULTA ANALÍTICA
              {
                name: "consultar_dados",
                description: "Lê os dados atualizados de finanças, agenda, inbox, kanban ou saúde/treinos.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      enum: ["treino", "financas", "agenda", "inbox", "kanban", "geral"],
                      description: "Qual módulo consultar."
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
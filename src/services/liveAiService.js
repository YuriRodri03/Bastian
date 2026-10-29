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
              text: `Você é Bastian, o assistente executivo, estrategista de produtividade e consultor financeiro pessoal de Yuri Rodrigues (mestrando em economia no CAEN/UFC e desenvolvedor full-stack).

[CONTEXTO DE ESPAÇO-TEMPO]
Localização: Fortaleza, CE.
Data e hora exata: ${horaLocal} (Data ISO de Hoje: ${dataIsoHoje} | Fuso: ${fusoLocal}).
Sempre use ${dataIsoHoje} como referência para calcular "hoje", "amanhã" ou dias da semana.

[SNAPSHOT ATUAL DO SISTEMA DO YURI]
${contextoDoSistema || "Use a ferramenta consultar_dados se precisar ler dados atualizados."}

[COMO AGIR E OPINAR (MUITO IMPORTANTE)]
1. PAPEL CONSULTIVO E OPINIÃO ANALÍTICA:
   - Você NÃO é apenas um gravador de comandos. Quando o Yuri pedir sua opinião, análise ou conselho (ex: "quanto posso guardar na reserva?", "como está minha semana?", "estou gastando muito?", "qual o melhor dia para estudar?"), NUNCA diga que não tem função para isso!
   - Para responder perguntas analíticas: chame a ferramenta 'consultar_dados' (ou analise o SNAPSHOT acima), calcule a diferença entre Receitas, Despesas Pagas e Contas Pendentes, observe os compromissos da agenda e dê uma recomendação inteligente, prática e direta (sugerindo valores exatos para aporte/reserva de emergência ou ajustes de rotina).
2. CRIAÇÃO DE TAREFAS, EVENTOS E FINANÇAS:
   - Sempre que o Yuri pedir para anotar, agendar, lembrar ou criar uma tarefa/compromisso/gasto, chame IMEDIATAMENTE a ferramenta 'registrar_dado'.
   - Diferencie bem:
     * 'inbox': Tarefas do dia a dia ou afazeres sem hora marcada (ex: "lembrar de enviar e-mail", "estudar microeconomia hoje").
     * 'agenda': Compromissos ou aulas com data e/ou horário (ex: "reunião amanhã às 14h", "seminário dia 15").
     * 'kanban': Projetos maiores ou tarefas de desenvolvimento/pesquisa (colunas: 'backlog', 'in-progress', 'done').
     * 'despesa' / 'receita': Movimentações financeiras (se for investimento, use a categoria 'Aporte de Investimento' ou 'Resgate de Investimento').
3. TOM DE VOZ:
   - Fale em Português do Brasil, com tom inteligente, parceiro, executivo e direto ao ponto.
   - Seja conciso na fala (2 a 4 frases), sem ler listas gigantescas item por item, mas entregando os números-chave e sua conclusão.`
            }
          ]
        },

        tools: [
          {
            functionDeclarations: [
              {
                name: "registrar_dado",
                description: "Cria e salva qualquer novo registro no sistema: tarefa (inbox), compromisso (agenda), cartão de projeto (kanban), receita, despesa, treino ou peso.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      description: "Valores permitidos: 'inbox', 'agenda', 'kanban', 'despesa', 'receita', 'treino', 'peso', 'medida'."
                    },
                    dados: {
                      type: "OBJECT",
                      description: "Dados estruturados do item a ser salvo.",
                      properties: {
                        titulo: {
                          type: "STRING",
                          description: "Título ou descrição da tarefa, evento, cartão kanban, treino ou transação financeira."
                        },
                        valor: {
                          type: "NUMBER",
                          description: "Valor numérico em Reais (para receita/despesa), kg (para peso), cm (para medida) ou minutos (para treino)."
                        },
                        data: {
                          type: "STRING",
                          description: "Data no formato YYYY-MM-DD (ex: '2026-10-29'). Se o usuário disser 'hoje', use a data ISO de hoje."
                        },
                        hora: {
                          type: "STRING",
                          description: "Horário no formato HH:MM (ex: '14:30') para itens da 'agenda'."
                        },
                        categoria: {
                          type: "STRING",
                          description: "Para agenda: 'evento', 'aula', 'reuniao', 'tarefa', 'saude', 'financeiro', 'lazer', 'lembrete'. Para finanças: 'Moradia', 'Mercado', 'Alimentação Fora', 'Transporte', 'Contas Fixas', 'Saúde', 'Educação', 'Assinaturas', 'Lazer', 'Cartão de Crédito', 'Aporte de Investimento', 'Salário', 'Bolsa/Auxílio', 'Freelance', 'Outros'."
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
              {
                name: "alterar_dado",
                description: "Conclui (dá baixa), atualiza ou deleta um item existente na inbox, agenda, financas ou kanban.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: {
                      type: "STRING",
                      description: "Valores permitidos: 'concluir', 'deletar', 'atualizar'."
                    },
                    entidade: {
                      type: "STRING",
                      description: "Valores permitidos: 'inbox', 'agenda', 'financas', 'kanban'."
                    },
                    id: {
                      type: "STRING",
                      description: "ID do item (ou parte do título caso o ID não seja conhecido)."
                    },
                    dados: {
                      type: "OBJECT",
                      description: "Campos opcionais para atualizar (titulo, valor, data, hora, status, categoria)."
                    }
                  },
                  required: ["acao", "entidade", "id"]
                }
              },
              {
                name: "consultar_dados",
                description: "Lê os dados atualizados de finanças, saldo, contas a pagar, agenda de compromissos, tarefas da inbox ou kanban para responder perguntas ou dar conselhos/opiniões ao usuário.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      description: "Qual módulo consultar: 'financas', 'agenda', 'inbox', 'kanban', 'treino', 'geral'."
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

  // Envia o retorno da execução da ferramenta de volta para o Gemini continuar a fala
  enviarRespostaDeFuncao(idChamada, nomeFuncao, resultadoObj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Garante que response seja sempre um objeto JSON válido com a chave result
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

        // 1. CAPTURA DE TEXTO E ÁUDIO DO MODELO
        if (resposta.serverContent && resposta.serverContent.modelTurn) {
          const partes = resposta.serverContent.modelTurn.parts || [];
          partes.forEach((parte) => {
            if (parte.inlineData && parte.inlineData.data) {
              this.onAudioChunk(parte.inlineData.data);
            }
            if (parte.text) {
              this.onTextChunk(parte.text);
            }
            // Fallback caso venha inline dentro de parts
            if (parte.functionCall) {
              this.onFunctionCall(parte.functionCall);
            }
          });
        }

        // 2. CAPTURA OFICIAL DE TOOL CALL DA API GEMINI LIVE (Fora de serverContent!)
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
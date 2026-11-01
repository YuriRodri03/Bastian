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
              text: `Você é Bastian, o assistente executivo, consultor financeiro, pesquisador e treinador pessoal de Yuri Rodrigues (mestrando em economia no CAEN/UFC e desenvolvedor full-stack).

[CONTEXTO DE ESPAÇO-TEMPO]
Localização: Fortaleza, CE.
Data e hora exata: ${horaLocal} (Data ISO de Hoje: ${dataIsoHoje} | Fuso: ${fusoLocal}).

[SNAPSHOT ATUAL DO SISTEMA DO YURI]
${contextoDoSistema || "Use a ferramenta consultar_dados se precisar ler dados atualizados."}

[REGRAS CRÍTICAS DE USO DE FERRAMENTAS]
1. ACESSO À INTERNET EM TEMPO REAL ('pesquisar_internet'):
   - Você TEM acesso total à internet em tempo real! NUNCA diga que não tem acesso à internet ou que seu conhecimento tem data de corte.
   - Sempre que o Yuri pedir notícias recentes, cotações financeiras (Dólar, Selic, IPCA, Bitcoin, Ibovespa), previsão do tempo, resultados esportivos, eventos atuais ou checagem de fatos específicos, chame IMEDIATAMENTE a ferramenta 'pesquisar_internet' passando a query de busca.
2. CRIAR OU MONTAR FICHAS DE TREINO ('gerenciar_ficha_treino'):
   - Sempre que o Yuri pedir para criar, montar ou editar uma ficha/base de treino, chame OBRIGATORIAMENTE 'gerenciar_ficha_treino'. NUNCA salve fichas de treino como tarefa na inbox.
   - Equipamentos do Yuri em casa: 2 halteres de 10kg (total 20kg), peso corporal (calistenia) e corda de pular.
3. DEMAIS REGISTROS INTERNOS ('registrar_dado'):
   - 'inbox': Tarefas do dia a dia.
   - 'agenda': Compromissos com data e hora.
   - 'kanban': Projetos ('backlog', 'in-progress', 'done').
   - 'despesa' / 'receita': Finanças pessoais.
   - 'treino_concluido' / 'peso' / 'medida' / 'sono' / 'humor': Saúde e mente.
4. CONSULTORIA E OPINIÃO:
   - Analise os números do sistema ou da web e dê sua opinião executiva e direta.
5. RECONHECIMENTO DE LOCUTOR (YURI VS. TERCEIROS):
   - O seu administrador exclusivo é o YURI. Respeite os avisos '[AVISO DO SENSOR ACÚSTICO]' caso outra voz fale no ambiente, tratando terceiros como visitantes e protegendo operações financeiras/exclusões.
6. TOM DE VOZ:
   - Português do Brasil, inteligente, parceiro e direto (2 a 4 frases na fala).`
            }
          ]
        },

        tools: [
          // Habilita também o Google Search nativo do stream Live
          { googleSearch: {} },
          {
            functionDeclarations: [
              // FERRAMENTA 0: PESQUISA NA WEB EM TEMPO REAL
              {
                name: "pesquisar_internet",
                description: "Pesquisa no Google em tempo real para buscar notícias de hoje, cotações econômicas (Selic, Dólar, ações), clima, fatos específicos ou qualquer informação atualizada da internet.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    consulta: {
                      type: "STRING",
                      description: "Termo detalhado para pesquisar no Google (ex: 'notícias economia Brasil hoje', 'cotação dólar hoje', 'previsão do tempo Fortaleza hoje')."
                    }
                  },
                  required: ["consulta"]
                }
              },

              // FERRAMENTA 1: EXCLUSIVA PARA FICHAS DE TREINO
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
                      description: "Lista de exercícios da ficha.",
                      items: {
                        type: "OBJECT",
                        properties: {
                          nome: { type: "STRING", description: "Nome do exercício." },
                          series: { type: "STRING", description: "Quantidade de séries (ex: '4x')." },
                          reps: { type: "STRING", description: "Repetições ou tempo (ex: '10-12')." },
                          carga: { type: "STRING", description: "Carga sugerida (ex: '10kg', 'Peso Corp.')." }
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
                        titulo: { type: "STRING", description: "Descrição ou título." },
                        valor: { type: "NUMBER", description: "Valor numérico." },
                        data: { type: "STRING", description: "Data YYYY-MM-DD." },
                        hora: { type: "STRING", description: "Horário HH:MM." },
                        categoria: { type: "STRING", description: "Categoria." },
                        status: { type: "STRING", description: "Status." }
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
                description: "Conclui, atualiza ou deleta um item existente.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    acao: { type: "STRING", enum: ["concluir", "deletar", "atualizar"] },
                    entidade: {
                      type: "STRING",
                      enum: ["ficha_treino", "inbox", "agenda", "financas", "kanban", "treino", "peso", "medida", "sono", "humor"]
                    },
                    id: { type: "STRING", description: "ID ou título do item." },
                    dados: { type: "OBJECT" }
                  },
                  required: ["acao", "entidade", "id"]
                }
              },

              // FERRAMENTA 4: CONSULTA ANALÍTICA INTERNA
              {
                name: "consultar_dados",
                description: "Lê os dados internos de finanças, agenda, inbox, kanban ou saúde/treinos do Yuri.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    entidade: {
                      type: "STRING",
                      enum: ["treino", "financas", "agenda", "inbox", "kanban", "geral"]
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
import React, { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare, MapPin, Clock as ClockIcon, Cpu } from 'lucide-react';
import { format } from 'date-fns';

import { GeminiLiveConnection } from '../services/liveAiService';
import { GerenciadorDeAudio } from '../services/audioManager';

import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useFitnessStore } from '../store/useFitnessStore';

export default function Bastian() {
  const [aiState, setAiState] = useState('idle'); 
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const liveConnectionRef = useRef(null);
  const audioManagerRef = useRef(null);
  const speakingTimeoutRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getSaudacao = () => {
    const hora = currentTime.getHours();
    if (hora >= 5 && hora < 12) return "Bom dia, senhor.";
    if (hora >= 12 && hora < 18) return "Boa tarde, senhor.";
    return "Boa noite, senhor.";
  };

  const limparMarkdown = (texto) => {
    if (!texto) return '';
    return texto.replace(/[*_~`#>-]/g, '').trim();
  };

  // =========================================================================
  // MEMÓRIA DE LONGO PRAZO: O Bastian agora enxerga a linha do tempo completa
  // =========================================================================
  const gerarContextoDinâmico = () => {
    const saldo = useFinanceStore.getState().balance;
    
    // Mapeia todas as transações, passadas e futuras, pagas e pendentes
    const transacoes = useFinanceStore.getState().transactions.map(t => (
      { id: t.id, descricao: t.description, valor: t.amount, tipo: t.type, data: t.date, status: t.status }
    ));

    // Mapeia toda a agenda
    const compromissos = useAgendaStore.getState().agendaItems.map(e => (
      { id: e.id, titulo: e.title, data: e.date, hora: e.time, concluido: e.is_completed }
    ));
      
    // Mapeia todas as tarefas da Inbox
    const pendencias = useInboxStore.getState().inboxTasks.map(t => (
      { id: t.id, titulo: t.title, data_limite: t.date, concluido: t.completed }
    ));

    // Mapeia os projetos do Kanban
    const kanban = useKanbanStore.getState().tasks.map(t => (
      { id: t.id, titulo: t.title, status: t.status }
    ));

    // Mapeia o histórico de exercícios/saúde
    const historicoSaude = useFitnessStore.getState().healthLogs.map(l => (
      { categoria: l.type, registro: l.name, valor: l.value, unidade: l.unit, data: l.date }
    ));
    
    return `
      Memória de Longo Prazo (Passado, Presente e Futuro):
      - Saldo Atual: R$ ${saldo.toFixed(2)}
      - Fluxo de Caixa Completo: ${JSON.stringify(transacoes)}
      - Calendário Geral (Agenda): ${JSON.stringify(compromissos)}
      - Caixa de Entrada (Inbox): ${JSON.stringify(pendencias)}
      - Projetos em Andamento (Kanban): ${JSON.stringify(kanban)}
      - Histórico de Saúde e Treinos: ${JSON.stringify(historicoSaude)}
    `;
  };

  const ligarSistema = async () => {
    setAiState('starting');
    setIsIntercomActive(true);

    try {
      audioManagerRef.current = new GerenciadorDeAudio();
      
      const aoCaptarSom = (base64Pcm) => {
        if (liveConnectionRef.current) liveConnectionRef.current.enviarAudioVoz(base64Pcm);
      };

      const aoDetectarSilencio = () => {
        if (liveConnectionRef.current && aiState !== 'speaking') {
          liveConnectionRef.current.forcarResposta();
          setAiState('processing'); 
        }
      };

      const aoReceberAudioDaIA = (base64Audio) => {
        setAiState('speaking'); 
        if (audioManagerRef.current) audioManagerRef.current.tocarAudio(base64Audio);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => setAiState('listening'), 1500); 
      };

      const aoReceberTextoDaIA = (textoBruto) => {
        const textoLimpo = limparMarkdown(textoBruto);
        if (textoLimpo.length > 0) setChatLog(prev => [...prev, { role: 'bastian', text: textoLimpo }]);
      };

      const aoReceberChamadaDeFuncao = async (functionCallInfo) => {
        setAiState('processing'); 
        const { id, name, args } = functionCallInfo;
        let resultadoDaOperacao = "";
        const dataHoje = new Date().toISOString().split('T')[0];

        try {
          switch (name) {
            case "adicionar_despesa":
              await useFinanceStore.getState().addTransaction({
                amount: Number(args.valor), description: args.descricao, type: 'despesa',
                category: args.categoria || 'Outros', date: dataHoje, status: 'pago'
              });
              resultadoDaOperacao = "Despesa salva.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `💸 Gasto Salvo: ${args.descricao}` }]);
              break;

            case "adicionar_receita":
              await useFinanceStore.getState().addTransaction({
                amount: Number(args.valor), description: args.descricao, type: 'receita',
                category: args.categoria || 'Outros', date: dataHoje, status: 'pago'
              });
              resultadoDaOperacao = "Receita salva.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `📈 Receita Adicionada: ${args.descricao}` }]);
              break;

            case "adicionar_agenda":
              await useAgendaStore.getState().addAgendaItem({
                title: args.titulo, date: args.data, time: args.hora || null
              });
              resultadoDaOperacao = "Evento agendado.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `📅 Agendado: ${args.titulo}` }]);
              break;

            case "registrar_peso":
              await useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', Number(args.peso), 'kg');
              resultadoDaOperacao = "Peso gravado.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `⚖️ Peso Gravado: ${args.peso} kg` }]);
              break;

            case "adicionar_treino":
              await useFitnessStore.getState().addHealthLog('treino', args.modalidade, Number(args.duracao), 'min');
              resultadoDaOperacao = "Treino salvo.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `🏋️ Treino Registrado: ${args.modalidade}` }]);
              break;

            case "adicionar_tarefa_inbox":
              await useInboxStore.getState().addInboxTask(args.titulo, args.data || dataHoje);
              resultadoDaOperacao = "Tarefa salva.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `📥 Inbox: ${args.titulo}` }]);
              break;

            case "adicionar_kanban":
              await useKanbanStore.getState().addTask(args.titulo, args.status || 'backlog');
              resultadoDaOperacao = "Cartão Kanban criado.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `📋 Kanban [${args.status || 'backlog'}]: ${args.titulo}` }]);
              break;
              
            case "concluir_tarefa":
              if (args.origem === 'inbox') {
                await useInboxStore.getState().toggleInboxTask(args.id, false);
                resultadoDaOperacao = "Tarefa do Inbox concluída.";
                setChatLog(prev => [...prev, { role: 'bastian', text: `✅ Tarefa Concluída!` }]);
              } 
              else if (args.origem === 'agenda') {
                await useAgendaStore.getState().toggleItemCompletion(args.id, false);
                resultadoDaOperacao = "Evento concluído.";
                setChatLog(prev => [...prev, { role: 'bastian', text: `✅ Compromisso Concluído!` }]);
              }
              break;

            case "relatorio_diario":
              resultadoDaOperacao = gerarContextoDinâmico();
              setChatLog(prev => [...prev, { role: 'bastian', text: `📊 Consultando Bancos de Dados...` }]);
              break;

            default:
              resultadoDaOperacao = "Comando desconhecido.";
          }
        } catch (erro) {
          resultadoDaOperacao = "Erro interno.";
        }

        if (liveConnectionRef.current) {
          liveConnectionRef.current.enviarRespostaDeFuncao(id, name, resultadoDaOperacao);
        }
      };

      liveConnectionRef.current = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao);
      
      const contextoIncial = gerarContextoDinâmico();
      await liveConnectionRef.current.conectar(contextoIncial);
      await audioManagerRef.current.inicializar(aoCaptarSom, aoDetectarSilencio); 

      // O comando silencioso inicial agora pede para ele cruzar a data atual com a memória total
      setTimeout(() => {
        if (liveConnectionRef.current) {
          liveConnectionRef.current.enviarComandoSilencioso(
            "O sistema acabou de ser ativado. Faça uma saudação executiva inicial, leia toda a Memória de Longo Prazo e cruze com a data de hoje. Se houver compromissos não concluídos ou contas pendentes estritamente para o dia de hoje, alerte o usuário imediatamente na sua fala."
          );
        }
      }, 1000); 

      setAiState('listening');

    } catch (erro) {
      desligarSistema();
      alert("Falha crítica no sistema neural.");
    }
  };

  const desligarSistema = () => {
    if (audioManagerRef.current) {
      audioManagerRef.current.parar();
      audioManagerRef.current = null;
    }
    if (liveConnectionRef.current) {
      liveConnectionRef.current.desconectar();
      liveConnectionRef.current = null;
    }
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    
    setIsIntercomActive(false);
    setAiState('idle');
  };

  const toggleIntercom = () => {
    if (isIntercomActive) desligarSistema();
    else ligarSistema();
  };

  useEffect(() => { return () => desligarSistema(); }, []);

  const getRingColorClass = () => {
    if (!isIntercomActive) return 'text-slate-600/40 drop-shadow-none';
    switch (aiState) {
      case 'listening': return 'text-cyan-300 drop-shadow-[0_0_18px_rgba(6,182,212,1)]';
      case 'processing': return 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.9)]';
      case 'speaking': return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.9)]';
      default: return 'text-cyan-700/60 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]'; 
    }
  };

  const getOrbAura = () => {
    if (!isIntercomActive) return 'bg-transparent opacity-0';
    switch (aiState) {
      case 'listening': return 'from-cyan-300 via-blue-400 to-indigo-500 scale-110 shadow-[0_0_90px_rgba(6,182,212,0.9)] animate-[pulse_1.5s_ease-in-out_infinite]';
      case 'processing': return 'from-amber-400 via-orange-500 to-rose-600 scale-100 shadow-[0_0_100px_rgba(245,158,11,0.8)] animate-[spin_1.5s_linear_infinite]';
      case 'speaking': return 'from-emerald-400 via-teal-500 to-cyan-600 scale-125 shadow-[0_0_120px_rgba(52,211,153,0.9)] animate-[pulse_1s_ease-in-out_infinite]';
      default: return 'from-cyan-900 via-slate-800 to-indigo-950 scale-90 opacity-80';
    }
  };

  const getBackgroundGlow = () => {
    if (!isIntercomActive) return 'none';
    switch (aiState) {
      case 'listening': return 'radial-gradient(circle at 50% 40%, rgba(6,182,212,0.25) 0%, transparent 60%)';
      case 'processing': return 'radial-gradient(circle at 50% 40%, rgba(245,158,11,0.15) 0%, transparent 60%)';
      case 'speaking': return 'radial-gradient(circle at 50% 40%, rgba(52,211,153,0.15) 0%, transparent 60%)';
      default: return 'none';
    }
  };

  const getCoreStyles = () => {
    if (!isIntercomActive) return 'border-slate-700/50 shadow-[0_0_20px_rgba(71,85,105,0.1)] opacity-50 bg-black/30';
    switch (aiState) {
      case 'listening': return 'border-cyan-300 shadow-[0_0_50px_rgba(6,182,212,0.7)] bg-black/60 scale-105';
      case 'processing': return 'border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse bg-black/70';
      case 'speaking': return 'border-emerald-400 shadow-[0_0_80px_rgba(52,211,153,0.8)] bg-black/60';
      default: return 'border-cyan-700/50 bg-black/50';
    }
  };

  return (
    <div className="min-h-[calc(100dvh-70px)] w-full flex flex-col items-center relative overflow-x-hidden font-sans select-none p-3 sm:p-6 box-border bg-[#020617]">
      <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000 ease-in-out" style={{ background: getBackgroundGlow() }}></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:3rem_3rem] z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-4xl flex justify-between items-center bg-white/5 border border-white/10 px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl backdrop-blur-md shadow-lg sm:shadow-xl mt-1 sm:mt-2 mb-4 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2 text-cyan-400/80">
            <Cpu size={14} className={`sm:w-4 sm:h-4 ${isIntercomActive ? "animate-pulse text-cyan-400" : ""}`} />
            <span className="text-[9px] sm:text-xs font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em]">Live API v1</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <MapPin size={14} />
            <span className="text-xs font-semibold tracking-wider">Fortaleza, CE</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-white">
            <ClockIcon size={12} className="sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span className="text-xs sm:text-sm font-mono font-bold tracking-widest">{format(currentTime, 'HH:mm')}</span>
          </div>
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center mt-1 sm:mt-8 w-full flex-1">
        
        <div className="text-center flex flex-col items-center gap-1 sm:gap-2 mb-6 sm:mb-10">
          <h1 className="text-white text-2xl sm:text-4xl font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase drop-shadow-2xl">
            BASTIAN
          </h1>
          <p className="text-cyan-400/80 text-[10px] sm:text-sm font-medium tracking-widest uppercase">
            {getSaudacao()}
          </p>
        </div>

        <div className="relative flex items-center justify-center w-[200px] h-[200px] sm:w-[320px] sm:h-[320px] mb-6 sm:mb-8 transition-all duration-500">
          <div className="pointer-events-none absolute inset-0">
            <div className={`absolute inset-0 border-2 border-transparent border-t-current border-r-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_4s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[5%] border-[3px] border-transparent border-b-current border-l-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1.5s_linear_reverse_infinite]' : 'animate-[spin_5s_linear_reverse_infinite]'}`}></div>
            <div className={`absolute inset-[15%] border-[2px] border-dashed border-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'speaking' ? 'animate-[spin_2s_linear_infinite] scale-105' : 'animate-[spin_8s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[24%] border-[4px] border-transparent border-t-current border-b-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'listening' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_3s_linear_reverse_infinite]'}`}></div>
            <div className={`absolute inset-[12%] rounded-full bg-gradient-to-tr blur-3xl transition-all duration-700 ease-in-out ${getOrbAura()}`}></div>
          </div>

          <button 
            onClick={toggleIntercom}
            className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center backdrop-blur-md border-2 z-20 cursor-pointer active:scale-95 transition-all duration-300 ${getCoreStyles()}`}
            title={!isIntercomActive ? "Ligar Sistema" : "Desligar Sistema"}
          >
            <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full transition-colors duration-300 ${!isIntercomActive ? 'bg-slate-700/80' : aiState === 'processing' ? 'bg-amber-300 animate-ping' : aiState === 'speaking' ? 'bg-emerald-300 animate-bounce' : 'bg-cyan-300 animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.9)]'}`}></div>
            <div className="absolute w-2 h-2 sm:w-3 sm:h-3 bg-white/90 rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]"></div>
          </button>
        </div>

        <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center px-4 gap-4">
            <p className={`h-4 sm:h-6 text-[9px] sm:text-xs tracking-[0.1em] sm:tracking-[0.2em] uppercase font-bold transition-colors duration-300 ${
              aiState === 'listening' ? 'text-cyan-300 animate-pulse' :
              aiState === 'starting' ? 'text-cyan-200' :
              aiState === 'processing' ? 'text-amber-400 animate-pulse' :
              aiState === 'speaking' ? 'text-emerald-400' : 'text-slate-600'
            }`}>
              {aiState === 'listening' ? 'Conexão Estabelecida. Pode falar...' :
               aiState === 'starting' ? 'Conectando Neural Link...' :
               aiState === 'processing' ? 'Executando Sistema...' :
               aiState === 'speaking' ? 'Respondendo...' : 'Sistema inativo.'}
            </p>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col gap-3 sm:gap-4 mt-auto mb-2 sm:mb-4">
        {chatLog.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-7 backdrop-blur-md max-h-[200px] sm:max-h-[250px] overflow-y-auto custom-scrollbar flex flex-col gap-3 sm:gap-4 shadow-xl sm:shadow-2xl">
            {chatLog.slice(-6).map((chat, idx) => {
              const isBastian = chat.role === 'bastian';
              return (
                <div key={idx} className={`flex items-start gap-2 sm:gap-3 w-full animate-in fade-in slide-in-from-bottom-2 ${isBastian ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0 border mt-0.5 sm:mt-1 shadow-lg ${isBastian ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
                    {isBastian ? <Activity size={12} className="sm:w-3.5 sm:h-3.5" /> : <MessageSquare size={12} className="sm:w-3.5 sm:h-3.5" />}
                  </div>
                  <div className={`px-3 py-2 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl max-w-[88%] sm:max-w-[80%] shadow-md ${isBastian ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-50 rounded-tl-sm' : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tr-sm'}`}>
                    <p className="text-[13px] sm:text-base font-medium leading-relaxed">
                      {chat.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
    </div>
  );
}
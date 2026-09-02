import React, { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare, MapPin, Clock as ClockIcon, Cpu } from 'lucide-react';
import { format } from 'date-fns';

import { GeminiLiveConnection } from '../services/liveAiService';
import { GerenciadorDeAudio } from '../services/audioManager';

// IMPORTAÇÃO DOS SEUS STORES ZUSTAND
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

  const gerarContextoDinâmico = () => {
    const hoje = new Date().toISOString().split('T')[0];
    const saldo = useFinanceStore.getState().balance;
    
    // Pegamos apenas o que NÃO está concluído e passamos o ID + Título para a IA
    const compromissos = useAgendaStore.getState().agendaItems
      .filter(e => e.date === hoje && !e.is_completed)
      .map(e => ({ id: e.id, titulo: e.title }));
      
    const pendencias = useInboxStore.getState().inboxTasks
      .filter(t => !t.completed)
      .map(t => ({ id: t.id, titulo: t.title }));
    
    return `
      Memória Atual:
      - Saldo Atual: R$ ${saldo.toFixed(2)}
      - Eventos Pendentes (Agenda): ${JSON.stringify(compromissos)}
      - Tarefas Pendentes (Inbox): ${JSON.stringify(pendencias)}
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

      // =====================================================================
      // INTEGRAÇÃO TOTAL: CONECTANDO O CÉREBRO AOS STORES
      // =====================================================================
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
              resultadoDaOperacao = "Despesa adicionada ao fluxo de caixa.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `💸 Gasto Salvo: ${args.descricao}` }]);
              break;

            case "adicionar_receita":
              await useFinanceStore.getState().addTransaction({
                amount: Number(args.valor), description: args.descricao, type: 'receita',
                category: args.categoria || 'Outros', date: dataHoje, status: 'pago'
              });
              resultadoDaOperacao = "Receita contabilizada.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `📈 Receita Adicionada: ${args.descricao}` }]);
              break;

            case "adicionar_agenda":
              await useAgendaStore.getState().addAgendaItem({
                title: args.titulo, date: args.data, time: args.hora || null
              });
              resultadoDaOperacao = "Evento agendado com sucesso.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `📅 Agendado: ${args.titulo}` }]);
              break;

            case "registrar_peso":
              await useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', Number(args.peso), 'kg');
              resultadoDaOperacao = "Peso registrado nas métricas de saúde.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `⚖️ Peso Gravado: ${args.peso} kg` }]);
              break;

            case "adicionar_treino":
              await useFitnessStore.getState().addHealthLog('treino', args.modalidade, Number(args.duracao), 'min');
              resultadoDaOperacao = "Treino computado no diário.";
              setChatLog(prev => [...prev, { role: 'bastian', text: `🏋️ Treino Registrado: ${args.modalidade}` }]);
              break;

            case "adicionar_tarefa_inbox":
              await useInboxStore.getState().addInboxTask(args.titulo, args.data || dataHoje);
              resultadoDaOperacao = "Tarefa salva na caixa de entrada.";
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
                resultadoDaOperacao = "Tarefa do Inbox marcada como concluída.";
                setChatLog(prev => [...prev, { role: 'bastian', text: `✅ Tarefa Concluída!` }]);
              } 
              else if (args.origem === 'agenda') {
                await useAgendaStore.getState().toggleItemCompletion(args.id, false);
                resultadoDaOperacao = "Evento da agenda marcado como concluído.";
                setChatLog(prev => [...prev, { role: 'bastian', text: `✅ Compromisso Concluído!` }]);
              }
              break;

            case "relatorio_diario":
              resultadoDaOperacao = gerarContextoDinâmico();
              setChatLog(prev => [...prev, { role: 'bastian', text: `📊 Consultando Bancos de Dados...` }]);
              break;

            default:
              resultadoDaOperacao = "Sistema não reconheceu o comando de ferramenta.";
          }
        } catch (erro) {
          console.error("[Bastian] Falha ao injetar no Store:", erro);
          resultadoDaOperacao = "Houve um erro interno ao salvar no Supabase.";
        }

        // Retorna a promessa concluída para a IA continuar falando
        if (liveConnectionRef.current) {
          liveConnectionRef.current.enviarRespostaDeFuncao(id, name, resultadoDaOperacao);
        }
      };

      liveConnectionRef.current = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao);
      
      const contextoIncial = gerarContextoDinâmico();
      await liveConnectionRef.current.conectar(contextoIncial);
      await audioManagerRef.current.inicializar(aoCaptarSom, aoDetectarSilencio); 

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
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center relative overflow-hidden font-sans select-none p-4 sm:p-6 box-border max-w-[100vw] bg-[#020617]">
      <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000 ease-in-out" style={{ background: getBackgroundGlow() }}></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:3rem_3rem] z-0 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-4xl flex justify-between items-center bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md shadow-xl mt-2 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-cyan-400/80">
            <Cpu size={16} className={isIntercomActive ? "animate-pulse text-cyan-400" : ""} />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">Live API v1</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            <MapPin size={14} />
            <span className="text-xs font-semibold tracking-wider">Fortaleza, CE</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <ClockIcon size={14} className="text-cyan-400" />
            <span className="text-sm font-mono font-bold tracking-widest">{format(currentTime, 'HH:mm')}</span>
          </div>
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col items-center mt-2 sm:mt-8 w-full flex-1">
        
        <div className="text-center flex flex-col items-center gap-2 mb-10">
          <h1 className="text-white text-3xl sm:text-4xl font-bold tracking-[0.3em] uppercase drop-shadow-2xl">
            BASTIAN
          </h1>
          <p className="text-cyan-400/80 text-xs sm:text-sm font-medium tracking-widest uppercase">
            {getSaudacao()}
          </p>
        </div>

        <div className="relative flex items-center justify-center w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] mb-8 transition-all duration-500">
          <div className="pointer-events-none absolute inset-0">
            <div className={`absolute inset-0 border-2 border-transparent border-t-current border-r-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_4s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[5%] border-[3px] border-transparent border-b-current border-l-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1.5s_linear_reverse_infinite]' : 'animate-[spin_5s_linear_reverse_infinite]'}`}></div>
            <div className={`absolute inset-[15%] border-[2px] border-dashed border-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'speaking' ? 'animate-[spin_2s_linear_infinite] scale-105' : 'animate-[spin_8s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[24%] border-[4px] border-transparent border-t-current border-b-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'listening' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_3s_linear_reverse_infinite]'}`}></div>
            <div className={`absolute inset-[12%] rounded-full bg-gradient-to-tr blur-3xl transition-all duration-700 ease-in-out ${getOrbAura()}`}></div>
          </div>

          <button 
            onClick={toggleIntercom}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center backdrop-blur-md border-2 z-20 cursor-pointer active:scale-95 transition-all duration-300 ${getCoreStyles()}`}
            title={!isIntercomActive ? "Ligar Sistema" : "Desligar Sistema"}
          >
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-colors duration-300 ${!isIntercomActive ? 'bg-slate-700/80' : aiState === 'processing' ? 'bg-amber-300 animate-ping' : aiState === 'speaking' ? 'bg-emerald-300 animate-bounce' : 'bg-cyan-300 animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.9)]'}`}></div>
            <div className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white/90 rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]"></div>
          </button>
        </div>

        <div className="w-full max-w-2xl flex flex-col items-center justify-center text-center px-4 gap-4">
            <p className={`h-6 text-[11px] sm:text-xs tracking-[0.2em] uppercase font-bold transition-colors duration-300 ${
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

      <div className="relative z-10 w-full max-w-3xl flex flex-col gap-4 mt-auto mb-4">
        {chatLog.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-md max-h-[250px] overflow-y-auto custom-scrollbar flex flex-col gap-4 shadow-2xl">
            {chatLog.slice(-6).map((chat, idx) => {
              const isBastian = chat.role === 'bastian';
              return (
                <div key={idx} className={`flex items-start gap-3 w-full animate-in fade-in slide-in-from-bottom-2 ${isBastian ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 border mt-1 shadow-lg ${isBastian ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
                    {isBastian ? <Activity size={14} /> : <MessageSquare size={14} />}
                  </div>
                  <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] sm:max-w-[80%] shadow-md ${isBastian ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-50 rounded-tl-sm' : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tr-sm'}`}>
                    <p className="text-sm sm:text-base font-medium leading-relaxed">
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
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, MessageSquare, Terminal, MapPin, Clock as ClockIcon, Cpu } from 'lucide-react';
import { enviarComandoParaIA } from '../services/aiService';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export default function Bastian() {
  const [aiState, setAiState] = useState('idle'); // idle, listening, processing, speaking, needs_touch
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // NOVO: Estado visual para saber quando ele está na "Janela de Atenção"
  const [isAwakeStatus, setIsAwakeStatus] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioRef = useRef(null); 
  
  const intercomRef = useRef(false); 
  const isBusyRef = useRef(false); 
  
  const isAwakeRef = useRef(false); 
  const conversationTimeoutRef = useRef(null); // Timer da Janela de Atenção
  
  const micStartSuccessRef = useRef(false);
  const needsTouchRef = useRef(false); 
  const timeoutRef = useRef(null);

  // Relógio em tempo real
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

  // =================================================================
  // MOTOR DA JANELA DE ATENÇÃO (CONVERSA FLUIDA)
  // =================================================================
  const manterAcordado = () => {
    isAwakeRef.current = true;
    setIsAwakeStatus(true);
    
    if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    
    // Mantém o Bastian 100% atento (sem precisar do nome) por 15 segundos
    conversationTimeoutRef.current = setTimeout(() => {
      isAwakeRef.current = false;
      setIsAwakeStatus(false);
    }, 15000);
  };

  const dispararTravaDeToque = () => {
    needsTouchRef.current = true;
    requestAnimationFrame(() => {
      setAiState('needs_touch');
      void document.body.offsetHeight; 
    });
  };

  const tentarReligarMicrofone = () => {
    if (!intercomRef.current) return;
    
    if (needsTouchRef.current) {
      setAiState('needs_touch');
      return; 
    }
    
    micStartSuccessRef.current = false;
    setAiState('starting'); 
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (error) {
      if (error.name !== 'InvalidStateError') {
        dispararTravaDeToque();
        return;
      } else {
        micStartSuccessRef.current = true;
        setAiState('listening');
      }
    }

    timeoutRef.current = setTimeout(() => {
      if (intercomRef.current && !micStartSuccessRef.current) {
        dispararTravaDeToque();
      }
    }, 800);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Senhor, este navegador não suporta a minha rede neural de reconhecimento de voz contínuo.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true; 
    recognition.interimResults = true; 

    recognition.onstart = () => {
      micStartSuccessRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current); 
      if (!isBusyRef.current) setAiState('listening');
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        dispararTravaDeToque();
      }
    };

    // =================================================================
    // CÉREBRO AUDITIVO MELHORADO (TOLERÂNCIA A ERROS FONÉTICOS)
    // =================================================================
    recognition.onresult = (event) => {
      if (isBusyRef.current) return; 

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(interimTranscript || finalTranscript);

      if (finalTranscript) {
        const text = finalTranscript.toLowerCase().trim();
        if (!text) return;

        // Se ele está na Janela de Atenção (Acordado), tudo o que o senhor disser é comando.
        if (isAwakeRef.current) {
          executarComando(text);
          return;
        }

        // Dicionário Fonético Expandido: Cobre erros comuns de reconhecimento do nome
        const regex = /(?:bastian|bastião|bastia|bastiam|sebastião|sebastian|assistente)(.*)/i;
        const match = text.match(regex);

        if (match) {
          const comando = match[1].trim();
          
          // Se falou "Bastian, faça tal coisa", executa direto.
          if (comando.length > 2) {
            executarComando(comando);
          } else {
            // Se falou só "Bastian", ele entra na Janela de Atenção e aguarda.
            manterAcordado();
            falar("Sim, senhor?");
          }
        }
      }
    };
    
    recognition.onend = () => {
      if (intercomRef.current && !isBusyRef.current && !needsTouchRef.current) {
        setTimeout(tentarReligarMicrofone, 200);
      } else if (!intercomRef.current) {
        setAiState('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      intercomRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const falar = async (texto) => {
    isBusyRef.current = true; 
    setAiState('processing'); 
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/bastian-tts`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ texto: texto })
      });

      if (!response.ok) {
        throw new Error(`Erro na Edge Function: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        
        let watchdogTimer = null;

        const finalizarReproducao = () => {
          if (!isBusyRef.current) return; 
          isBusyRef.current = false; 
          URL.revokeObjectURL(audioUrl); 
          if (watchdogTimer) clearTimeout(watchdogTimer);
          
          // Quando ele termina de falar, ele abre a Janela de Atenção para ouvir uma possível tréplica
          manterAcordado();
          setTimeout(() => tentarReligarMicrofone(), 150);
        };

        audioRef.current.onplay = () => {
          if (!needsTouchRef.current) setAiState('speaking');
        };
        
        audioRef.current.onended = finalizarReproducao;
        audioRef.current.onerror = finalizarReproducao;

        audioRef.current.onpause = () => {
          if (isBusyRef.current && audioRef.current.currentTime > 0) finalizarReproducao();
        };

        audioRef.current.onloadedmetadata = () => {
          const duracaoMs = (audioRef.current.duration && audioRef.current.duration !== Infinity 
                              ? audioRef.current.duration 
                              : 15) * 1000;
          
          if (watchdogTimer) clearTimeout(watchdogTimer);
          watchdogTimer = setTimeout(() => {
            if (isBusyRef.current) finalizarReproducao();
          }, duracaoMs + 2000);
        };

        watchdogTimer = setTimeout(() => {
          if (isBusyRef.current) finalizarReproducao();
        }, 15000);

        await audioRef.current.play();
      }

    } catch (error) {
      console.error("Erro detalhado na síntese neural:", error);
      isBusyRef.current = false;
      manterAcordado(); // Mantém acordado mesmo se falhar para tentar de novo
      
      const mensagemErro = `[FALHA DE SISTEMA]: ${error.message || error.name || 'Erro desconhecido'}.`;
      setChatLog(prev => [...prev, { role: 'bastian', text: mensagemErro }]);
      
      setTimeout(tentarReligarMicrofone, 150);
    }
  };

  const executarComando = async (comandoTexto) => {
    isBusyRef.current = true; 
    isAwakeRef.current = false; // Desliga o status acordado durante o processamento
    setIsAwakeStatus(false);
    
    if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    
    setAiState('processing');
    setTranscript(''); 
    setChatLog(prev => [...prev, { role: 'user', text: comandoTexto }]);

    try {
      const resultado = await enviarComandoParaIA(comandoTexto);
      setChatLog(prev => [...prev, { role: 'bastian', text: resultado.mensagem }]);
      falar(resultado.mensagem);
    } catch (error) {
      console.error("Erro na comunicação com a API:", error);
      const mensagemErro = "Desculpe, senhor. Minhas conexões com o servidor principal estão instáveis no momento.";
      setChatLog(prev => [...prev, { role: 'bastian', text: mensagemErro }]);
      falar(mensagemErro);
    }
  };

  const toggleIntercom = () => {
    const novoEstado = !intercomRef.current;
    
    if (novoEstado) {
      needsTouchRef.current = false; 
      
      if (audioRef.current) {
        audioRef.current.src = "data:audio/mp3;base64,//OlkAAAAAAAAAAAAAAP/7gAAAAAAO0gAAAAAT/wgAAOlkAAAAAAAAAAAAAAP/7gAAAAAAO0gAAAAAT/wgAA";
        audioRef.current.play().then(() => audioRef.current.pause()).catch(() => {});
      }

      intercomRef.current = true;
      setIsIntercomActive(true);
      
      // Ao ligar o sistema pelo botão, ele já entra na Janela de Atenção (pode falar direto)
      manterAcordado();
      
      setTimeout(() => {
        tentarReligarMicrofone();
      }, 150);
      
    } else {
      intercomRef.current = false;
      setIsIntercomActive(false);
      needsTouchRef.current = false;
      isAwakeRef.current = false;
      setIsAwakeStatus(false);
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
      setAiState('idle');
      
      try {
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch (e) {}
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  // ==========================================
  // ESTILOS DE ENERGIA HOLOGRÁFICA (HUD FLUIDO)
  // ==========================================
  
  const getRingColorClass = () => {
    if (!isIntercomActive) return 'text-slate-600/40 drop-shadow-none';
    switch (aiState) {
      case 'listening': 
        return isAwakeStatus ? 'text-cyan-300 drop-shadow-[0_0_18px_rgba(6,182,212,1)]' : 'text-cyan-700/60 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]';
      case 'processing': return 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.9)]';
      case 'speaking': return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.9)]';
      case 'needs_touch': return 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.9)]';
      default: return 'text-cyan-700/60 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]'; 
    }
  };

  const getOrbAura = () => {
    if (!isIntercomActive) return 'bg-transparent opacity-0';
    switch (aiState) {
      case 'listening': 
        return isAwakeStatus 
          ? 'from-cyan-300 via-blue-400 to-indigo-500 scale-110 shadow-[0_0_90px_rgba(6,182,212,0.9)] animate-[pulse_1.5s_ease-in-out_infinite]'
          : 'from-cyan-900 via-slate-800 to-indigo-950 scale-95 shadow-[0_0_40px_rgba(6,182,212,0.4)] opacity-80';
      case 'processing': 
        return 'from-amber-400 via-orange-500 to-rose-600 scale-100 shadow-[0_0_100px_rgba(245,158,11,0.8)] animate-[spin_1.5s_linear_infinite]';
      case 'speaking': 
        return 'from-emerald-400 via-teal-500 to-cyan-600 scale-125 shadow-[0_0_120px_rgba(52,211,153,0.9)] animate-[pulse_1s_ease-in-out_infinite]';
      case 'needs_touch': 
        return 'from-rose-500 via-red-600 to-red-900 scale-95 shadow-[0_0_50px_rgba(244,63,94,0.8)] animate-bounce';
      default: 
        return 'from-cyan-900 via-slate-800 to-indigo-950 scale-90 shadow-[0_0_30px_rgba(6,182,212,0.2)] opacity-80';
    }
  };

  const getBackgroundGlow = () => {
    if (!isIntercomActive) return 'none';
    switch (aiState) {
      case 'listening': return isAwakeStatus ? 'radial-gradient(circle at 50% 40%, rgba(6,182,212,0.25) 0%, transparent 60%)' : 'radial-gradient(circle at 50% 40%, rgba(6,182,212,0.1) 0%, transparent 60%)';
      case 'processing': return 'radial-gradient(circle at 50% 40%, rgba(245,158,11,0.15) 0%, transparent 60%)';
      case 'speaking': return 'radial-gradient(circle at 50% 40%, rgba(52,211,153,0.15) 0%, transparent 60%)';
      case 'needs_touch': return 'radial-gradient(circle at 50% 40%, rgba(244,63,94,0.15) 0%, transparent 60%)';
      default: return 'radial-gradient(circle at 50% 40%, rgba(30,41,59,0.3) 0%, transparent 50%)';
    }
  };

  const getCoreStyles = () => {
    if (!isIntercomActive) return 'border-slate-700/50 shadow-[0_0_20px_rgba(71,85,105,0.1)] opacity-50 bg-black/30';
    switch (aiState) {
      case 'listening': return isAwakeStatus ? 'border-cyan-300 shadow-[0_0_50px_rgba(6,182,212,0.7)] bg-black/60 scale-105' : 'border-cyan-700 shadow-[0_0_30px_rgba(6,182,212,0.3)] bg-black/60 scale-100';
      case 'processing': return 'border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse bg-black/70';
      case 'speaking': return 'border-emerald-400 shadow-[0_0_80px_rgba(52,211,153,0.8)] bg-black/60';
      case 'needs_touch': return 'border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.6)] animate-bounce bg-black/60';
      default: return 'border-cyan-700/50 shadow-[0_0_20px_rgba(6,182,212,0.2)] bg-black/50';
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center relative overflow-hidden font-sans select-none p-4 sm:p-6 box-border max-w-[100vw] bg-[#020617]">
      
      {/* Brilho de Fundo Dinâmico */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000 ease-in-out"
        style={{ background: getBackgroundGlow() }}
      ></div>

      {/* Grid Tecnológico Minimalista */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:3rem_3rem] z-0 pointer-events-none"></div>

      {/* Trava de Toque (iOS Watchdog) */}
      {aiState === 'needs_touch' && (
        <div 
          onClick={() => {
            needsTouchRef.current = false; 
            if (audioRef.current) {
              audioRef.current.play().then(() => audioRef.current.pause()).catch(()=>{});
            }
            tentarReligarMicrofone();
          }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-300 px-4"
        >
          <div className="flex flex-col items-center gap-4 p-8 w-full max-w-sm bg-cyan-950/40 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-cyan-500/20 rounded-full flex items-center justify-center animate-ping absolute"></div>
            <Mic size={48} className="text-cyan-400 relative z-10 animate-pulse sm:w-14 sm:h-14" />
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-widest uppercase relative z-10 mt-4">
              Toque na Tela
            </h2>
            <p className="text-cyan-400/80 text-xs sm:text-sm relative z-10 max-w-xs mt-1">
              O sistema de áudio foi suspenso pelo navegador. Toque para reabrir.
            </p>
          </div>
        </div>
      )}

      {/* HUD DE CONSCIÊNCIA DE TEMPO E ESPAÇO */}
      <div className="relative z-10 w-full max-w-4xl flex justify-between items-center bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md shadow-xl mt-2 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-cyan-400/80">
            <Cpu size={16} className={isIntercomActive ? "animate-pulse text-cyan-400" : ""} />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">Bastian Core v2</span>
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
      
      {/* CENTRO NEURAL (ORB FLUIDO + ANÉIS DE ENERGIA HOLOGRÁFICA) */}
      <div className="relative z-10 flex flex-col items-center mt-2 sm:mt-8 w-full flex-1">
        
        {/* Título e Saudação */}
        <div className="text-center flex flex-col items-center gap-2 mb-10">
          <h1 className="text-white text-3xl sm:text-4xl font-bold tracking-[0.3em] uppercase drop-shadow-2xl">
            BASTIAN
          </h1>
          <p className="text-cyan-400/80 text-xs sm:text-sm font-medium tracking-widest uppercase">
            {getSaudacao()}
          </p>
        </div>

        {/* ESTRUTURA HÍBRIDA COM O NÚCLEO INTERATIVO (O "OLHINHO") */}
        <div className="relative flex items-center justify-center w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] mb-12 transition-all duration-500">
          
          {/* ANÉIS HOLOGRÁFICOS (HUD FLUIDO) - Ignoram clicks (pointer-events-none) */}
          <div className="pointer-events-none absolute inset-0">
            <div className={`absolute inset-0 border-2 border-transparent border-t-current border-r-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_4s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[5%] border-[3px] border-transparent border-b-current border-l-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1.5s_linear_reverse_infinite]' : 'animate-[spin_5s_linear_reverse_infinite]'}`}></div>
            <div className={`absolute inset-[15%] border-[2px] border-dashed border-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'speaking' ? 'animate-[spin_2s_linear_infinite] scale-105' : 'animate-[spin_8s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[24%] border-[4px] border-transparent border-t-current border-b-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'listening' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_3s_linear_reverse_infinite]'}`}></div>
            <div className={`absolute inset-[12%] rounded-full bg-gradient-to-tr blur-3xl transition-all duration-700 ease-in-out ${getOrbAura()}`}></div>
          </div>

          {/* O BOTÃO MASSIVO E ORGÂNICO (O "OLHINHO" DO BASTIAN) */}
          <button 
            onClick={toggleIntercom}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center backdrop-blur-md border-2 z-20 cursor-pointer active:scale-95 transition-all duration-300 ${getCoreStyles()}`}
            title={isIntercomActive ? "Desativar Bastian" : "Despertar Bastian"}
          >
            {/* A Pupila de Luz */}
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-colors duration-300 ${!isIntercomActive ? 'bg-slate-700/80' : aiState === 'processing' ? 'bg-amber-300 animate-ping' : aiState === 'speaking' ? 'bg-emerald-300 animate-bounce' : isAwakeStatus ? 'bg-cyan-300 animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.9)]' : 'bg-cyan-700/80 shadow-[0_0_10px_rgba(6,182,212,0.3)]'}`}></div>
            
            {/* O Reflexo de Vidro (Ponto Branco) */}
            <div className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white/90 rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]"></div>
          </button>
        </div>

        {/* CLOSED CAPTIONS E STATUS DE ATENÇÃO */}
        <div className="w-full max-w-2xl h-24 flex items-center justify-center text-center px-4">
          {transcript ? (
            <p className="text-white text-xl sm:text-2xl font-light italic tracking-wide animate-in fade-in slide-in-from-bottom-2 duration-300 drop-shadow-md">
              "{transcript}"
            </p>
          ) : (
            <p className={`text-[11px] sm:text-xs tracking-[0.2em] uppercase font-bold transition-colors duration-300 ${
              aiState === 'listening' ? (isAwakeStatus ? 'text-cyan-300 animate-pulse' : 'text-slate-500') :
              aiState === 'starting' ? 'text-cyan-200' :
              aiState === 'processing' ? 'text-amber-400 animate-pulse' :
              aiState === 'speaking' ? 'text-emerald-400' : 'text-slate-600'
            }`}>
              {aiState === 'listening' ? (isAwakeStatus ? 'Pode falar, estou ouvindo...' : 'Aguardando o comando "Bastian"...') :
               aiState === 'starting' ? 'Reativando sensores...' :
               aiState === 'processing' ? 'Processando lógica...' :
               aiState === 'speaking' ? 'Respondendo...' : 'Toque no centro para iniciar'}
            </p>
          )}
        </div>
      </div>

      {/* Painel Inferior (HUD de Histórico de Conversa AMPLIADO) */}
      <div className="relative z-10 w-full max-w-3xl flex flex-col gap-4 mt-auto mb-4">
        {chatLog.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-md max-h-[250px] sm:max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-4 sm:gap-5 shadow-2xl">
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
      
      <audio ref={audioRef} style={{ display: 'none' }} playsInline webkit-playsinline="true" preload="auto" />
    </div>
  );
}
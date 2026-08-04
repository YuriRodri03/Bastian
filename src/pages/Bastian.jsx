import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, MessageSquare, Terminal } from 'lucide-react';
import { enviarComandoParaIA } from '../services/aiService';
import { supabase } from '../lib/supabase';

export default function Bastian() {
  const [aiState, setAiState] = useState('idle');
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [chatLog, setChatLog] = useState([]);
  
  const recognitionRef = useRef(null);
  const audioRef = useRef(null); 
  
  const intercomRef = useRef(false); 
  const isBusyRef = useRef(false); 
  const isAwakeRef = useRef(false); 
  
  const micStartSuccessRef = useRef(false);
  
  const needsTouchRef = useRef(false); 
  const timeoutRef = useRef(null);
  const commandTimeoutRef = useRef(null); 

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

        if (isAwakeRef.current) {
          if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
          isAwakeRef.current = false; 
          
          if (text.length > 2) {
            executarComando(text);
          }
          return;
        }

        const regex = /(?:bastian|bastião|bastia)(.*)/i;
        const match = text.match(regex);

        if (match) {
          const comando = match[1].trim();
          
          if (comando.length > 3) {
            executarComando(comando);
          } else {
            isAwakeRef.current = true;
            
            if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
            
            commandTimeoutRef.current = setTimeout(() => {
              if (isAwakeRef.current) {
                falar("Sim, senhor?");
              }
            }, 1200); 
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
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
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
      
      const mensagemErro = `[FALHA DE SISTEMA]: ${error.message || error.name || 'Erro desconhecido'}.`;
      setChatLog(prev => [...prev, { role: 'bastian', text: mensagemErro }]);
      
      setTimeout(tentarReligarMicrofone, 150);
    }
  };

  const executarComando = async (comandoTexto) => {
    isBusyRef.current = true; 
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
      
      setTimeout(() => {
        tentarReligarMicrofone();
      }, 150);
      
    } else {
      intercomRef.current = false;
      setIsIntercomActive(false);
      needsTouchRef.current = false;
      setAiState('idle');
      
      try {
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch (e) {}
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const getCoreStyles = () => {
    switch (aiState) {
      case 'listening': return 'border-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.5)]';
      case 'processing': return 'border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse';
      case 'speaking': return 'border-emerald-400 shadow-[0_0_80px_rgba(52,211,153,0.8)] scale-110 transition-transform duration-300';
      case 'needs_touch': return 'border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.6)] animate-bounce';
      default: return 'border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)] opacity-70';
    }
  };

  const getRingStyles = (baseSpeed) => {
    if (aiState === 'processing') return `animate-[spin_${baseSpeed / 2}s_linear_infinite] border-amber-500/50`;
    if (aiState === 'speaking') return `animate-[spin_${baseSpeed}s_linear_infinite] border-emerald-500/50`;
    if (aiState === 'needs_touch') return `animate-[spin_${baseSpeed}s_linear_infinite] border-cyan-400 opacity-80`;
    if (aiState === 'idle') return `animate-[spin_${baseSpeed * 2}s_linear_infinite] opacity-50`;
    return `animate-[spin_${baseSpeed}s_linear_infinite] border-cyan-500/50`; 
  };

  const getGlowColor = () => {
    if (aiState === 'processing') return 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 60%)';
    if (aiState === 'speaking') return 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)';
    return 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 50%)';
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center relative overflow-x-hidden font-mono select-none p-4 sm:p-6 box-border max-w-[100vw]">
      
      {/* Brilho de Fundo Dinâmico */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000 ease-in-out"
        style={{ background: getGlowColor() }}
      ></div>

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
              O sistema de áudio foi suspenso. Toque para reabrir o canal de voz.
            </p>
          </div>
        </div>
      )}

      {/* Grid Tecnológico */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d405_1px,transparent_1px),linear-gradient(to_bottom,#06b6d405_1px,transparent_1px)] bg-[size:3rem_3rem] sm:bg-[size:4rem_4rem] z-0 pointer-events-none"></div>
      
      {/* Bastian Core UI */}
      <div className="relative z-10 flex flex-col items-center mb-8 sm:mb-12 mt-4 sm:mt-0 w-full">
        {/* Usando tamanhos fixos porém responsivos w-[280px] mobile, w-[320px] desktop */}
        <div className="relative flex items-center justify-center w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] transition-all duration-500">
          <div className={`absolute inset-0 border-[1px] border-t-current rounded-full ${getRingStyles(4)}`}></div>
          <div className={`absolute inset-[6%] border-[1px] border-b-current rounded-full ${getRingStyles(6)}`} style={{ animationDirection: 'reverse' }}></div>
          <div className={`absolute inset-[15%] border-[2px] border-dashed rounded-full ${getRingStyles(8)}`}></div>
          <div className={`absolute inset-[25%] border-2 border-l-current border-r-current rounded-full ${getRingStyles(3)}`} style={{ animationDirection: 'reverse' }}></div>
          
          <div className={`w-20 h-20 sm:w-24 sm:h-24 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border-2 transition-all duration-300 ${getCoreStyles()}`}>
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${aiState === 'processing' ? 'bg-amber-300 animate-ping' : aiState === 'speaking' ? 'bg-emerald-300 animate-bounce' : 'bg-cyan-300 animate-pulse'}`}></div>
            <div className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full"></div>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 text-center flex flex-col items-center gap-1.5 sm:gap-2">
          <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-[0.3em] sm:tracking-[0.4em] uppercase drop-shadow-lg ml-1 sm:ml-2">
            BASTIAN <span className="text-cyan-500 text-base sm:text-lg">CORE</span>
          </h1>
          <p className={`text-[10px] sm:text-xs tracking-widest uppercase font-semibold h-4 transition-colors duration-300 ${
            aiState === 'listening' ? 'text-cyan-400 animate-pulse' :
            aiState === 'starting' ? 'text-cyan-200' :
            aiState === 'needs_touch' ? 'text-cyan-400 animate-bounce' :
            aiState === 'processing' ? 'text-amber-400 animate-pulse' :
            aiState === 'speaking' ? 'text-emerald-400' : 'text-slate-500'
          }`}>
            {aiState === 'listening' ? 'Aguardando comando...' :
             aiState === 'starting' ? 'Reativando sensores...' :
             aiState === 'needs_touch' ? 'Aguardando toque na tela...' :
             aiState === 'processing' ? 'Processando rede neural...' :
             aiState === 'speaking' ? 'Transmitindo resposta...' : 'Sistema em repouso'}
          </p>
        </div>
      </div>

      {/* Painel Inferior (HUD & Controles) */}
      <div className="relative z-10 w-full max-w-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-[2rem] p-5 sm:p-7 backdrop-blur-xl shadow-2xl flex flex-col gap-5 sm:gap-6">
        
        {/* Visor de Transcrição */}
        <div className="h-16 sm:h-20 bg-black/40 rounded-xl sm:rounded-2xl border border-white/5 p-3 sm:p-4 flex items-center justify-center text-center overflow-hidden shadow-inner relative">
          <Terminal size={14} className="absolute top-3 left-3 text-slate-600 hidden sm:block" />
          {transcript ? (
            <p className="text-slate-200 italic text-xs sm:text-sm font-semibold tracking-wide">"{transcript}"</p>
          ) : (
            <p className="text-slate-500 text-[10px] sm:text-xs font-semibold flex items-center gap-2 uppercase tracking-wider">
              <Activity size={14} className={isIntercomActive ? "animate-pulse text-cyan-500" : ""} />
              {isIntercomActive ? "Fale 'Bastian' seguido do seu comando." : "Intercomunicador Off-line"}
            </p>
          )}
        </div>

        {/* Botão de Ignição */}
        <button 
          onClick={toggleIntercom}
          className={`w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-3 font-bold text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 shadow-xl border ${
            isIntercomActive 
              ? 'bg-rose-950/80 text-rose-400 border-rose-500/30 hover:bg-rose-900 shadow-rose-500/10' 
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 border-cyan-500/50 shadow-cyan-500/25'
          }`}
        >
          {isIntercomActive ? <><MicOff size={18} /> Desativar Bastian</> : <><Mic size={18} /> Ativar Intercomunicador</>}
        </button>

        {/* HUD de Histórico de Conversa */}
        {chatLog.length > 0 && (
          <div className="border-t border-white/10 pt-5 mt-1 sm:mt-2 flex flex-col gap-3 sm:gap-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
            {chatLog.slice(-4).map((chat, idx) => {
              const isBastian = chat.role === 'bastian';
              return (
                <div key={idx} className={`flex items-start gap-3 w-full animate-in fade-in slide-in-from-bottom-2 ${isBastian ? 'flex-row' : 'flex-row-reverse'}`}>
                  
                  <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full shrink-0 border ${isBastian ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {isBastian ? <Activity size={12} className="sm:w-4 sm:h-4" /> : <MessageSquare size={12} className="sm:w-4 sm:h-4" />}
                  </div>
                  
                  <div className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl max-w-[85%] sm:max-w-[80%] ${isBastian ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-100 rounded-tl-sm' : 'bg-white/5 border border-white/10 text-slate-300 rounded-tr-sm'}`}>
                    <p className="text-[11px] sm:text-xs font-sans leading-relaxed">
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
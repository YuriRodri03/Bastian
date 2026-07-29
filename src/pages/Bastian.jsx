import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, MessageSquare } from 'lucide-react';
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

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz contínuo.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true; 
    recognition.interimResults = true; 

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
            falar("Sim, senhor?");
          }
        }
      }
    };

    recognition.onstart = () => {
      if (!isBusyRef.current) setAiState('listening');
    };
    
    recognition.onend = () => {
      if (intercomRef.current && !isBusyRef.current) {
        try { recognition.start(); } catch (e) {}
      } else if (!intercomRef.current) {
        setAiState('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const falar = async (texto) => {
    isBusyRef.current = true; 
    setAiState('processing'); 
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    try {
      // 1. Usamos fetch direto para não corromper o binário do MP3
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

      // 2. Extraímos como ArrayBuffer puro!
      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onplay = () => setAiState('speaking');
        
        audioRef.current.onended = () => {
          isBusyRef.current = false; 
          URL.revokeObjectURL(audioUrl); 
          if (intercomRef.current) {
            setAiState('listening');
            try { recognitionRef.current.start(); } catch (e) {}
          } else {
            setAiState('idle');
          }
        };

        await audioRef.current.play();
      }

    } catch (error) {
      console.error("Erro detalhado na síntese neural:", error);
      isBusyRef.current = false;
      if (intercomRef.current) {
        setAiState('listening');
        try { recognitionRef.current.start(); } catch (e) {}
      } else {
        setAiState('idle');
      }
    }
  };

  const executarComando = async (comandoTexto) => {
    isBusyRef.current = true; 
    if (recognitionRef.current) recognitionRef.current.stop(); 
    
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
    intercomRef.current = novoEstado;
    setIsIntercomActive(novoEstado);

    if (novoEstado) {
      // ----------------------------------------------------------------------
      // NOVO: "Desbloqueio" de Áudio para o iOS
      // Ao tocar no botão, forçamos um som silencioso para liberar o hardware
      // ----------------------------------------------------------------------
      if (audioRef.current) {
        // Um minúsculo arquivo MP3 contendo apenas silêncio em formato Base64
        audioRef.current.src = "data:audio/mp3;base64,//OlkAAAAAAAAAAAAAAP/7gAAAAAAO0gAAAAAT/wgAAOlkAAAAAAAAAAAAAAP/7gAAAAAAO0gAAAAAT/wgAA";
        audioRef.current.play().then(() => {
          // Assim que o silêncio tocar, pausamos. O alto-falante agora está "livre".
          audioRef.current.pause();
        }).catch(err => console.log("Aviso de desbloqueio (normal em alguns PCs):", err));
      }

      setAiState('listening');
      try {
        recognitionRef.current.start();
      } catch (e) {}
    } else {
      setAiState('idle');
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ''; 
      }
    }
  };

  const getCoreStyles = () => {
    switch (aiState) {
      case 'listening': return 'border-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.5)]';
      case 'processing': return 'border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.6)] animate-pulse';
      case 'speaking': return 'border-emerald-400 shadow-[0_0_80px_rgba(52,211,153,0.8)] scale-110 transition-transform duration-200';
      default: return 'border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)] opacity-70';
    }
  };

  const getRingStyles = (baseSpeed) => {
    if (aiState === 'processing') return `animate-[spin_${baseSpeed / 2}s_linear_infinite] border-amber-500/50`;
    if (aiState === 'speaking') return `animate-[spin_${baseSpeed}s_linear_infinite] border-emerald-500/50`;
    if (aiState === 'idle') return `animate-[spin_${baseSpeed * 2}s_linear_infinite] opacity-50`;
    return `animate-[spin_${baseSpeed}s_linear_infinite] border-cyan-500/50`; 
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center relative overflow-hidden font-mono select-none p-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d405_1px,transparent_1px),linear-gradient(to_bottom,#06b6d405_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      
      <div className="relative z-10 flex flex-col items-center mb-12">
        <div className="relative flex items-center justify-center w-80 h-80 transition-all duration-500">
          <div className={`absolute inset-0 border-[1px] border-t-current rounded-full ${getRingStyles(4)}`}></div>
          <div className={`absolute inset-4 border-[1px] border-b-current rounded-full ${getRingStyles(6)}`} style={{ animationDirection: 'reverse' }}></div>
          <div className={`absolute inset-10 border-[2px] border-dashed rounded-full ${getRingStyles(8)}`}></div>
          <div className={`absolute inset-20 border-2 border-l-current border-r-current rounded-full ${getRingStyles(3)}`} style={{ animationDirection: 'reverse' }}></div>
          
          <div className={`w-24 h-24 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border-2 transition-all duration-300 ${getCoreStyles()}`}>
            <div className={`w-6 h-6 rounded-full ${aiState === 'processing' ? 'bg-amber-300 animate-ping' : aiState === 'speaking' ? 'bg-emerald-300 animate-bounce' : 'bg-cyan-300 animate-pulse'}`}></div>
            <div className="absolute w-3 h-3 bg-white rounded-full"></div>
          </div>
        </div>

        <div className="mt-8 text-center flex flex-col items-center gap-2">
          <h1 className="text-white text-3xl font-bold tracking-[0.3em] uppercase drop-shadow-lg">
            BASTIAN <span className="text-cyan-500 text-lg">CORE</span>
          </h1>
          <p className={`text-xs tracking-widest uppercase font-semibold ${
            aiState === 'listening' ? 'text-cyan-400 animate-pulse' :
            aiState === 'processing' ? 'text-amber-400 animate-pulse' :
            aiState === 'speaking' ? 'text-emerald-400' : 'text-slate-500'
          }`}>
            {aiState === 'listening' ? 'Aguardando palavra-chave "Bastian"...' :
             aiState === 'processing' ? 'Processando rede neural...' :
             aiState === 'speaking' ? 'Transmitindo resposta...' : 'Sistema em repouso'}
          </p>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
        <div className="h-20 bg-black/50 rounded-xl border border-white/5 p-4 flex items-center justify-center text-center overflow-hidden">
          {transcript ? (
            <p className="text-slate-300 italic text-sm">"{transcript}"</p>
          ) : (
            <p className="text-slate-600 text-xs flex items-center gap-2">
              <Activity size={14} className={isIntercomActive ? "animate-pulse text-cyan-500" : ""} />
              {isIntercomActive ? "Fale 'Bastian' seguido do seu comando." : "Ative o intercomunicador para iniciar."}
            </p>
          )}
        </div>

        <button 
          onClick={toggleIntercom}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold uppercase tracking-wider transition-all duration-300 shadow-xl ${
            isIntercomActive 
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 shadow-rose-500/10' 
              : 'bg-cyan-600 text-white hover:bg-cyan-500 border border-transparent shadow-cyan-500/25'
          }`}
        >
          {isIntercomActive ? <><MicOff size={20} /> Desativar Bastian</> : <><Mic size={20} /> Ativar Intercomunicador</>}
        </button>

        {chatLog.length > 0 && (
          <div className="border-t border-white/10 pt-4 mt-2 max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-3">
            {chatLog.slice(-3).map((chat, idx) => (
              <div key={idx} className={`flex items-start gap-3 text-xs ${chat.role === 'user' ? 'text-slate-400' : 'text-cyan-300'}`}>
                {chat.role === 'bastian' ? <Activity size={14} className="mt-0.5 shrink-0" /> : <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-50" />}
                <p className="leading-relaxed font-sans">{chat.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Elemento de áudio configurado corretamente */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
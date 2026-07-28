import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, MessageSquare } from 'lucide-react';
import { enviarComandoParaIA } from '../services/aiService';

export default function Bastian() {
  const [aiState, setAiState] = useState('idle');
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [chatLog, setChatLog] = useState([]);
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  
  const intercomRef = useRef(false); 
  const isBusyRef = useRef(false); 
  // NOVO: Ref para saber se ele acabou de ser chamado e está aguardando o comando
  const isAwakeRef = useRef(false); 

  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, []);

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

      // SÓ PROCESSA QUANDO A FRASE FOR CONCLUÍDA (Final)
      if (finalTranscript) {
        const text = finalTranscript.toLowerCase().trim();

        // 1. Se o Bastian já foi "acordado" no turno anterior, a frase atual é o comando!
        if (isAwakeRef.current) {
          isAwakeRef.current = false; // Reseta para não ficar executando tudo pra sempre
          if (text.length > 2) {
            executarComando(text);
          }
          return;
        }

        // 2. Se não estava acordado, procura pela palavra-chave
        const regex = /(?:bastian|bastião|bastia)(.*)/i;
        const match = text.match(regex);

        if (match) {
          const comando = match[1].trim();
          
          if (comando.length > 3) {
            // Exemplo: O usuário disse tudo junto "Bastian registre uma despesa"
            executarComando(comando);
          } else {
            // Exemplo: O usuário disse APENAS "Bastian". Ele responde e fica aguardando.
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
      recognition.stop();
      synthRef.current.cancel();
    };
  }, []);

  // Função para fazer o Bastian falar
  const falar = (texto) => {
    isBusyRef.current = true; // Tranca os ouvidos
    setAiState('speaking');
    
    // Cancela qualquer fala que ainda esteja ocorrendo para evitar sobreposição
    synthRef.current.cancel(); 

    const utterance = new SpeechSynthesisUtterance(texto);
    
    // --- NOVA LÓGICA DE SELEÇÃO DE VOZ RIGOROSA ---
    const vozesDisponiveis = synthRef.current.getVoices();
    
    // 1. Definição das vozes alvo (as mais humanas e masculinas disponíveis gratuitamente)
    // Prioridade 1: Microsoft Antonio (Edge - Altíssima qualidade natural)
    // Prioridade 2: Google português do Brasil (Chrome - Boa qualidade)
    const nomesVozesAlvo = [
      'Microsoft Antonio Online (Natural) - Portuguese (Brazil)',
      'Google português do Brasil'
    ];

    let vozSelecionada = null;

    // Tenta encontrar uma das vozes alvo específicas
    for (const nomeVoz of nomesVozesAlvo) {
      vozSelecionada = vozesDisponiveis.find(v => v.name === nomeVoz);
      if (vozSelecionada) break; // Achou uma das melhores, para de procurar
    }

    // Fallback: Se não achou as vozes premium, procura QUALQUER voz masculina em PT-BR
    if (!vozSelecionada) {
      vozSelecionada = vozesDisponiveis.find(v => 
        v.lang.startsWith('pt') && 
        (v.name.includes('Daniel') || v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('masculino'))
      );
    }

    // Aplica a voz se encontrada
    if (vozSelecionada) {
      utterance.voice = vozSelecionada;
      // console.log(`Bastian usando voz: ${vozSelecionada.name}`); // Descomente para depurar
    } else {
      // console.warn("Nenhuma voz masculina preferencial encontrada. Usando padrão do sistema.");
    }

    utterance.lang = 'pt-BR';
    utterance.pitch = 0.9; // Levemente mais grave para imponência
    utterance.rate = 1.0;  // VELOCIDADE NORMAL (Humana)
    
    utterance.onend = () => {
      isBusyRef.current = false; 
      if (intercomRef.current) {
        setAiState('listening');
        try { recognitionRef.current.start(); } catch (e) {}
      } else {
        setAiState('idle');
      }
    };

    utterance.onerror = (event) => {
      console.error("Erro na síntese de fala:", event);
      isBusyRef.current = false;
      if (intercomRef.current) {
        setAiState('listening');
        try { recognitionRef.current.start(); } catch (e) {}
      }
    };

    synthRef.current.speak(utterance);
  };

  const executarComando = async (comandoTexto) => {
    isBusyRef.current = true; 
    recognitionRef.current.stop(); 
    
    setAiState('processing');
    setTranscript(''); // Limpa o texto da tela para a nova resposta
    setChatLog(prev => [...prev, { role: 'user', text: comandoTexto }]);

    const resultado = await enviarComandoParaIA(comandoTexto);
    
    setChatLog(prev => [...prev, { role: 'bastian', text: resultado.mensagem }]);
    falar(resultado.mensagem);
  };

  const toggleIntercom = () => {
    if (isIntercomActive) {
      setIsIntercomActive(false);
      intercomRef.current = false;
      isAwakeRef.current = false; // Desliga o gatilho se estiver ativo
      recognitionRef.current.stop();
      setAiState('idle');
      setTranscript('');
    } else {
      setIsIntercomActive(true);
      intercomRef.current = true;
      setAiState('listening');
      try { recognitionRef.current.start(); } catch (e) {}
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
    </div>
  );
}
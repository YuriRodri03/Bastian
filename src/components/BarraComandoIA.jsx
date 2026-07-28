// src/components/BarraComandoIA.jsx
import React, { useState } from 'react';
import { Bot, Send, Loader2, Mic, Check, AlertCircle } from 'lucide-react';
import { enviarComandoParaIA } from '../services/aiService';

export default function BarraComandoIA() {
  const [comando, setComando] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Estado para a notificação flutuante (Toast)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  const processarComando = async (texto) => {
    if (!texto.trim()) return;

    setLoading(true);
    const resultado = await enviarComandoParaIA(texto);
    setLoading(false);

    // Substituímos o alert por Toast elegante baseando-se no sucesso
    if (resultado.sucesso) {
      showToast(resultado.mensagem, 'success');
    } else {
      showToast(resultado.mensagem, 'error');
    }

    setComando(''); 
  };

  const iniciarEscuta = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      showToast("Seu navegador não suporta reconhecimento de voz.", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const textoReconhecido = event.results[0][0].transcript;
      setComando(textoReconhecido); 
      processarComando(textoReconhecido); 
    };

    recognition.onerror = (event) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleEnviarForm = (e) => {
    e.preventDefault();
    processarComando(comando);
  };

  return (
    <>
      {/* Toast Flutuante da IA */}
      {toast.show && (
        <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          toast.type === 'error' 
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-40">
        <form 
          onSubmit={handleEnviarForm} 
          className="bg-black/60 backdrop-blur-xl border border-indigo-500/30 p-2 rounded-2xl flex items-center gap-3 w-full shadow-2xl shadow-indigo-500/10"
        >
          <div className="p-2 bg-indigo-500/20 rounded-xl">
            <Bot size={20} className="text-indigo-400" />
          </div>
          
          <input
            type="text"
            value={comando}
            onChange={(e) => setComando(e.target.value)}
            placeholder={isListening ? "Ouvindo... Pode falar!" : "Peça algo à IA"}
            className="flex-1 bg-transparent text-sm text-slate-200 focus:outline-none placeholder-slate-400"
            disabled={loading}
          />

          <button
            type="button"
            onClick={iniciarEscuta}
            disabled={loading || isListening}
            className={`p-2 rounded-xl transition-all ${
              isListening 
                ? 'bg-red-500/20 text-red-500 animate-pulse' 
                : 'bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-700'
            }`}
            title="Falar e enviar direto"
          >
            <Mic size={18} />
          </button>

          <button 
            type="submit" 
            disabled={loading || !comando.trim()}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </>
  );
}
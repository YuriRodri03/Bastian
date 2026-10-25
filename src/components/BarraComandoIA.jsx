// src/components/BarraComandoIA.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare } from 'lucide-react';

import { GeminiLiveConnection } from '../services/liveAiService';
import { GerenciadorDeAudio } from '../services/audioManager';

import { useFinanceStore } from '../store/useFinanceStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useFitnessStore } from '../store/useFitnessStore';
import { useChatStore } from '../store/useChatStore'; 

export default function BarraComandoIA() {
  const [aiState, setAiState] = useState('idle'); 
  // CORREÇÃO CRÍTICA DO TRAVAMENTO: O Ref acompanha o estado em tempo real dentro das funções fechadas
  const aiStateRef = useRef('idle'); 

  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [ultimaMensagem, setUltimaMensagem] = useState(null);
  
  const liveConnectionRef = useRef(null);
  const audioManagerRef = useRef(null);
  const speakingTimeoutRef = useRef(null);
  const mensagemTimeoutRef = useRef(null);
  const hasGreetedRef = useRef(false); 

  // Função centralizada para mudar o estado e a referência de forma segura
  const updateAiState = (newState) => {
    aiStateRef.current = newState;
    setAiState(newState);
  };

  useEffect(() => {
    useChatStore.getState().fetchMemoria();
  }, []);

  const limparMarkdown = (texto) => {
    if (!texto) return '';
    return texto.replace(/[*_~`#>-]/g, '').trim();
  };

  const gerarContextoDinâmico = () => {
    const dataHojeExata = new Date().toISOString().split('T')[0];
    const horaAtualExata = new Date().toLocaleTimeString();

    const saldo = useFinanceStore.getState().balance;
    const transacoes = useFinanceStore.getState().transactions.map(t => ({ id: t.id, descricao: t.description, valor: t.amount, tipo: t.type, data: t.date }));
    const compromissos = useAgendaStore.getState().agendaItems.map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, concluido: e.is_completed }));
    
    return `
      Data Atual: ${dataHojeExata} | Hora: ${horaAtualExata}
      Saldo: R$ ${saldo.toFixed(2)}
      Finanças: ${JSON.stringify(transacoes)}
      Agenda: ${JSON.stringify(compromissos)}
    `;
  };

  const exibirMensagem = (texto) => {
    setUltimaMensagem(texto);
    if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
    mensagemTimeoutRef.current = setTimeout(() => setUltimaMensagem(null), 8000);
  };

  const obterSaudacaoTemporal = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const ligarSistema = async () => {
    updateAiState('starting');
    setIsIntercomActive(true);

    try {
      audioManagerRef.current = new GerenciadorDeAudio();
      
      const aoCaptarSom = (base64Pcm) => {
        if (liveConnectionRef.current) liveConnectionRef.current.enviarAudioVoz(base64Pcm);
      };

      const aoDetectarSilencio = () => {
        // CORREÇÃO: Só avisa o Gemini que você terminou se ele realmente estiver escutando.
        // Isso impede o loop infinito de "turnComplete" que o deixava calado e travado no laranja.
        if (liveConnectionRef.current && aiStateRef.current === 'listening') {
          liveConnectionRef.current.forcarResposta();
          updateAiState('processing'); 
        }
      };

      const aoComecarFalar = () => {
        if (aiStateRef.current === 'speaking' || aiStateRef.current === 'processing') {
          if (audioManagerRef.current) audioManagerRef.current.pararAudioAtual();
          if (liveConnectionRef.current) liveConnectionRef.current.interromperGeracao();
        }
        updateAiState('listening');
      };

      const aoReceberAudioDaIA = (base64Audio) => {
        updateAiState('speaking'); 
        if (audioManagerRef.current) audioManagerRef.current.tocarAudio(base64Audio);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => {
          if (aiStateRef.current === 'speaking') updateAiState('listening');
        }, 1500); 
      };

      const aoReceberTextoDaIA = (textoBruto) => {
        const textoLimpo = limparMarkdown(textoBruto);
        if (textoLimpo.match(/^(Complying|Prioritizing|I've|I will|I am|Thinking|Understood|Processing)/i)) return;

        if (textoLimpo.length > 0) {
          exibirMensagem(textoLimpo);
          useChatStore.getState().adicionarMemoria(textoLimpo);
        }
      };

      const aoReceberChamadaDeFuncao = async (functionCallInfo) => {
        updateAiState('processing'); 
        const { id, name, args } = functionCallInfo;
        const dataHoje = new Date().toISOString().split('T')[0];

        // 1. Resposta Otimista (Agora como um OBJETO REAL para a API não travar)
        if (name === "registrar_dado" || name === "alterar_dado") {
           liveConnectionRef.current.enviarRespostaDeFuncao(id, name, { status: "sucesso", detalhe: "Ação aceita pelo banco local." });
        }

        // 2. Execução de Fundo
        try {
          if (name === "registrar_dado") {
            // CORREÇÃO: "args.dados" já vem como objeto nativo agora, sem necessidade de JSON.parse quebrado.
            const dados = args.dados || {}; 
            
            switch (args.entidade) {
              case 'agenda':
                useAgendaStore.getState().addAgendaItem({ 
                  title: dados.titulo || dados.title || "Novo Evento", 
                  date: dados.data || dados.date || dataHoje, 
                  time: dados.hora || dados.time || null 
                });
                exibirMensagem(`📅 Agenda: ${dados.titulo || "Evento Adicionado"}`);
                break;
              case 'despesa':
                useFinanceStore.getState().addTransaction({ amount: Number(dados.valor), description: dados.descricao, type: 'despesa', category: dados.categoria || 'Outros', date: dataHoje, status: 'pago' });
                exibirMensagem(`💸 Despesa: ${dados.descricao}`);
                break;
              case 'receita':
                useFinanceStore.getState().addTransaction({ amount: Number(dados.valor), description: dados.descricao, type: 'receita', category: dados.categoria || 'Outros', date: dataHoje, status: 'pago' });
                exibirMensagem(`📈 Receita: ${dados.descricao}`);
                break;
              case 'peso':
                useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', Number(dados.peso), 'kg');
                exibirMensagem(`⚖️ Peso: ${dados.peso} kg`);
                break;
              case 'treino':
                useFitnessStore.getState().addHealthLog('treino', dados.modalidade, Number(dados.duracao), 'min');
                exibirMensagem(`🏋️ Treino: ${dados.modalidade}`);
                break;
              case 'inbox':
                useInboxStore.getState().addInboxTask(dados.titulo, dados.data || dataHoje);
                exibirMensagem(`📥 Inbox: ${dados.titulo}`);
                break;
              case 'kanban':
                useKanbanStore.getState().addTask(dados.titulo, dados.status || 'backlog');
                exibirMensagem(`📋 Kanban: ${dados.titulo}`);
                break;
            }
          } 
          
          else if (name === "alterar_dado") {
            if (args.acao === 'concluir') {
              if (args.entidade === 'inbox') useInboxStore.getState().toggleInboxTask(args.id, false);
              if (args.entidade === 'agenda') useAgendaStore.getState().toggleItemCompletion(args.id, false);
              exibirMensagem(`✅ Item concluído`);
            } else if (args.acao === 'deletar') {
              if (args.entidade === 'financas') useFinanceStore.getState().deleteTransaction(args.id);
              if (args.entidade === 'agenda') useAgendaStore.getState().deleteAgendaItem(args.id);
              if (args.entidade === 'inbox') useInboxStore.getState().deleteInboxTask(args.id);
              if (args.entidade === 'kanban') useKanbanStore.getState().deleteTask(args.id);
              exibirMensagem(`🗑️ Registro apagado.`);
            }
          } 
          
          else if (name === "consultar_dados") {
             let relatorio = {};
             
             if (args.entidade === 'financas') {
                relatorio = { saldo: useFinanceStore.getState().balance, historico: useFinanceStore.getState().transactions };
             } 
             else if (args.entidade === 'agenda') {
                relatorio = { agenda: useAgendaStore.getState().agendaItems };
             }
             else {
                relatorio = { resumo_geral: gerarContextoDinâmico() }; 
             }

             exibirMensagem(`📊 Lendo banco de dados (${args.entidade})...`);
             liveConnectionRef.current.enviarRespostaDeFuncao(id, name, relatorio);
          }

        } catch (erro) {
          console.error("Erro interno ao processar ferramenta:", erro);
        }
      };

      liveConnectionRef.current = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao);
      await liveConnectionRef.current.conectar(gerarContextoDinâmico());
      await audioManagerRef.current.inicializar(aoCaptarSom, aoDetectarSilencio, aoComecarFalar); 

      const saudacao = obterSaudacaoTemporal();

      setTimeout(() => {
        if (liveConnectionRef.current) {
          if (!hasGreetedRef.current) {
            liveConnectionRef.current.enviarComandoSilencioso(`Responda apenas com esta frase exata: "${saudacao}, senhor. Como posso ajudar?"`);
            hasGreetedRef.current = true;
          } else {
            liveConnectionRef.current.enviarComandoSilencioso("Responda apenas com a frase: 'Pois não?'");
          }
        }
      }, 1000); 

      updateAiState('listening');

    } catch (erro) {
      desligarSistema();
      alert("Falha crítica no sistema neural.");
    }
  };

  const desligarSistema = () => {
    if (audioManagerRef.current) { audioManagerRef.current.parar(); audioManagerRef.current = null; }
    if (liveConnectionRef.current) { liveConnectionRef.current.desconectar(); liveConnectionRef.current = null; }
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    setIsIntercomActive(false);
    updateAiState('idle');
    setUltimaMensagem(null);
  };

  const toggleIntercom = () => {
    if (isIntercomActive) desligarSistema();
    else ligarSistema();
  };

  useEffect(() => { return () => desligarSistema(); }, []);

  const getRingColorClass = () => {
    if (!isIntercomActive) return 'text-slate-600/40 drop-shadow-none';
    switch (aiState) {
      case 'listening': return 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]';
      case 'processing': return 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]';
      case 'speaking': return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]';
      default: return 'text-cyan-700/60'; 
    }
  };

  const getCoreStyles = () => {
    if (!isIntercomActive) return 'border-slate-700/80 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-slate-900/90';
    switch (aiState) {
      case 'listening': return 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] bg-slate-900 scale-105';
      case 'processing': return 'border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)] bg-slate-900 animate-pulse';
      case 'speaking': return 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)] bg-slate-900';
      default: return 'border-cyan-700/50 bg-slate-900';
    }
  };

  return (
    <div className="fixed bottom-6 right-4 sm:right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
      
      {ultimaMensagem && (
        <div className="pointer-events-auto max-w-[280px] sm:max-w-xs bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-2xl rounded-br-sm shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${aiState === 'speaking' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
              {aiState === 'speaking' ? <Activity size={12} /> : <MessageSquare size={12} />}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {ultimaMensagem}
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-auto relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 transition-all duration-300">
        
        {isIntercomActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute inset-[-10%] border border-transparent border-t-current border-r-current rounded-full transition-colors duration-500 opacity-50 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_4s_linear_infinite]'}`}></div>
            <div className={`absolute inset-[5%] border-2 border-transparent border-b-current border-l-current rounded-full transition-colors duration-500 ${getRingColorClass()} ${aiState === 'processing' ? 'animate-[spin_1.5s_linear_reverse_infinite]' : 'animate-[spin_5s_linear_reverse_infinite]'}`}></div>
          </div>
        )}

        <button 
          onClick={toggleIntercom}
          className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center backdrop-blur-md border-2 z-20 cursor-pointer active:scale-95 transition-all duration-300 ${getCoreStyles()}`}
          title={!isIntercomActive ? "Ativar Bastian" : "Desativar Bastian"}
        >
          <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors duration-300 ${!isIntercomActive ? 'bg-slate-500' : aiState === 'processing' ? 'bg-amber-400 animate-ping' : aiState === 'speaking' ? 'bg-emerald-400 animate-bounce' : 'bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]'}`}></div>
          {isIntercomActive && <div className="absolute w-1.5 h-1.5 bg-white/90 rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]"></div>}
        </button>

      </div>
    </div>
  );
}
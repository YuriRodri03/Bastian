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

export default function BarraComandoIA() {
  const [aiState, setAiState] = useState('idle'); 
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [ultimaMensagem, setUltimaMensagem] = useState(null);
  
  const liveConnectionRef = useRef(null);
  const audioManagerRef = useRef(null);
  const speakingTimeoutRef = useRef(null);
  const mensagemTimeoutRef = useRef(null);

  // =========================================================================
  // NOVOS MÓDULOS DE MEMÓRIA DE CURTO PRAZO
  // =========================================================================
  const hasGreetedRef = useRef(false); // Trava para não repetir o relatório inicial
  const sessionMemoryRef = useRef([]); // Guarda o histórico da conversa atual

  const limparMarkdown = (texto) => {
    if (!texto) return '';
    return texto.replace(/[*_~`#>-]/g, '').trim();
  };

  // =========================================================================
  // MENTE DO BASTIAN (COM RELÓGIO E REGRAS CRÍTICAS)
  // =========================================================================
  const gerarContextoDinâmico = () => {
    // O Bastian agora sabe exatamente em que dia e hora está vivendo
    const dataHojeExata = new Date().toISOString().split('T')[0];
    const horaAtualExata = new Date().toLocaleTimeString();

    const saldo = useFinanceStore.getState().balance;
    const transacoes = useFinanceStore.getState().transactions.map(t => ({ id: t.id, descricao: t.description, valor: t.amount, tipo: t.type, data: t.date, status: t.status }));
    const compromissos = useAgendaStore.getState().agendaItems.map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, concluido: e.is_completed }));
    const pendencias = useInboxStore.getState().inboxTasks.map(t => ({ id: t.id, titulo: t.title, data_limite: t.date, concluido: t.completed }));
    const kanban = useKanbanStore.getState().tasks.map(t => ({ id: t.id, titulo: t.title, status: t.status }));
    const historicoSaude = useFitnessStore.getState().healthLogs.map(l => ({ categoria: l.type, registro: l.name, valor: l.value, unidade: l.unit, data: l.date }));
    
    // Pega as últimas falas do Bastian para ele saber o que acabou de dizer
    const historicoRecente = sessionMemoryRef.current
      .slice(-5) 
      .map(msg => `[${msg.hora}] Você disse: ${msg.texto}`)
      .join(' | ');

    return `
      INFORMAÇÕES DO SISTEMA (TEMPO REAL):
      - Data de Hoje: ${dataHojeExata}
      - Hora Atual: ${horaAtualExata}

      Memória de Longo Prazo Atualizada:
      - Saldo Atual: R$ ${saldo.toFixed(2)}
      - Fluxo de Caixa: ${JSON.stringify(transacoes)}
      - Agenda: ${JSON.stringify(compromissos)}
      - Inbox: ${JSON.stringify(pendencias)}
      - Kanban: ${JSON.stringify(kanban)}
      - Saúde: ${JSON.stringify(historicoSaude)}

      Memória de Curto Prazo (O que você acabou de falar com o usuário):
      ${historicoRecente || 'Nenhuma conversa recente ainda.'}

      REGRAS CRÍTICAS DE COMPORTAMENTO:
      1. NÃO REPITA INFORMAÇÕES: Se o histórico de curto prazo mostrar que você já deu uma resposta, não a repita a menos que o usuário peça.
      2. OBRIGAÇÃO DE USAR FERRAMENTAS: Se o usuário pedir para agendar, criar tarefa ou registrar gasto/peso, VOCÊ DEVE OBRIGATORIAMENTE usar a respectiva "Function/Tool". 
      3. FORMATO DE DATA: Quando usar uma ferramenta de agendamento, calcule a data baseada na "Data de Hoje" e passe ESTRITAMENTE no formato YYYY-MM-DD.
      4. NUNCA minta dizendo que agendou algo se você não tiver executado a chamada de função correspondente.
    `;
  };

  const exibirMensagem = (texto) => {
    setUltimaMensagem(texto);
    if (mensagemTimeoutRef.current) clearTimeout(mensagemTimeoutRef.current);
    mensagemTimeoutRef.current = setTimeout(() => setUltimaMensagem(null), 8000);
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
        if (textoLimpo.length > 0) {
          exibirMensagem(textoLimpo);
          // Grava a fala do Bastian na memória de curto prazo
          sessionMemoryRef.current.push({
            hora: new Date().toLocaleTimeString(),
            texto: textoLimpo
          });
        }
      };

      const aoReceberChamadaDeFuncao = async (functionCallInfo) => {
        setAiState('processing'); 
        const { id, name, args } = functionCallInfo;
        let resultadoDaOperacao = "";
        
        // Puxa a data novamente apenas por segurança
        const dataHoje = new Date().toISOString().split('T')[0];

        try {
          switch (name) {
            case "adicionar_despesa":
              await useFinanceStore.getState().addTransaction({ amount: Number(args.valor), description: args.descricao, type: 'despesa', category: args.categoria || 'Outros', date: dataHoje, status: 'pago' });
              resultadoDaOperacao = "Despesa salva.";
              exibirMensagem(`💸 Gasto Salvo: ${args.descricao}`);
              break;
            case "adicionar_receita":
              await useFinanceStore.getState().addTransaction({ amount: Number(args.valor), description: args.descricao, type: 'receita', category: args.categoria || 'Outros', date: dataHoje, status: 'pago' });
              resultadoDaOperacao = "Receita salva.";
              exibirMensagem(`📈 Receita Adicionada: ${args.descricao}`);
              break;
            case "adicionar_agenda":
              await useAgendaStore.getState().addAgendaItem({ title: args.titulo, date: args.data, time: args.hora || null });
              resultadoDaOperacao = "Evento agendado.";
              exibirMensagem(`📅 Agendado: ${args.titulo}`);
              break;
            case "registrar_peso":
              await useFitnessStore.getState().addHealthLog('peso', 'Peso Corporal', Number(args.peso), 'kg');
              resultadoDaOperacao = "Peso gravado.";
              exibirMensagem(`⚖️ Peso Gravado: ${args.peso} kg`);
              break;
            case "adicionar_treino":
              await useFitnessStore.getState().addHealthLog('treino', args.modalidade, Number(args.duracao), 'min');
              resultadoDaOperacao = "Treino salvo.";
              exibirMensagem(`🏋️ Treino Registrado: ${args.modalidade}`);
              break;
            case "adicionar_tarefa_inbox":
              await useInboxStore.getState().addInboxTask(args.titulo, args.data || dataHoje);
              resultadoDaOperacao = "Tarefa salva.";
              exibirMensagem(`📥 Inbox: ${args.titulo}`);
              break;
            case "adicionar_kanban":
              await useKanbanStore.getState().addTask(args.titulo, args.status || 'backlog');
              resultadoDaOperacao = "Cartão Kanban criado.";
              exibirMensagem(`📋 Kanban [${args.status || 'backlog'}]: ${args.titulo}`);
              break;
            case "concluir_tarefa":
              if (args.origem === 'inbox') { await useInboxStore.getState().toggleInboxTask(args.id, false); resultadoDaOperacao = "Tarefa concluída."; exibirMensagem(`✅ Tarefa Concluída!`); } 
              else if (args.origem === 'agenda') { await useAgendaStore.getState().toggleItemCompletion(args.id, false); resultadoDaOperacao = "Evento concluído."; exibirMensagem(`✅ Compromisso Concluído!`); }
              break;
            case "relatorio_diario":
              resultadoDaOperacao = gerarContextoDinâmico();
              exibirMensagem(`📊 Consultando Bancos de Dados...`);
              break;
            default:
              resultadoDaOperacao = "Comando desconhecido.";
          }
        } catch (erro) {
          resultadoDaOperacao = "Erro interno.";
        }

        if (liveConnectionRef.current) liveConnectionRef.current.enviarRespostaDeFuncao(id, name, resultadoDaOperacao);
      };

      liveConnectionRef.current = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao);
      await liveConnectionRef.current.conectar(gerarContextoDinâmico());
      await audioManagerRef.current.inicializar(aoCaptarSom, aoDetectarSilencio); 

      // LÓGICA DE SAUDAÇÃO INTELIGENTE
      setTimeout(() => {
        if (liveConnectionRef.current) {
          if (!hasGreetedRef.current) {
            liveConnectionRef.current.enviarComandoSilencioso("Sistema Global ativado pela primeira vez hoje. Faça uma saudação executiva curta. Cruze a Memória de Longo Prazo com a data de hoje e alerte se houver pendências cruciais.");
            hasGreetedRef.current = true;
          } else {
            liveConnectionRef.current.enviarComandoSilencioso("O usuário reabriu a comunicação de voz. NÃO faça o relatório inicial novamente. Apenas diga algo muito curto como 'Ouvindo, senhor', 'Pronto' ou 'Pois não?'.");
          }
        }
      }, 1000); 

      setAiState('listening');

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
    setAiState('idle');
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
      
      {/* BALÃO DE FALA FLUTUANTE */}
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

      {/* ORBE MINIMALISTA */}
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
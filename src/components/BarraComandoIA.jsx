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
  const [isIntercomActive, setIsIntercomActive] = useState(false);
  const [ultimaMensagem, setUltimaMensagem] = useState(null);
  
  const liveConnectionRef = useRef(null);
  const audioManagerRef = useRef(null);
  const speakingTimeoutRef = useRef(null);
  const mensagemTimeoutRef = useRef(null);

  const hasGreetedRef = useRef(false); 

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
    const transacoes = useFinanceStore.getState().transactions.map(t => ({ id: t.id, descricao: t.description, valor: t.amount, tipo: t.type, data: t.date, status: t.status }));
    const compromissos = useAgendaStore.getState().agendaItems.map(e => ({ id: e.id, titulo: e.title, data: e.date, hora: e.time, concluido: e.is_completed }));
    const pendencias = useInboxStore.getState().inboxTasks.map(t => ({ id: t.id, titulo: t.title, data_limite: t.date, concluido: t.completed }));
    const kanban = useKanbanStore.getState().tasks.map(t => ({ id: t.id, titulo: t.title, status: t.status }));
    const historicoSaude = useFitnessStore.getState().healthLogs.map(l => ({ categoria: l.type, registro: l.name, valor: l.value, unidade: l.unit, data: l.date }));
    
    const memoriasNuvem = useChatStore.getState().mensagensRecentes;
    const historicoRecente = memoriasNuvem.length > 0 
      ? memoriasNuvem.map((msg, idx) => `[Memória ${idx + 1}]: Você disse: "${msg}"`).join(' | ')
      : 'Nenhuma conversa recente.';

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

      Memória de Curto Prazo em Nuvem:
      ${historicoRecente}

      REGRAS CRÍTICAS DE COMPORTAMENTO:
      1. NUNCA FAÇA UM RELATÓRIO A NÃO SER QUE O USUÁRIO PEÇA EXPLICITAMENTE.
      2. OBRIGAÇÃO DE USAR FERRAMENTAS: Use 'registrar_dado', 'alterar_dado' ou 'consultar_dados' ANTES de responder.
      3. FORMATO DE DATA: ESTRITAMENTE YYYY-MM-DD.
      4. Respostas curtas. Haja como um executivo auxiliando o usuário (Yuri).
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

      // NOVO: A INTERRUPÇÃO ATIVA J.A.R.V.I.S.
      const aoComecarFalar = () => {
        if (audioManagerRef.current && audioManagerRef.current.isPlaying()) {
          audioManagerRef.current.pararAudioAtual(); // Cala a caixa de som imediatamente
          if (liveConnectionRef.current) {
            liveConnectionRef.current.interromperGeracao(); // Avisa o Gemini para parar de gerar
          }
        }
        setAiState('listening');
      };

      const aoReceberAudioDaIA = (base64Audio) => {
        setAiState('speaking'); 
        if (audioManagerRef.current) audioManagerRef.current.tocarAudio(base64Audio);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = setTimeout(() => setAiState('listening'), 1500); 
      };

      const aoReceberTextoDaIA = (textoBruto) => {
        const textoLimpo = limparMarkdown(textoBruto);
        if (textoLimpo.match(/^(Complying|Prioritizing|I've|I will|I am|Thinking|Understood|Processing)/i)) return;

        if (textoLimpo.length > 0) {
          exibirMensagem(textoLimpo);
          useChatStore.getState().adicionarMemoria(textoLimpo);
        }
      };

      // NOVO: ROTEADOR DE FUNÇÕES UNIFICADAS COM RESPOSTA OTIMISTA
      const aoReceberChamadaDeFuncao = async (functionCallInfo) => {
        setAiState('processing'); 
        const { id, name, args } = functionCallInfo;
        const dataHoje = new Date().toISOString().split('T')[0];

        // 1. SE FOR GRAVAÇÃO, RESPONDE INSTANTANEAMENTE PARA O BASTIAN NÃO TRAVAR
        if (name === "registrar_dado" || name === "alterar_dado") {
           liveConnectionRef.current.enviarRespostaDeFuncao(id, name, "{\"status\": \"sucesso\", \"detalhe\": \"Executando no banco local.\"}");
        }

        // 2. EXECUÇÃO EM BACKGROUND
        try {
          if (name === "registrar_dado") {
            const dados = JSON.parse(args.payload_json);
            
            switch (args.entidade) {
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
              case 'agenda':
                useAgendaStore.getState().addAgendaItem({ title: dados.titulo, date: dados.data, time: dados.hora || null });
                exibirMensagem(`📅 Agenda: ${dados.titulo}`);
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
             // Se for consulta, precisamos gerar o relatório real e mandar de volta AGORA (não otimista)
             const relatorioAtual = gerarContextoDinâmico();
             exibirMensagem(`📊 Lendo banco de dados...`);
             liveConnectionRef.current.enviarRespostaDeFuncao(id, name, relatorioAtual);
          }

        } catch (erro) {
          console.error("Erro ao processar ferramenta de fundo:", erro);
        }
      };

      liveConnectionRef.current = new GeminiLiveConnection(aoReceberAudioDaIA, aoReceberTextoDaIA, aoReceberChamadaDeFuncao);
      await liveConnectionRef.current.conectar(gerarContextoDinâmico());
      
      // Passando o NOVO parâmetro aoComecarFalar
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
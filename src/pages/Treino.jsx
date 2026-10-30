import React, { useState, useEffect, useMemo } from 'react';
import { useFitnessStore } from '../store/useFitnessStore';
import { 
  Dumbbell, Trash2, Calendar, Scale, Ruler, Flame, Play, Plus, 
  ChevronDown, ChevronUp, Edit3, Check, X, UserCircle, AlertCircle, 
  Timer, RotateCcw, Search, TrendingUp, CheckCircle2
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';

// Bipe curto via Web Audio API para o fim do descanso entre séries
const playRestBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.15);
      osc.stop(ctx.currentTime + idx * 0.15 + 0.3);
    });
  } catch (e) {
    console.warn('Áudio bloqueado:', e);
  }
};

export default function Treino() {
  // Conectado diretamente ao store global (sincronizado em tempo real com o Bastian!)
  const { 
    healthLogs, 
    fichasTreino, 
    addHealthLog, 
    deleteHealthLog, 
    fetchHealthLogs,
    addFichaTreino,
    updateFichaTreino,
    deleteFichaTreino,
    concluirFichaTreino
  } = useFitnessStore();
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  const triggerSafeDelete = (uniqueKey, callback) => {
    if (confirmDeleteId === uniqueKey) {
      callback();
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(uniqueKey);
      setTimeout(() => setConfirmDeleteId(prev => prev === uniqueKey ? null : prev), 3000);
    }
  };

  useEffect(() => {
    fetchHealthLogs();
  }, [fetchHealthLogs]);

  // =========================================================================
  // 1. CRONÔMETRO DE DESCANSO ENTRE SÉRIES (REST TIMER)
  // =========================================================================
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  useEffect(() => {
    if (!restRunning) return;
    if (restSeconds <= 0) {
      setRestRunning(false);
      playRestBeep();
      showToast('Descanso finalizado! Próxima série.', 'success');
      return;
    }
    const timer = setInterval(() => {
      setRestSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [restRunning, restSeconds]);

  const startRestTimer = (secs) => {
    setRestSeconds(secs);
    setRestRunning(true);
  };

  // =========================================================================
  // 2. GESTÃO DE FICHAS DE TREINO E EXECUÇÃO INTERATIVA
  // =========================================================================
  const [expandedFichaId, setExpandedFichaId] = useState(null);
  const [checkedExercises, setCheckedExercises] = useState({});
  const [workoutDuration, setWorkoutDuration] = useState('50');

  const [isCreatingFicha, setIsCreatingFicha] = useState(false);
  const [editingFichaId, setEditingFichaId] = useState(null);
  const [novaFichaTitulo, setNovaFichaTitulo] = useState('');
  const [exerciciosTemp, setExerciciosTemp] = useState([]);
  
  const [novoExercicioNome, setNovoExercicioNome] = useState('');
  const [novoExercicioSeries, setNovoExercicioSeries] = useState('4x');
  const [novoExercicioReps, setNovoExercicioReps] = useState('10-12');
  const [novoExercicioCarga, setNovoExercicioCarga] = useState('10kg');
  
  const [editFichaTitulo, setEditFichaTitulo] = useState('');
  const [editExercicios, setEditExercicios] = useState([]);

  const toggleExerciseCheck = (exKey) => {
    setCheckedExercises(prev => ({ ...prev, [exKey]: !prev[exKey] }));
  };

  const handleConcluirTreino = async (ficha) => {
    try {
      const duracaoNum = parseInt(workoutDuration, 10) || 50;
      await concluirFichaTreino(ficha.id, duracaoNum);
      
      // Limpa os checks desta ficha após concluir
      const resetChecks = { ...checkedExercises };
      ficha.exercicios.forEach((ex, i) => {
        delete resetChecks[`${ficha.id}-${ex.id || i}`];
      });
      setCheckedExercises(resetChecks);

      showToast(`Treino "${ficha.title}" registrado (${duracaoNum} min)!`, 'success');
    } catch (err) {
      showToast('Erro ao registrar treino no banco.', 'error');
    }
  };

  const handleAddExercicioTemp = () => {
    if (!novoExercicioNome.trim()) return;
    setExerciciosTemp([
      ...exerciciosTemp,
      { 
        id: Date.now().toString(),
        nome: novoExercicioNome.trim(), 
        series: novoExercicioSeries.trim() || '3x', 
        reps: novoExercicioReps.trim() || '10', 
        carga: novoExercicioCarga.trim() || 'Peso Corp.' 
      }
    ]);
    setNovoExercicioNome('');
  };

  const handleSaveNovaFicha = (e) => {
    e.preventDefault();
    if (!novaFichaTitulo.trim() || exerciciosTemp.length === 0) {
      showToast('Adicione um título e ao menos um exercício.', 'error');
      return;
    }
    const nova = addFichaTreino(novaFichaTitulo.trim(), exerciciosTemp);
    setNovaFichaTitulo('');
    setExerciciosTemp([]);
    setIsCreatingFicha(false);
    setExpandedFichaId(nova.id);
    showToast('Nova ficha criada com sucesso!', 'success');
  };

  // Deep Clone para não mutar o estado original durante a edição
  const handleStartEdit = (ficha) => {
    setEditingFichaId(ficha.id);
    setEditFichaTitulo(ficha.title);
    setEditExercicios((ficha.exercicios || []).map(ex => ({ ...ex })));
    setExpandedFichaId(ficha.id);
  };

  const handleSaveEdit = (id) => {
    const cleanExercises = editExercicios.filter(ex => ex.nome && ex.nome.trim() !== '');
    if (!editFichaTitulo.trim() || cleanExercises.length === 0) {
      showToast('A ficha precisa de um título e ao menos 1 exercício válido.', 'error');
      return;
    }

    updateFichaTreino(id, {
      title: editFichaTitulo.trim(),
      exercicios: cleanExercises
    });
    setEditingFichaId(null);
    showToast('Ficha atualizada com sucesso!', 'success');
  };

  const handleDeleteFicha = (id) => {
    deleteFichaTreino(id);
    showToast('Ficha excluída.', 'success');
  };

  // =========================================================================
  // 3. PAINEL DE MEDIDAS CORPORAIS E CÁLCULO DE VARIAÇÃO (DELTA)
  // =========================================================================
  const [medidasRapidas, setMedidasRapidas] = useState({
    'Peso': { valor: '', unidade: 'kg' },
    'Peitoral': { valor: '', unidade: 'cm' },
    'Cintura': { valor: '', unidade: 'cm' },
    'Bíceps Dir.': { valor: '', unidade: 'cm' },
    'Bíceps Esq.': { valor: '', unidade: 'cm' },
    'Coxa Dir.': { valor: '', unidade: 'cm' },
    'Coxa Esq.': { valor: '', unidade: 'cm' },
  });

  const [selectedMetricChart, setSelectedMetricChart] = useState('Peso');

  const handleMedidaChange = (medida, valor) => {
    setMedidasRapidas(prev => ({
      ...prev,
      [medida]: { ...prev[medida], valor }
    }));
  };

  const handleSaveMedida = async (medidaNome) => {
    const data = medidasRapidas[medidaNome];
    if (!data.valor) return;
    
    const numValue = parseFloat(String(data.valor).replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) return;

    try {
      const tipoRegistro = medidaNome === 'Peso' ? 'peso' : 'medida';
      await addHealthLog(tipoRegistro, medidaNome, numValue, data.unidade);
      handleMedidaChange(medidaNome, '');
      showToast(`${medidaNome} registrado: ${numValue}${data.unidade}!`, 'success');
    } catch (err) {
      showToast('Erro ao salvar medida no banco.', 'error');
    }
  };

  // Histórico e Filtros
  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchHistory, setSearchHistory] = useState('');

  const formatDateToBR = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const { totalTreinos, treinosMesAtual, ultimoPeso, chartEvolutionData } = useMemo(() => {
    const safeLogs = healthLogs || [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const treinos = safeLogs.filter(l => l.type === 'treino');
    const treinosMes = treinos.filter(l => {
      const d = new Date(l.created_at || l.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const pesos = safeLogs
      .filter(l => l.type === 'peso')
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

    // Dados para o mini-gráfico de evolução da medida selecionada
    const metricLogs = safeLogs
      .filter(l => selectedMetricChart === 'Peso' ? l.type === 'peso' : l.title === selectedMetricChart)
      .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))
      .slice(-12)
      .map(l => {
        const d = new Date(l.created_at || l.date);
        return {
          data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          valor: Number(l.value || 0),
          unidade: l.unit || (selectedMetricChart === 'Peso' ? 'kg' : 'cm')
        };
      });

    return {
      totalTreinos: treinos.length,
      treinosMesAtual: treinosMes,
      ultimoPeso: pesos[0] || null,
      chartEvolutionData: metricLogs
    };
  }, [healthLogs, selectedMetricChart]);

  const filteredLogs = useMemo(() => {
    const query = searchHistory.toLowerCase().trim();
    return (healthLogs || [])
      .filter(log => {
        const matchType = activeFilter === 'todos' || log.type === activeFilter;
        const matchQuery = !query || (log.title || '').toLowerCase().includes(query);
        return matchType && matchQuery;
      })
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  }, [healthLogs, activeFilter, searchHistory]);

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw] relative">
      
      {/* Toast Flutuante */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform ${
        toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
      } ${
        toast.type === 'error' 
          ? 'bg-rose-950/95 border-rose-500/30 text-rose-300' 
          : 'bg-emerald-950/95 border-emerald-500/30 text-emerald-300'
      }`}>
        {toast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
        <span className="text-xs sm:text-sm font-bold tracking-wide">{toast.message}</span>
      </div>

      {/* CABEÇALHO */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl border border-cyan-500/20 backdrop-blur-md shadow-lg shadow-cyan-500/10">
            <Dumbbell className="text-cyan-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Saúde & Performance</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Controle de Hipertrofia, Calistenia & Biometria</p>
          </div>
        </div>

        {/* KPIs de Topo */}
        <div className="grid grid-cols-3 sm:flex gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 px-3.5 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
            <div className="p-2 bg-cyan-500/20 rounded-xl text-cyan-400 hidden sm:block"><Calendar size={16} /></div>
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-bold">No Mês</div>
              <div className="text-sm sm:text-base font-bold text-white font-mono">{treinosMesAtual} <span className="text-[10px] text-slate-400 font-sans">treinos</span></div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 px-3.5 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 hidden sm:block"><Flame size={16} /></div>
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Geral</div>
              <div className="text-sm sm:text-base font-bold text-white font-mono">{totalTreinos}</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 px-3.5 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 hidden sm:block"><Scale size={16} /></div>
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-bold">Peso Atual</div>
              <div className="text-sm sm:text-base font-bold text-emerald-400 font-mono">
                {ultimoPeso ? `${ultimoPeso.value}${ultimoPeso.unit}` : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA: Timer de Descanso + Fichas + Medidas Rápidas */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* CRONÔMETRO DE DESCANSO ENTRE SÉRIES */}
          <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-cyan-950/60 border border-cyan-500/25 p-4 sm:p-5 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-300 flex items-center gap-2">
                <Timer size={16} className={restRunning ? "text-cyan-400 animate-spin" : "text-cyan-400"} />
                Descanso entre Séries
              </span>
              {restSeconds > 0 && (
                <button
                  type="button"
                  onClick={() => { setRestRunning(false); setRestSeconds(0); }}
                  className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20"
                >
                  <RotateCcw size={12} /> Zerar
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-2xl sm:text-3xl font-bold text-white bg-black/40 px-4 py-2 rounded-2xl border border-white/10 min-w-[100px] text-center">
                {String(Math.floor(restSeconds / 60)).padStart(2, '0')}:{String(restSeconds % 60).padStart(2, '0')}
              </div>

              <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                {[45, 60, 90, 120].map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => startRestTimer(sec)}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                      restRunning && Math.abs(restSeconds - sec) <= 5
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/25'
                        : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SEÇÃO DE FICHAS DE TREINO */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
            <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Dumbbell size={18} className="text-cyan-400" /> Minhas Fichas ({fichasTreino.length})
              </h2>
              <button 
                onClick={() => setIsCreatingFicha(!isCreatingFicha)}
                className="px-3.5 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {isCreatingFicha ? <><X size={15} /> Fechar</> : <><Plus size={15} /> Nova Ficha</>}
              </button>
            </div>

            {/* CRIAR NOVA FICHA */}
            {isCreatingFicha && (
              <form onSubmit={handleSaveNovaFicha} className="bg-black/40 border border-cyan-500/30 p-4 rounded-2xl mb-5 space-y-4 shadow-inner">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Edit3 size={14}/> Nova Ficha de Treino
                </h3>
                
                <input 
                  required 
                  type="text" 
                  value={novaFichaTitulo} 
                  onChange={(e) => setNovaFichaTitulo(e.target.value)} 
                  placeholder="Título (ex: Treino D - Full Body / Calistenia)" 
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold" 
                />

                <div className="space-y-3 border-t border-white/10 pt-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Adicionar Exercícios:</span>
                  <div className="flex flex-col gap-2.5 bg-black/20 p-3 rounded-xl border border-white/5">
                    <input 
                      type="text" 
                      value={novoExercicioNome} 
                      onChange={(e) => setNovoExercicioNome(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExercicioTemp(); } }}
                      placeholder="Nome do Exercício (Enter para incluir)" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500" 
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" value={novoExercicioSeries} onChange={(e) => setNovoExercicioSeries(e.target.value)} placeholder="Séries (4x)" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-center text-slate-200" />
                      <input type="text" value={novoExercicioReps} onChange={(e) => setNovoExercicioReps(e.target.value)} placeholder="Reps (10-12)" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-center text-slate-200" />
                      <input type="text" value={novoExercicioCarga} onChange={(e) => setNovoExercicioCarga(e.target.value)} placeholder="Carga (10kg)" className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-center font-mono text-cyan-300" />
                    </div>
                    <button type="button" onClick={handleAddExercicioTemp} className="py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold border border-white/10 transition-all flex justify-center items-center gap-1.5">
                      <Plus size={15}/> Incluir Exercício
                    </button>
                  </div>

                  {exerciciosTemp.length > 0 && (
                    <div className="bg-black/30 p-2.5 rounded-xl space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar border border-white/5">
                      {exerciciosTemp.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between text-xs text-slate-300 px-3 py-2 bg-white/5 rounded-lg border border-white/5">
                          <span className="font-semibold truncate pr-2">{ex.nome} <span className="opacity-60 font-mono">({ex.series} {ex.reps})</span></span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded">{ex.carga}</span>
                            <button type="button" onClick={() => setExerciciosTemp(exerciciosTemp.filter(item => item.id !== ex.id))} className="text-slate-500 hover:text-rose-400">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button type="button" onClick={() => setIsCreatingFicha(false)} className="px-4 py-2.5 bg-white/5 text-slate-300 hover:bg-white/10 text-xs font-bold rounded-xl">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg flex justify-center items-center gap-1.5">
                    <Check size={16}/> Salvar Ficha
                  </button>
                </div>
              </form>
            )}

            {/* LISTA DE FICHAS */}
            <div className="space-y-3.5">
              {fichasTreino.map(ficha => {
                const isExpanded = expandedFichaId === ficha.id;
                const isEditing = editingFichaId === ficha.id;
                const confirmFichaKey = `ficha-${ficha.id}`;
                const isConfirmingDelete = confirmDeleteId === confirmFichaKey;

                const exerciciosDaFicha = ficha.exercicios || [];
                const doneCount = exerciciosDaFicha.filter((ex, idx) => checkedExercises[`${ficha.id}-${ex.id || idx}`]).length;
                const totalEx = exerciciosDaFicha.length;

                return (
                  <div key={ficha.id} className={`bg-black/30 border rounded-2xl transition-all duration-200 ${isExpanded ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/5' : 'border-white/10 hover:border-white/20'}`}>
                    
                    <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="cursor-pointer flex-1 min-w-0" onClick={() => !isEditing && setExpandedFichaId(isExpanded ? null : ficha.id)}>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFichaTitulo} 
                            onChange={(e) => setEditFichaTitulo(e.target.value)} 
                            className="bg-black/60 border border-cyan-500/50 rounded-xl px-3 py-2 text-sm text-white w-full font-bold focus:outline-none"
                          />
                        ) : (
                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-white flex items-center justify-between sm:justify-start gap-2">
                              <span className="truncate">{ficha.title}</span>
                              {isExpanded ? <ChevronUp size={16} className="text-cyan-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                {totalEx} exercícios
                              </span>
                              {doneCount > 0 && (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                  {doneCount}/{totalEx} concluídos
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-1.5 border-t border-white/5 sm:border-0 pt-2.5 sm:pt-0 shrink-0">
                        {!isEditing ? (
                          <>
                            <button 
                              onClick={() => handleConcluirTreino(ficha)} 
                              title="Registrar treino concluído no histórico" 
                              className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                            >
                              <CheckCircle2 size={15} /> Concluir
                            </button>
                            <button 
                              onClick={() => handleStartEdit(ficha)} 
                              title="Editar Ficha e Cargas" 
                              className="text-slate-400 hover:text-cyan-400 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button 
                              onClick={() => triggerSafeDelete(confirmFichaKey, () => handleDeleteFicha(ficha.id))} 
                              title="Excluir Ficha" 
                              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold ${
                                isConfirmingDelete 
                                  ? 'bg-rose-500 text-white px-2.5 animate-pulse' 
                                  : 'text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10'
                              }`}
                            >
                              <Trash2 size={15} />
                              {isConfirmingDelete && <span>Apagar?</span>}
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button 
                              type="button"
                              onClick={() => setEditingFichaId(null)} 
                              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleSaveEdit(ficha.id)} 
                              className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                            >
                              <Check size={15} /> Salvar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CONTEÚDO EXPANDIDO DOS EXERCÍCIOS (COM CHECKLIST DE SESSÃO) */}
                    {(isExpanded || isEditing) && (
                      <div className="p-4 pt-3 border-t border-white/10 space-y-2.5">
                        {!isEditing ? (
                          <>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                              Toque nos exercícios para marcar seu progresso na sessão:
                            </p>
                            {exerciciosDaFicha.map((ex, i) => {
                              const checkKey = `${ficha.id}-${ex.id || i}`;
                              const isDone = Boolean(checkedExercises[checkKey]);

                              return (
                                <div 
                                  key={checkKey} 
                                  onClick={() => toggleExerciseCheck(checkKey)}
                                  className={`cursor-pointer flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border transition-all gap-2 ${
                                    isDone 
                                      ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' 
                                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  <span className={`font-bold flex items-center gap-2.5 ${isDone ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                    <input
                                      type="checkbox"
                                      checked={isDone}
                                      onChange={() => {}}
                                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-emerald-500 pointer-events-none shrink-0"
                                    />
                                    {ex.nome}
                                  </span>
                                  <div className="flex items-center gap-2 text-[11px] font-mono pl-6 sm:pl-0 shrink-0">
                                    <span className="text-slate-300 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                      {ex.series} {ex.reps}
                                    </span>
                                    <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-500/20">
                                      {ex.carga}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Rodapé da Ficha Expandida: Duração + Botão de Concluir */}
                            <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t border-white/10">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 font-semibold">Duração (min):</span>
                                <input
                                  type="number"
                                  value={workoutDuration}
                                  onChange={(e) => setWorkoutDuration(e.target.value)}
                                  className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-center text-white focus:outline-none focus:border-cyan-500"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleConcluirTreino(ficha)}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                              >
                                <Play size={14} fill="currentColor" /> Finalizar e Salvar no Histórico
                              </button>
                            </div>
                          </>
                        ) : (
                          /* MODO EDIÇÃO DE EXERCÍCIOS E CARGAS */
                          <div className="space-y-3 pt-1">
                            {editExercicios.map((ex, index) => (
                              <div key={index} className="flex flex-col gap-2.5 bg-black/40 p-3.5 rounded-xl border border-white/10">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    value={ex.nome} 
                                    onChange={(e) => {
                                      const updated = editExercicios.map((item, idx) => idx === index ? { ...item, nome: e.target.value } : item);
                                      setEditExercicios(updated);
                                    }} 
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-cyan-500"
                                    placeholder="Nome do Exercício"
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setEditExercicios(editExercicios.filter((_, idx) => idx !== index))}
                                    className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 border border-rose-500/20 shrink-0"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2">
                                  <input 
                                    type="text" 
                                    value={ex.series} 
                                    onChange={(e) => {
                                      const updated = editExercicios.map((item, idx) => idx === index ? { ...item, series: e.target.value } : item);
                                      setEditExercicios(updated);
                                    }} 
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs text-center text-slate-300 font-mono"
                                    placeholder="Séries"
                                  />
                                  <input 
                                    type="text" 
                                    value={ex.reps} 
                                    onChange={(e) => {
                                      const updated = editExercicios.map((item, idx) => idx === index ? { ...item, reps: e.target.value } : item);
                                      setEditExercicios(updated);
                                    }} 
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs text-center text-slate-300 font-mono"
                                    placeholder="Reps"
                                  />
                                  <input 
                                    type="text" 
                                    value={ex.carga} 
                                    onChange={(e) => {
                                      const updated = editExercicios.map((item, idx) => idx === index ? { ...item, carga: e.target.value } : item);
                                      setEditExercicios(updated);
                                    }} 
                                    className="w-full bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-2 text-xs text-center text-cyan-300 font-mono font-bold"
                                    placeholder="Carga"
                                  />
                                </div>
                              </div>
                            ))}

                            <button 
                              type="button" 
                              onClick={() => setEditExercicios([...editExercicios, { id: Date.now().toString(), nome: '', series: '3x', reps: '10-12', carga: '10kg' }])}
                              className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <Plus size={15} /> Adicionar Exercício
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO DE MEDIDAS RÁPIDAS COM INDICADOR DE VARIAÇÃO (DELTA) */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <UserCircle size={18} className="text-emerald-400" /> Biometria & Medidas
              </h2>
              <span className="text-[10px] text-slate-400 font-medium">Enter para salvar</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(medidasRapidas).map((medidaNome) => {
                const data = medidasRapidas[medidaNome];
                const isPeso = medidaNome === 'Peso';

                const historicoMedida = (healthLogs || [])
                  .filter(l => isPeso ? l.type === 'peso' : l.title === medidaNome)
                  .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

                const ultimaGravada = historicoMedida[0];
                const penultimaGravada = historicoMedida[1];
                const delta = (ultimaGravada && penultimaGravada) 
                  ? (Number(ultimaGravada.value) - Number(penultimaGravada.value)).toFixed(1) 
                  : null;

                return (
                  <div key={medidaNome} className={`bg-black/30 border border-white/5 p-3.5 rounded-2xl flex flex-col justify-between transition-all hover:border-white/15 ${isPeso ? 'col-span-2' : ''}`}>
                    <div className="flex items-center justify-between mb-2.5 gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedMetricChart(medidaNome)}
                        title="Clique para ver o gráfico desta medida"
                        className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-200 hover:text-cyan-300 flex items-center gap-1.5 text-left"
                      >
                        {isPeso ? <Scale size={13} className="text-emerald-400 shrink-0"/> : <Ruler size={13} className="text-cyan-400 shrink-0"/>} 
                        <span className="truncate">{medidaNome}</span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {ultimaGravada && (
                          <span className="text-[10px] text-slate-300 font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded">
                            {ultimaGravada.value}{data.unidade}
                          </span>
                        )}
                        {delta !== null && Number(delta) !== 0 && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            Number(delta) > 0 
                              ? 'bg-emerald-500/15 text-emerald-300' 
                              : 'bg-amber-500/15 text-amber-300'
                          }`}>
                            {Number(delta) > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="number"
                        step="0.1"
                        value={data.valor}
                        onChange={(e) => handleMedidaChange(medidaNome, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveMedida(medidaNome); } }}
                        placeholder={ultimaGravada ? `Atual: ${ultimaGravada.value}` : '00.0'}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono text-center"
                      />
                      <button 
                        type="button"
                        onClick={() => handleSaveMedida(medidaNome)}
                        disabled={!data.valor}
                        className={`px-3.5 rounded-xl flex items-center justify-center transition-all ${
                          data.valor 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' 
                            : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                        }`}
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* COLUNA DIREITA: Gráfico de Evolução + Histórico Detalhado */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* GRÁFICO DE EVOLUÇÃO BIOMÉTRICA SELECIONÁVEL */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp size={18} className="text-cyan-400" /> Curva de Evolução: <span className="text-cyan-300">{selectedMetricChart}</span>
                </h2>
                <p className="text-[11px] text-slate-400">Últimos 12 registros da métrica selecionada</p>
              </div>

              <select
                value={selectedMetricChart}
                onChange={(e) => setSelectedMetricChart(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {Object.keys(medidasRapidas).map(m => (
                  <option key={m} value={m} className="bg-slate-900">{m}</option>
                ))}
              </select>
            </div>

            <div className="h-48 sm:h-56 w-full">
              {chartEvolutionData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs sm:text-sm border border-dashed border-white/10 rounded-2xl">
                  Sem registros históricos para "{selectedMetricChart}".
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="data" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff1a', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val, name, props) => [`${val} ${props.payload.unidade}`, selectedMetricChart]}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMetric)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* HISTÓRICO DE ATIVIDADES COM BUSCA E EXCLUSÃO EM 2 TOQUES */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-7 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[500px] max-h-[780px]">
            
            <div className="flex flex-col gap-3.5 mb-5 border-b border-white/10 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-400" /> Histórico de Registros
                </h2>
                
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                  {['todos', 'treino', 'peso', 'medida'].map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${
                        activeFilter === f 
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                          : 'bg-black/30 text-slate-400 hover:text-slate-200 border border-white/5'
                      }`}
                    >
                      {f === 'peso' ? 'Peso' : f === 'medida' ? 'Medidas' : f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de Busca no Histórico */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  placeholder="Buscar por treino, exercício ou medida..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-500"
                />
                {searchHistory && (
                  <button onClick={() => setSearchHistory('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 sm:pr-2">
              {filteredLogs.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <div className="p-4 bg-black/20 rounded-full border border-white/5">
                    <Calendar size={32} className="opacity-40" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium">Nenhum registro encontrado.</p>
                </div>
              ) : (
                filteredLogs.map(log => {
                  const tagConfig = {
                    treino: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: Dumbbell },
                    peso: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: Scale },
                    medida: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', icon: Ruler },
                  };

                  const style = tagConfig[log.type] || tagConfig.treino;
                  const Icon = style.icon;
                  const confirmLogKey = `log-${log.id}`;
                  const isConfirming = confirmDeleteId === confirmLogKey;

                  const hasDetails = (log.title || '').includes(': ');
                  const mainTitle = hasDetails ? log.title.split(': ')[0] : log.title;
                  const details = hasDetails ? log.title.substring(log.title.indexOf(': ') + 2) : '';

                  return (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/30 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/5 transition-all gap-3">
                      
                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        <span className={`flex items-center justify-center w-11 h-11 rounded-xl border shrink-0 ${style.bg} ${style.border} ${style.text}`}>
                          <Icon size={20} />
                        </span>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h4 className="text-white text-sm font-bold leading-snug truncate">
                            {mainTitle}
                          </h4>
                          {details && (
                            <p className="text-slate-400 text-[11px] mt-1 line-clamp-2 leading-relaxed">
                              {details}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                              <Calendar size={10} /> {formatDateToBR(log.created_at || log.date)}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                              {log.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-3 sm:pt-0 border-t border-white/5 sm:border-0 shrink-0">
                        {log.value !== null && (
                          <div className={`font-mono text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl border flex items-baseline gap-1 ${style.bg} ${style.text} ${style.border}`}>
                            {log.value} <span className="text-[10px] uppercase font-semibold opacity-80">{log.unit}</span>
                          </div>
                        )}

                        <button 
                          onClick={() => triggerSafeDelete(confirmLogKey, () => deleteHealthLog(log.id))} 
                          className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold ${
                            isConfirming 
                              ? 'bg-rose-500 text-white px-3 animate-pulse' 
                              : 'text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10'
                          }`}
                          title="Excluir registro"
                        >
                          <Trash2 size={16} />
                          {isConfirming && <span>Confirmar?</span>}
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
        
      </main>
    </div>
  );
}
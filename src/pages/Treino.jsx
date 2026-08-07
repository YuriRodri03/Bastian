import React, { useState, useEffect } from 'react';
import { useFitnessStore } from '../store/useFitnessStore';
import { 
  Dumbbell, 
  Trash2, 
  Calendar, 
  Scale, 
  Ruler, 
  Filter,
  Flame,
  Play,
  Plus,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  UserCircle,
  AlertCircle 
} from 'lucide-react';

export default function Treino() {
  const { healthLogs, addHealthLog, deleteHealthLog, fetchHealthLogs } = useFitnessStore();
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  const [fichasTreino, setFichasTreino] = useState(() => {
    const saved = localStorage.getItem('centro_comando_fichas');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: '1',
        title: 'Treino A - Peito, Ombro e Tríceps',
        exercicios: [
          { id: '1-1', nome: 'Supino Reto', series: '4x', reps: '8-10', carga: '80kg' },
          { id: '1-2', nome: 'Supino Inclinado com Halteres', series: '3x', reps: '10-12', carga: '28kg' },
          { id: '1-3', nome: 'Desenvolvimento Militar', series: '3x', reps: '8-10', carga: '40kg' },
          { id: '1-4', nome: 'Tríceps Corda na Polia', series: '3x', reps: '12-15', carga: '50kg' }
        ]
      },
      {
        id: '2',
        title: 'Treino B - Costas e Bíceps',
        exercicios: [
          { id: '2-1', nome: 'Puxada Alta na Polia', series: '4x', reps: '10-12', carga: '65kg' },
          { id: '2-2', nome: 'Remada Curvada', series: '3x', reps: '8-10', carga: '60kg' },
          { id: '2-3', nome: 'Rosca Direta com Barra', series: '3x', reps: '10-12', carga: '30kg' }
        ]
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('centro_comando_fichas', JSON.stringify(fichasTreino));
  }, [fichasTreino]);

  const [expandedFichaId, setExpandedFichaId] = useState(null);
  const [isCreatingFicha, setIsCreatingFicha] = useState(false);
  const [editingFichaId, setEditingFichaId] = useState(null);
  const [novaFichaTitulo, setNovaFichaTitulo] = useState('');
  const [exerciciosTemp, setExerciciosTemp] = useState([]);
  
  const [novoExercicioNome, setNovoExercicioNome] = useState('');
  const [novoExercicioSeries, setNovoExercicioSeries] = useState('3x');
  const [novoExercicioReps, setNovoExercicioReps] = useState('10');
  const [novoExercicioCarga, setNovoExercicioCarga] = useState('0kg');
  
  const [editFichaTitulo, setEditFichaTitulo] = useState('');
  const [editExercicios, setEditExercicios] = useState([]);

  const [medidasRapidas, setMedidasRapidas] = useState({
    'Peso': { valor: '', unidade: 'kg' },
    'Bíceps Dir.': { valor: '', unidade: 'cm' },
    'Bíceps Esq.': { valor: '', unidade: 'cm' },
    'Cintura': { valor: '', unidade: 'cm' },
    'Peitoral': { valor: '', unidade: 'cm' },
    'Coxa Dir.': { valor: '', unidade: 'cm' },
    'Coxa Esq.': { valor: '', unidade: 'cm' },
  });

  const handleMedidaChange = (medida, valor) => {
    setMedidasRapidas(prev => ({
      ...prev,
      [medida]: { ...prev[medida], valor }
    }));
  };

  const handleSaveMedida = (medidaNome) => {
    const data = medidasRapidas[medidaNome];
    if (!data.valor) return;
    
    const numValue = parseFloat(data.valor);
    const tipoRegistro = medidaNome === 'Peso' ? 'peso' : 'medida';
    
    addHealthLog(tipoRegistro, medidaNome, numValue, data.unidade);
    handleMedidaChange(medidaNome, '');
    showToast(`${medidaNome} atualizado para ${data.valor}${data.unidade}!`, 'success');
  };

  const [activeFilter, setActiveFilter] = useState('todos');

  useEffect(() => {
    fetchHealthLogs();
  }, [fetchHealthLogs]);

  const formatDateToBR = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleConcluirTreino = (ficha) => {
    // Trocado o ' | ' por ' • ' para um design mais limpo
    const resumoExercicios = ficha.exercicios.map(e => `${e.nome} (${e.series} ${e.reps} - ${e.carga})`).join(' • ');
    addHealthLog('treino', `${ficha.title}: ${resumoExercicios}`, 60, 'min');
    showToast(`Treino "${ficha.title}" concluído com sucesso!`, 'success');
  };

  const handleAddExercicioTemp = () => {
    if (!novoExercicioNome.trim()) return;
    setExerciciosTemp([...exerciciosTemp, { 
      id: Date.now().toString(),
      nome: novoExercicioNome, 
      series: novoExercicioSeries, 
      reps: novoExercicioReps, 
      carga: novoExercicioCarga 
    }]);
    setNovoExercicioNome('');
  };

  const handleRemoveExercicioTemp = (idToRemove) => {
    setExerciciosTemp(exerciciosTemp.filter(ex => ex.id !== idToRemove));
  };

  const handleSaveNovaFicha = (e) => {
    e.preventDefault();
    if (!novaFichaTitulo.trim() || exerciciosTemp.length === 0) {
      showToast('Adicione um título e ao menos um exercício.', 'error');
      return;
    }
    setFichasTreino([...fichasTreino, { id: Date.now().toString(), title: novaFichaTitulo, exercicios: exerciciosTemp }]);
    setNovaFichaTitulo('');
    setExerciciosTemp([]);
    setIsCreatingFicha(false);
    showToast('Nova ficha criada com sucesso!', 'success');
  };

  const handleStartEdit = (ficha) => {
    setEditingFichaId(ficha.id);
    setEditFichaTitulo(ficha.title);
    setEditExercicios([...ficha.exercicios]);
    setExpandedFichaId(ficha.id);
  };

  const handleSaveEdit = (id) => {
    setFichasTreino(fichasTreino.map(f => {
      if (f.id === id) {
        return { ...f, title: editFichaTitulo, exercicios: editExercicios };
      }
      return f;
    }));
    setEditingFichaId(null);
    showToast('Ficha atualizada com sucesso!', 'success');
  };

  const handleDeleteFicha = (id) => {
    if (window.confirm('Senhor, deseja excluir esta ficha permanentemente?')) {
      setFichasTreino(fichasTreino.filter(f => f.id !== id));
      showToast('Ficha excluída com sucesso.', 'success');
    }
  };

  const filteredLogs = healthLogs
    .filter(log => activeFilter === 'todos' || log.type === activeFilter)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalTreinos = healthLogs.filter(l => l.type === 'treino').length;
  const ultimoPeso = healthLogs.filter(l => l.type === 'peso').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw] relative">
      
      {/* Toast Flutuante (Premium) */}
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-500 ease-out transform ${
        toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
      } ${
        toast.type === 'error' 
          ? 'bg-rose-950/90 border-rose-500/30 text-rose-400' 
          : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
      }`}>
        {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
        <span className="text-sm font-bold tracking-wide">{toast.message}</span>
      </div>

      {/* CABEÇALHO */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl border border-cyan-500/20 backdrop-blur-md shadow-lg shadow-cyan-500/10">
            <Dumbbell className="text-cyan-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Saúde & Performance</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Treinos e indicadores corporais</p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <div className="flex-1 sm:flex-none bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 px-4 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 shadow-inner"><Flame size={18} /></div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Treinos</div>
              <div className="text-base font-bold text-white">{totalTreinos}</div>
            </div>
          </div>
          <div className="flex-1 sm:flex-none bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 px-4 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shadow-inner"><Scale size={18} /></div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Último Peso</div>
              <div className="text-base font-bold text-emerald-400 font-mono">{ultimoPeso ? `${ultimoPeso.value}${ultimoPeso.unit}` : '--'}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA: Fichas & Painel Dinâmico de Medidas */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* SEÇÃO DE MEDIDAS RÁPIDAS */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
            <h2 className="text-sm sm:text-base font-bold text-white mb-5 border-b border-white/10 pb-4 flex items-center gap-2">
              <UserCircle size={18} className="text-emerald-400" /> Atualização de Medidas
            </h2>
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {Object.keys(medidasRapidas).map((medidaNome) => {
                const data = medidasRapidas[medidaNome];
                const ultimaGravada = healthLogs
                  .filter(l => l.title === medidaNome)
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

                const isPeso = medidaNome === 'Peso';

                return (
                  <div key={medidaNome} className={`bg-black/30 border border-white/5 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between transition-all hover:border-white/10 hover:bg-black/40 ${isPeso ? 'col-span-2' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                        {isPeso ? <Scale size={14} className="text-emerald-400"/> : <Ruler size={14} className="text-cyan-400"/>} 
                        {medidaNome}
                      </span>
                      {ultimaGravada && (
                        <span className="text-[10px] text-slate-500 font-mono font-semibold bg-white/5 px-2 py-0.5 rounded-md">
                          Últ: {ultimaGravada.value}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        step="0.1"
                        value={data.valor}
                        onChange={(e) => handleMedidaChange(medidaNome, e.target.value)}
                        placeholder={`Ex: ${ultimaGravada ? ultimaGravada.value : '00'}`}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 sm:p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-center transition-all placeholder:text-slate-600"
                      />
                      <button 
                        onClick={() => handleSaveMedida(medidaNome)}
                        disabled={!data.valor}
                        className={`px-4 rounded-xl flex items-center justify-center transition-all shadow-md ${data.valor ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/20' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SEÇÃO DE FICHAS DE TREINO */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
            <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Dumbbell size={18} className="text-cyan-400" /> Fichas de Treino
              </h2>
              <button 
                onClick={() => setIsCreatingFicha(!isCreatingFicha)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Nova Ficha</span><span className="sm:hidden">Nova</span>
              </button>
            </div>

            {/* CRIAR NOVA FICHA */}
            {isCreatingFicha && (
              <form onSubmit={handleSaveNovaFicha} className="bg-black/30 border border-cyan-500/30 p-4 sm:p-5 rounded-2xl mb-6 space-y-4 shadow-inner">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5"><Edit3 size={14}/> Criar Nova Ficha</h3>
                
                <input 
                  required 
                  type="text" 
                  value={novaFichaTitulo} 
                  onChange={(e) => setNovaFichaTitulo(e.target.value)} 
                  placeholder="Título (ex: Treino C - Pernas)" 
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 font-semibold" 
                />

                <div className="space-y-3 border-t border-white/10 pt-3">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Adicionar Exercícios:</span>
                  <div className="flex flex-col gap-3 bg-black/20 p-3 sm:p-4 rounded-xl border border-white/5">
                    <input 
                      type="text" 
                      value={novoExercicioNome} 
                      onChange={(e) => setNovoExercicioNome(e.target.value)} 
                      placeholder="Nome do Exercício" 
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600" 
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" value={novoExercicioSeries} onChange={(e) => setNovoExercicioSeries(e.target.value)} placeholder="Séries" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-center text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600" />
                      <input type="text" value={novoExercicioReps} onChange={(e) => setNovoExercicioReps(e.target.value)} placeholder="Reps" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-center text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600" />
                      <input type="text" value={novoExercicioCarga} onChange={(e) => setNovoExercicioCarga(e.target.value)} placeholder="Carga" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-center font-mono text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600" />
                    </div>
                    <button type="button" onClick={handleAddExercicioTemp} className="py-3 mt-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold border border-white/10 transition-all flex justify-center items-center gap-1.5">
                      <Plus size={16}/> Incluir na lista
                    </button>
                  </div>

                  {exerciciosTemp.length > 0 && (
                    <div className="bg-black/30 p-2 sm:p-3 rounded-xl space-y-2 max-h-48 overflow-y-auto custom-scrollbar border border-white/5">
                      {exerciciosTemp.map((ex) => (
                        <div key={ex.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs text-slate-300 px-3 py-2.5 bg-white/5 rounded-lg border border-white/5 gap-2">
                          <span className="font-semibold truncate flex-1">{ex.nome} <span className="opacity-60 ml-1 font-mono">({ex.series} {ex.reps})</span></span>
                          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            <span className="font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded shrink-0">{ex.carga}</span>
                            <button type="button" onClick={() => handleRemoveExercicioTemp(ex.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-md transition-colors" title="Remover">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-3">
                  <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all order-1 sm:order-2 flex justify-center items-center gap-1.5"><Check size={18}/> Salvar Ficha Completa</button>
                  <button type="button" onClick={() => setIsCreatingFicha(false)} className="px-4 py-3.5 bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white text-sm font-bold rounded-xl transition-all order-2 sm:order-1">Cancelar</button>
                </div>
              </form>
            )}

            {/* LISTA DE FICHAS */}
            <div className="space-y-3 sm:space-y-4">
              {fichasTreino.map(ficha => {
                const isExpanded = expandedFichaId === ficha.id;
                const isEditing = editingFichaId === ficha.id;

                return (
                  <div key={ficha.id} className={`bg-black/30 border rounded-2xl transition-all duration-200 ${isExpanded ? 'border-cyan-500/30 shadow-lg shadow-cyan-500/5' : 'border-white/10 hover:border-white/20 hover:bg-black/40'}`}>
                    
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div className="cursor-pointer flex-1" onClick={() => !isEditing && setExpandedFichaId(isExpanded ? null : ficha.id)}>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFichaTitulo} 
                            onChange={(e) => setEditFichaTitulo(e.target.value)} 
                            className="bg-black/60 border border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/30 rounded-xl px-3 py-2.5 text-base sm:text-sm text-white w-full font-bold focus:outline-none transition-all placeholder:text-slate-600"
                          />
                        ) : (
                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                              {ficha.title}
                              {isExpanded ? <ChevronUp size={16} className="text-cyan-400" /> : <ChevronDown size={16} className="text-slate-500" />}
                            </h4>
                            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1 block bg-white/5 w-fit px-2 py-0.5 rounded-md border border-white/5">{ficha.exercicios.length} exercícios configurados</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                        {!isEditing ? (
                          <>
                            <button onClick={() => handleConcluirTreino(ficha)} title="Concluir treino hoje" className="px-4 py-2 sm:py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all w-full sm:w-auto">
                              <Play size={16} fill="currentColor" /> Concluir
                            </button>
                            <div className="flex gap-1.5 shrink-0 ml-2 sm:ml-0">
                              <button onClick={() => handleStartEdit(ficha)} title="Editar Ficha" className="text-slate-400 hover:text-cyan-400 p-2.5 sm:p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-cyan-500/20">
                                <Edit3 size={18} className="sm:w-4 sm:h-4" />
                              </button>
                              <button onClick={() => handleDeleteFicha(ficha.id)} title="Excluir Ficha" className="text-slate-400 hover:text-rose-400 p-2.5 sm:p-2 bg-white/5 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20">
                                <Trash2 size={18} className="sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <button onClick={() => handleSaveEdit(ficha.id)} className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg">
                            <Check size={18} className="sm:w-4 sm:h-4" /> Salvar Ficha
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CONTEÚDO DOS EXERCÍCIOS */}
                    {(isExpanded || isEditing) && (
                      <div className="p-4 sm:p-5 pt-0 sm:pt-0 border-t border-white/10 space-y-2.5 mt-2">
                        {!isEditing ? (
                          ficha.exercicios.map((ex, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm bg-white/5 px-4 py-3 rounded-xl border border-white/5 group hover:bg-white/10 transition-colors gap-2 sm:gap-0">
                              <span className="text-slate-200 font-bold flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity"></span>
                                {ex.nome}
                              </span>
                              <div className="flex items-center gap-3 text-[11px] sm:text-xs font-mono pl-3 sm:pl-0 border-l-2 sm:border-l-0 border-white/10 sm:border-transparent">
                                <span className="text-slate-400 font-semibold bg-black/40 px-2 py-0.5 rounded border border-white/5">{ex.series} {ex.reps}</span>
                                <span className="text-cyan-300 font-bold bg-cyan-950/50 px-2.5 py-0.5 rounded border border-cyan-500/20 tracking-wider shadow-inner">{ex.carga}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="space-y-3 pt-3">
                            <span className="text-[10px] sm:text-[11px] text-cyan-400 uppercase tracking-widest font-bold">Editando Exercícios e Cargas:</span>
                            {editExercicios.map((ex, index) => (
                              <div key={index} className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-white/10">
                                
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    value={ex.nome} 
                                    onChange={(e) => {
                                      const updated = [...editExercicios];
                                      updated[index].nome = e.target.value;
                                      setEditExercicios(updated);
                                    }} 
                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-base sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-semibold placeholder:text-slate-500"
                                    placeholder="Nome do Exercício"
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setEditExercicios(editExercicios.filter((_, idx) => idx !== index))}
                                    className="p-3 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-colors border border-rose-500/20 shrink-0"
                                    title="Remover Exercício"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                  <input 
                                    type="text" 
                                    value={ex.series} 
                                    onChange={(e) => {
                                      const updated = [...editExercicios];
                                      updated[index].series = e.target.value;
                                      setEditExercicios(updated);
                                    }} 
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 sm:p-3 text-base sm:text-sm text-center text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono placeholder:text-slate-600"
                                    placeholder="Séries"
                                  />
                                  <input 
                                    type="text" 
                                    value={ex.reps} 
                                    onChange={(e) => {
                                      const updated = [...editExercicios];
                                      updated[index].reps = e.target.value;
                                      setEditExercicios(updated);
                                    }} 
                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 sm:p-3 text-base sm:text-sm text-center text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono placeholder:text-slate-600"
                                    placeholder="Reps"
                                  />
                                  <input 
                                    type="text" 
                                    value={ex.carga} 
                                    onChange={(e) => {
                                      const updated = [...editExercicios];
                                      updated[index].carga = e.target.value;
                                      setEditExercicios(updated);
                                    }} 
                                    className="w-full bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-2.5 sm:p-3 text-base sm:text-sm text-center text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono font-bold placeholder:text-slate-600"
                                    placeholder="Carga"
                                  />
                                </div>
                              </div>
                            ))}

                            <button 
                              type="button" 
                              onClick={() => setEditExercicios([...editExercicios, { nome: '', series: '3x', reps: '10', carga: '0kg' }])}
                              className="w-full py-3 sm:py-3.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-white/40 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-bold mt-2 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Plus size={16} /> Adicionar Novo Exercício
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

        </div>

        {/* COLUNA DIREITA: Histórico de Conclusões & Indicadores */}
        <div className="lg:col-span-7 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-7 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[500px] max-h-[850px] sm:max-h-[850px]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-5">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={18} className="text-indigo-400" /> Histórico de Atividades
            </h2>
            
            {/* Filtros custom-scrollbar */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
              <Filter className="w-4 h-4 text-slate-500 shrink-0 mr-1 hidden sm:block" />
              {['todos', 'treino', 'peso', 'medida'].map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all shadow-sm ${
                    activeFilter === f 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-cyan-500/10' 
                      : 'bg-black/30 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {f === 'peso' ? 'Peso' : f === 'medida' ? 'Medidas' : f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 custom-scrollbar pr-2">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                <div className="p-4 bg-black/20 rounded-full border border-white/5">
                  <Calendar size={36} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">Nenhum registro encontrado para este filtro.</p>
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

                // LÓGICA DE CORTES ELEGANTES PARA O TÍTULO
                const hasDetails = log.title.includes(': ');
                const mainTitle = hasDetails ? log.title.split(': ')[0] : log.title;
                const details = hasDetails ? log.title.substring(log.title.indexOf(': ') + 2) : '';

                return (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-black/30 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/5 transition-all group relative gap-4">
                    
                    <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                      <span className={`flex items-center justify-center w-12 h-12 rounded-xl border shadow-inner ${style.bg} ${style.border} ${style.text} shrink-0 mt-1 sm:mt-0`}>
                        <Icon size={22} />
                      </span>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h4 className="text-white text-sm sm:text-base font-bold leading-snug truncate pr-2">
                          {mainTitle}
                        </h4>
                        {details && (
                          <p className="text-slate-400 text-[10px] sm:text-xs mt-1 line-clamp-2 sm:line-clamp-1 leading-relaxed">
                            {details}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            <Calendar size={10} /> {formatDateToBR(log.created_at)}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shadow-sm ${style.bg} ${style.text} ${style.border}`}>
                            {log.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end mt-2 sm:mt-0 gap-4 pt-4 sm:pt-0 border-t border-white/10 sm:border-0 shrink-0">
                      {log.value !== null && (
                        <div className={`font-mono text-sm sm:text-base font-bold px-4 py-2 rounded-xl border shadow-sm flex items-baseline gap-1 ${style.bg} ${style.text} ${style.border}`}>
                          {log.value} <span className="text-[10px] sm:text-xs uppercase font-semibold opacity-80 tracking-widest">{log.unit}</span>
                        </div>
                      )}

                      <button 
                        onClick={() => { if(window.confirm('Senhor, deseja excluir este registro do histórico?')) deleteHealthLog(log.id) }} 
                        className="text-slate-500 hover:text-rose-400 p-2.5 sm:p-2.5 bg-black/40 sm:bg-transparent rounded-xl hover:bg-rose-500/10 transition-all border border-white/5 sm:border-none opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                  </div>
                )
              })
            )}
          </div>
        </div>
        
      </main>
    </div>
  );
}
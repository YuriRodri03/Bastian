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
  Activity,
  UserCircle,
  AlertCircle // NOVO: Ícone para alertas de erro
} from 'lucide-react';

export default function Treino() {
  const { healthLogs, addHealthLog, deleteHealthLog, fetchHealthLogs } = useFitnessStore();
  
  // NOVO: Estado para controlar a notificação flutuante (Toast)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // NOVO: Função para disparar a notificação
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    // Esconde a notificação automaticamente após 3 segundos
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Fichas de Treino salvas no LocalStorage
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

  // Estados Fichas
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

  // Estados Medidas Dinâmicas
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
    
    // Limpa o campo após salvar
    handleMedidaChange(medidaNome, '');
    
    // SUBSTITUÍDO: Alert por showToast
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
    const resumoExercicios = ficha.exercicios.map(e => `${e.nome} (${e.series} ${e.reps} - ${e.carga})`).join(' | ');
    addHealthLog('treino', `${ficha.title}: ${resumoExercicios}`, 60, 'min');
    
    // SUBSTITUÍDO: Alert por showToast
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

  const handleSaveNovaFicha = (e) => {
    e.preventDefault();
    if (!novaFichaTitulo.trim() || exerciciosTemp.length === 0) {
      // SUBSTITUÍDO: Alert por showToast de erro
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
    if (window.confirm('Excluir esta ficha permanentemente?')) {
      setFichasTreino(fichasTreino.filter(f => f.id !== id));
      showToast('Ficha excluída.', 'success');
    }
  };

  const filteredLogs = healthLogs
    .filter(log => activeFilter === 'todos' || log.type === activeFilter)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalTreinos = healthLogs.filter(l => l.type === 'treino').length;
  const ultimoPeso = healthLogs.filter(l => l.type === 'peso').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  return (
    <div className="min-h-screen p-8 font-sans flex flex-col items-center relative">
      
      {/* NOVO: Componente do Toast Flutuante */}
      {toast.show && (
        <div className={`fixed top-8 right-8 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          toast.type === 'error' 
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="w-full max-w-6xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
            <Dumbbell className="text-cyan-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 tracking-wide">Saúde & Performance</h1>
            <p className="text-sm text-slate-400">Gerencie seus treinos e acompanhe seus indicadores corporais</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Flame size={16} /></div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Treinos</div>
              <div className="text-sm font-bold text-slate-200">{totalTreinos}</div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Scale size={16} /></div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Último Peso</div>
              <div className="text-sm font-bold text-slate-200 font-mono">{ultimoPeso ? `${ultimoPeso.value} ${ultimoPeso.unit}` : '--'}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: Fichas & Painel Dinâmico de Medidas */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* SEÇÃO DE MEDIDAS RÁPIDAS (NOVO DESIGN) */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
              <UserCircle size={16} className="text-emerald-400" /> Atualização Rápida de Medidas
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(medidasRapidas).map((medidaNome) => {
                const data = medidasRapidas[medidaNome];
                // Busca a última medida gravada no histórico para mostrar como placeholder/referência
                const ultimaGravada = healthLogs
                  .filter(l => l.title === medidaNome)
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

                const isPeso = medidaNome === 'Peso';

                return (
                  <div key={medidaNome} className={`bg-black/20 border border-white/5 p-3 rounded-xl flex flex-col justify-between ${isPeso ? 'col-span-2' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] uppercase tracking-wide font-medium text-slate-400 flex items-center gap-1">
                        {isPeso ? <Scale size={12} className="text-emerald-400"/> : <Ruler size={12} className="text-cyan-400"/>} 
                        {medidaNome}
                      </span>
                      {ultimaGravada && (
                        <span className="text-[10px] text-slate-600 font-mono">Últ: {ultimaGravada.value}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        step="0.1"
                        value={data.valor}
                        onChange={(e) => handleMedidaChange(medidaNome, e.target.value)}
                        placeholder={`Ex: ${ultimaGravada ? ultimaGravada.value : '00'}`}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-center"
                      />
                      <button 
                        onClick={() => handleSaveMedida(medidaNome)}
                        disabled={!data.valor}
                        className={`px-3 rounded-lg flex items-center justify-center transition-colors ${data.valor ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SEÇÃO DE FICHAS DE TREINO */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Dumbbell size={16} className="text-cyan-400" /> Fichas de Treino
              </h2>
              <button 
                onClick={() => setIsCreatingFicha(!isCreatingFicha)}
                className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
              >
                <Plus size={14} /> Nova Ficha
              </button>
            </div>

            {/* CRIAR NOVA FICHA */}
            {isCreatingFicha && (
              <form onSubmit={handleSaveNovaFicha} className="bg-black/40 border border-cyan-500/30 p-4 rounded-2xl mb-6 space-y-3">
                <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Criar Nova Ficha</h3>
                
                <input 
                  required 
                  type="text" 
                  value={novaFichaTitulo} 
                  onChange={(e) => setNovaFichaTitulo(e.target.value)} 
                  placeholder="Nome (ex: Treino C - Pernas)" 
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500" 
                />

                <div className="space-y-2 border-t border-white/10 pt-2">
                  <span className="text-[11px] text-slate-400">Adicionar Exercícios:</span>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={novoExercicioNome} 
                      onChange={(e) => setNovoExercicioNome(e.target.value)} 
                      placeholder="Nome (ex: Cadeira Extensora)" 
                      className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-xs text-slate-200 focus:outline-none" 
                    />
                    <div className="flex gap-2">
                      <input type="text" value={novoExercicioSeries} onChange={(e) => setNovoExercicioSeries(e.target.value)} placeholder="Séries" className="w-1/3 bg-black/30 border border-white/10 rounded-xl p-2 text-xs text-slate-200 focus:outline-none" />
                      <input type="text" value={novoExercicioReps} onChange={(e) => setNovoExercicioReps(e.target.value)} placeholder="Reps" className="w-1/3 bg-black/30 border border-white/10 rounded-xl p-2 text-xs text-slate-200 focus:outline-none" />
                      <input type="text" value={novoExercicioCarga} onChange={(e) => setNovoExercicioCarga(e.target.value)} placeholder="Carga" className="w-1/3 bg-black/30 border border-white/10 rounded-xl p-2 text-xs text-slate-200 focus:outline-none" />
                    </div>
                    <button type="button" onClick={handleAddExercicioTemp} className="py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl text-xs font-medium">
                      + Adicionar à Ficha
                    </button>
                  </div>

                  {exerciciosTemp.length > 0 && (
                    <div className="bg-white/5 p-2 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                      {exerciciosTemp.map((ex, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] text-slate-300 px-2 py-1 bg-black/20 rounded">
                          <span>{ex.nome} ({ex.series} {ex.reps})</span>
                          <span className="font-mono text-cyan-400">{ex.carga}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-xl transition-colors">Salvar Ficha</button>
                  <button type="button" onClick={() => setIsCreatingFicha(false)} className="px-3 py-2 bg-white/10 text-slate-300 hover:bg-white/20 text-xs rounded-xl transition-colors">Cancelar</button>
                </div>
              </form>
            )}

            {/* LISTA DE FICHAS COM SUPORTE A EDIÇÃO COMPLETA */}
            <div className="space-y-3">
              {fichasTreino.map(ficha => {
                const isExpanded = expandedFichaId === ficha.id;
                const isEditing = editingFichaId === ficha.id;

                return (
                  <div key={ficha.id} className="bg-black/20 border border-white/10 rounded-2xl p-4 transition-all hover:border-white/20">
                    
                    <div className="flex justify-between items-center">
                      <div className="cursor-pointer flex-1" onClick={() => !isEditing && setExpandedFichaId(isExpanded ? null : ficha.id)}>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editFichaTitulo} 
                            onChange={(e) => setEditFichaTitulo(e.target.value)} 
                            className="bg-black/40 border border-cyan-500 rounded-lg px-2 py-1 text-xs text-white w-full font-semibold focus:outline-none"
                          />
                        ) : (
                          <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                            {ficha.title}
                            {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                          </h4>
                        )}
                        <span className="text-[10px] text-slate-500">{ficha.exercicios.length} exercícios</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEditing ? (
                          <>
                            <button onClick={() => handleConcluirTreino(ficha)} title="Concluir treino hoje" className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-medium flex items-center gap-1 shadow-sm transition-colors">
                              <Play size={10} fill="currentColor" /> Concluir
                            </button>
                            <button onClick={() => handleStartEdit(ficha)} title="Editar Ficha" className="text-slate-400 hover:text-cyan-400 p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => handleDeleteFicha(ficha.id)} title="Excluir Ficha" className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleSaveEdit(ficha.id)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition-colors">
                            <Check size={12} /> Salvar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CONTEÚDO DOS EXERCÍCIOS */}
                    {(isExpanded || isEditing) && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                        {!isEditing ? (
                          ficha.exercicios.map((ex, i) => (
                            <div key={i} className="flex justify-between items-center text-xs bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                              <span className="text-slate-300 font-medium">{ex.nome}</span>
                              <div className="flex gap-3 text-[11px] font-mono text-slate-400">
                                <span>{ex.series} {ex.reps}</span>
                                <span className="text-cyan-400 font-bold">{ex.carga}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="space-y-2">
                            <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">Editando Exercícios e Cargas:</span>
                            {editExercicios.map((ex, index) => (
                              <div key={index} className="flex gap-1 items-center bg-black/30 p-2 rounded-xl border border-white/10">
                                <input 
                                  type="text" 
                                  value={ex.nome} 
                                  onChange={(e) => {
                                    const updated = [...editExercicios];
                                    updated[index].nome = e.target.value;
                                    setEditExercicios(updated);
                                  }} 
                                  className="flex-1 bg-transparent text-xs text-white focus:outline-none px-1"
                                  placeholder="Exercício"
                                />
                                <input 
                                  type="text" 
                                  value={ex.series} 
                                  onChange={(e) => {
                                    const updated = [...editExercicios];
                                    updated[index].series = e.target.value;
                                    setEditExercicios(updated);
                                  }} 
                                  className="w-12 bg-black/40 border border-white/10 rounded text-[11px] text-center text-white focus:outline-none py-0.5"
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
                                  className="w-12 bg-black/40 border border-white/10 rounded text-[11px] text-center text-white focus:outline-none py-0.5"
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
                                  className="w-16 bg-cyan-950/40 border border-cyan-500/40 rounded text-[11px] text-center text-cyan-300 focus:outline-none py-0.5 font-mono"
                                  placeholder="Carga"
                                />
                                <button 
                                  type="button" 
                                  onClick={() => setEditExercicios(editExercicios.filter((_, idx) => idx !== index))}
                                  className="text-rose-400 hover:text-rose-300 p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}

                            <button 
                              type="button" 
                              onClick={() => setEditExercicios([...editExercicios, { nome: 'Novo Exercício', series: '3x', reps: '10', carga: '0kg' }])}
                              className="w-full py-1.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-slate-300 rounded-xl text-xs mt-1 transition-colors"
                            >
                              + Adicionar novo exercício
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
        <div className="lg:col-span-7 bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col h-[740px]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
            <h2 className="text-sm font-semibold text-slate-300">Histórico de Atividades</h2>
            
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
              {['todos', 'treino', 'peso', 'medida'].map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-all ${
                    activeFilter === f 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                      : 'bg-black/20 text-slate-400 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {f === 'peso' ? 'Peso' : f === 'medida' ? 'Medidas' : f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-3">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Calendar size={36} className="opacity-20 mb-2" />
                <p>Nenhum registro encontrado para este filtro.</p>
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

                return (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/20 border border-white/10 rounded-2xl hover:border-white/20 transition-all group relative">
                    
                    <div className="flex items-center gap-4">
                      <span className={`flex items-center justify-center w-10 h-10 rounded-xl border ${style.bg} ${style.border} ${style.text} shrink-0`}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <h4 className="text-slate-200 text-sm font-medium leading-snug">{log.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Calendar size={10} /> {formatDateToBR(log.created_at)}
                          </span>
                          <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                            {log.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end mt-3 sm:mt-0 gap-4 pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
                      {log.value !== null && (
                        <div className={`font-mono text-xs font-semibold px-3 py-1.5 rounded-xl border ${style.bg} ${style.text} ${style.border}`}>
                          {log.value} <span className="text-[10px] uppercase font-normal">{log.unit}</span>
                        </div>
                      )}

                      <button 
                        onClick={() => { if(window.confirm('Excluir este registro?')) deleteHealthLog(log.id) }} 
                        className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
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
import React, { useState, useEffect, useMemo } from 'react';
import { useAgendaStore } from '../store/useAgendaStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useInboxStore } from '../store/useInboxStore';
import { 
  Calendar as CalendarIcon, CheckSquare, Target, Plus, 
  ChevronLeft, ChevronRight, X, Trash2, Tag, Clock, Eye, 
  Edit2, ListTodo, Layers, RefreshCw, Search, ArrowRight, ArrowLeft, CheckCircle2, Check
} from 'lucide-react'; 
import { 
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, 
  isSameDay, parseISO, isAfter 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ESTILOS SEMÂNTICOS POR CATEGORIA DE EVENTO
const EVENT_CATEGORIES = {
  evento: { label: 'Evento / Compromisso', badge: 'bg-cyan-500/15 border-cyan-500 text-cyan-200', card: 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/15', dot: 'bg-cyan-400' },
  aula: { label: 'Aula / Estudo', badge: 'bg-purple-500/15 border-purple-500 text-purple-200', card: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15', dot: 'bg-purple-400' },
  reuniao: { label: 'Trabalho / Reunião', badge: 'bg-indigo-500/15 border-indigo-500 text-indigo-200', card: 'bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/15', dot: 'bg-indigo-400' },
  tarefa: { label: 'Tarefa / Prazo', badge: 'bg-amber-500/15 border-amber-500 text-amber-200', card: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15', dot: 'bg-amber-400' },
  saude: { label: 'Saúde / Treino', badge: 'bg-rose-500/15 border-rose-500 text-rose-200', card: 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15', dot: 'bg-rose-400' },
  financeiro: { label: 'Financeiro / Pagamento', badge: 'bg-emerald-500/15 border-emerald-500 text-emerald-200', card: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15', dot: 'bg-emerald-400' },
  lazer: { label: 'Lazer / Social', badge: 'bg-fuchsia-500/15 border-fuchsia-500 text-fuchsia-200', card: 'bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/15', dot: 'bg-fuchsia-400' },
  lembrete: { label: 'Lembrete', badge: 'bg-slate-500/20 border-slate-400 text-slate-200', card: 'bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/15', dot: 'bg-slate-400' }
};

const KANBAN_COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-400', border: 'border-slate-400/30', next: 'in-progress', prev: null },
  { id: 'in-progress', label: 'Em Andamento', color: 'bg-cyan-400', border: 'border-cyan-400/30', next: 'done', prev: 'backlog' },
  { id: 'done', label: 'Concluído', color: 'bg-emerald-400', border: 'border-emerald-400/30', next: null, prev: 'in-progress' }
];

const getCategoryStyle = (cat) => EVENT_CATEGORIES[cat] || EVENT_CATEGORIES.evento;

const sortEventsByTime = (events = []) => {
  return [...events].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
};

export default function Agenda() {
  const { agendaItems, addAgendaItem, updateAgendaItem, deleteAgendaItem, fetchAgendaItems, isLoading: agendaLoading } = useAgendaStore();
  const { transactions, fetchTransactions, toggleTransactionStatus } = useFinanceStore();
  const { tasks: kanbanTasks, addTask: addKanbanTask, updateTask: updateKanbanTask, moveTask, fetchKanbanTasks, deleteTask: deleteKanbanTask } = useKanbanStore();
  const { inboxTasks, addInboxTask, updateInboxTask, toggleInboxTask, deleteInboxTask, fetchInboxTasks } = useInboxStore();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [calendarMode, setCalendarMode] = useState('month'); 
  const [searchQuery, setSearchQuery] = useState('');

  // ESTADOS DE CRIAÇÃO E EDIÇÃO DO INBOX
  const [newInboxTitle, setNewInboxTitle] = useState('');
  const [editingInboxId, setEditingInboxId] = useState(null);
  const [editInboxTitle, setEditInboxTitle] = useState('');
  const [editInboxDate, setEditInboxDate] = useState('');

  // ESTADOS DE CRIAÇÃO E EDIÇÃO DO KANBAN
  const [addingKanbanCol, setAddingKanbanCol] = useState(null);
  const [newKanbanTitle, setNewKanbanTitle] = useState('');
  const [editingKanbanId, setEditingKanbanId] = useState(null);
  const [editKanbanTitle, setEditKanbanTitle] = useState('');

  // CONFIRMAÇÃO DE EXCLUSÃO EM 2 TOQUES
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ESTADOS DO MODAL DE FORMULÁRIO DE EVENTO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newItem, setNewItem] = useState({ 
    title: '', 
    date: format(new Date(), 'yyyy-MM-dd'), 
    time: '', 
    category: 'evento' 
  });

  // ESTADOS DO EVENTO RECORRENTE
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // MODAL DE DETALHES DO DIA
  const [selectedDayModal, setSelectedDayModal] = useState({ isOpen: false, date: null });

  useEffect(() => {
    fetchAgendaItems();
    if (fetchTransactions) fetchTransactions();
    fetchKanbanTasks();
    fetchInboxTasks();
  }, [fetchAgendaItems, fetchTransactions, fetchKanbanTasks, fetchInboxTasks]);

  // =========================================================================
  // NAVEGAÇÃO DE DATAS E CONSTRUÇÃO DO GRID DO CALENDÁRIO
  // =========================================================================
  const nextPeriod = () => {
    if (activeTab === 'inbox' || calendarMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (calendarMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const prevPeriod = () => {
    if (activeTab === 'inbox' || calendarMode === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (calendarMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const calendarDays = useMemo(() => {
    let startDate, endDate;
    if (calendarMode === 'month') {
      startDate = startOfWeek(startOfMonth(currentDate));
      endDate = endOfWeek(endOfMonth(currentDate));
    } else if (calendarMode === 'week') {
      startDate = startOfWeek(currentDate);
      endDate = endOfWeek(currentDate);
    } else {
      startDate = currentDate;
      endDate = currentDate;
    }

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate, calendarMode]);

  const renderHeaderTitle = () => {
    if (calendarMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    if (calendarMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      if (isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, 'd')} a ${format(weekEnd, 'd')} de ${format(weekStart, 'MMMM yyyy', { locale: ptBR })}`;
      }
      return `${format(weekStart, 'd')} de ${format(weekStart, 'MMM', { locale: ptBR })} a ${format(weekEnd, 'd')} de ${format(weekEnd, 'MMM yyyy', { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  // =========================================================================
  // LÓGICA DO INBOX DIÁRIO (CRIAÇÃO, EDIÇÃO E PROGRESSO)
  // =========================================================================
  const currentSelectedDateString = format(currentDate, 'yyyy-MM-dd');
  
  const tarefasDoDiaSelecionado = useMemo(() => {
    return (inboxTasks || []).filter(t => {
      const matchDate = !t.date || t.date === currentSelectedDateString;
      const matchSearch = !searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDate && matchSearch;
    });
  }, [inboxTasks, currentSelectedDateString, searchQuery]);

  const inboxProgress = useMemo(() => {
    if (tarefasDoDiaSelecionado.length === 0) return 0;
    const completedCount = tarefasDoDiaSelecionado.filter(t => t.completed).length;
    return Math.round((completedCount / tarefasDoDiaSelecionado.length) * 100);
  }, [tarefasDoDiaSelecionado]);

  const handleAddInboxTaskWithDate = (e) => {
    e.preventDefault();
    if (!newInboxTitle.trim()) return;
    addInboxTask(newInboxTitle.trim(), currentSelectedDateString); 
    setNewInboxTitle('');
  };

  const handleStartEditInbox = (task) => {
    setEditingInboxId(task.id);
    setEditInboxTitle(task.title || '');
    setEditInboxDate(task.date || currentSelectedDateString);
  };

  const handleSaveEditInbox = async (taskId) => {
    if (!editInboxTitle.trim()) return;
    if (updateInboxTask) {
      await updateInboxTask(taskId, {
        title: editInboxTitle.trim(),
        date: editInboxDate || currentSelectedDateString
      });
    }
    setEditingInboxId(null);
  };

  // =========================================================================
  // LÓGICA DO KANBAN (CRIAÇÃO E EDIÇÃO INLINE + TOUCH MOVE)
  // =========================================================================
  const handleAddKanbanSubmit = (e, columnId) => {
    e.preventDefault();
    if (!newKanbanTitle.trim()) return;
    if (addKanbanTask) {
      addKanbanTask(newKanbanTitle.trim(), columnId);
    } else {
      useKanbanStore.getState().addTask(newKanbanTitle.trim(), columnId);
    }
    setNewKanbanTitle('');
    setAddingKanbanCol(null);
  };

  const handleStartEditKanban = (task) => {
    setEditingKanbanId(task.id);
    setEditKanbanTitle(task.title || '');
  };

  const handleSaveEditKanban = async (taskId) => {
    if (!editKanbanTitle.trim()) return;
    if (updateKanbanTask) {
      await updateKanbanTask(taskId, { title: editKanbanTitle.trim() });
    }
    setEditingKanbanId(null);
  };

  // =========================================================================
  // MOTOR DE SALVAMENTO E EDIÇÃO DE EVENTOS DA AGENDA
  // =========================================================================
  const abrirModalNovoEvento = (defaultDate = currentDate) => {
    setEditingId(null);
    setNewItem({
      title: '',
      date: format(defaultDate, 'yyyy-MM-dd'),
      time: '',
      category: 'evento'
    });
    setIsRecurring(false);
    setRecurrenceEndDate('');
    setIsModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newItem.title.trim() || !newItem.date) return;
    setIsSubmitting(true);

    try {
      if (editingId && updateAgendaItem) {
        await updateAgendaItem(editingId, { ...newItem, title: newItem.title.trim() });
      } else {
        if (isRecurring && recurrenceEndDate && newItem.date) {
          let currDate = parseISO(newItem.date);
          const limitDate = parseISO(recurrenceEndDate);
          const batchItems = [];
          let safetyCounter = 0;

          while (!isAfter(currDate, limitDate) && safetyCounter < 365) {
            batchItems.push({ 
              ...newItem, 
              title: newItem.title.trim(),
              date: format(currDate, 'yyyy-MM-dd') 
            });
            
            if (recurrenceType === 'daily') currDate = addDays(currDate, 1);
            else if (recurrenceType === 'weekly') currDate = addWeeks(currDate, 1);
            else if (recurrenceType === 'monthly') currDate = addMonths(currDate, 1);
            
            safetyCounter++;
          }
          
          await addAgendaItem(batchItems);
        } else {
          await addAgendaItem({ ...newItem, title: newItem.title.trim() });
        }
      }
    } catch (error) {
      console.error("Erro ao salvar o evento:", error);
    } finally {
      setIsSubmitting(false);
      fecharModalFormulario();
    }
  };

  const handleEditClick = (evento) => {
    setEditingId(evento.id);
    setNewItem({
      title: evento.title,
      date: evento.date,
      time: evento.time ? evento.time.substring(0, 5) : '',
      category: evento.category || 'evento'
    });
    setSelectedDayModal({ isOpen: false, date: null }); 
    setIsModalOpen(true); 
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

  const fecharModalFormulario = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewItem({ title: '', date: format(currentDate, 'yyyy-MM-dd'), time: '', category: 'evento' });
    setIsRecurring(false);
    setRecurrenceEndDate('');
    setRecurrenceType('weekly');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">
      
      {/* CABEÇALHO PADRÃO GLASSMORPHISM */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl border border-cyan-500/20 backdrop-blur-md shadow-lg shadow-cyan-500/10">
            <Target className="text-cyan-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Centro de Produtividade</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Agenda Integrada, Inbox Diário & Projetos</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Busca Rápida Global */}
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar eventos ou tarefas..."
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Menu de Abas Segmentado */}
          <div className="flex items-center bg-black/40 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-inner overflow-x-auto custom-scrollbar shrink-0 snap-x">
            <button onClick={() => setActiveTab('calendar')} className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'calendar' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <CalendarIcon size={16} /> <span>Calendário</span>
            </button>
            <button onClick={() => setActiveTab('inbox')} className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'inbox' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <ListTodo size={16} /> <span>Inbox Diário</span>
            </button>
            <button onClick={() => setActiveTab('projects')} className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'projects' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <Layers size={16} /> <span>Kanban</span>
            </button>
          </div>
        </div>
      </div>

      <main className="w-full max-w-7xl flex-1 flex flex-col relative">
        
        {/* BOTÃO FLUTUANTE (FAB) PARA MOBILE */}
        {activeTab === 'calendar' && (
          <button 
            onClick={() => abrirModalNovoEvento(currentDate)}
            className="sm:hidden fixed bottom-24 right-5 z-[90] w-14 h-14 bg-cyan-600 rounded-full shadow-[0_4px_20px_rgba(6,182,212,0.5)] flex items-center justify-center text-white hover:bg-cyan-500 active:scale-95 transition-all"
          >
            <Plus size={28} />
          </button>
        )}

        {/* ================= NAVEGAÇÃO DE DATA GLOBAL ================= */}
        {(activeTab === 'calendar' || activeTab === 'inbox') && (
          <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 bg-black/20 p-4 sm:p-5 border border-white/10 rounded-t-2xl sm:rounded-t-3xl transition-all">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 w-full md:w-auto">
              
              <h2 className="text-lg sm:text-xl font-bold text-white capitalize text-center sm:text-left min-w-[200px] flex items-center justify-center sm:justify-start gap-2">
                {activeTab === 'inbox' ? <><CheckSquare size={20} className="text-cyan-400"/> Tarefas do Dia</> : renderHeaderTitle()}
              </h2>
              
              <div className="flex items-center justify-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 w-full sm:w-auto">
                <button onClick={prevPeriod} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"><ChevronLeft size={18} /></button>
                
                {activeTab === 'inbox' && (
                  <span className="px-3 py-1 text-sm font-bold text-cyan-300 capitalize min-w-[90px] text-center tracking-wide">
                    {format(currentDate, "dd MMM", { locale: ptBR })}
                  </span>
                )}

                <button onClick={goToToday} className="px-4 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Hoje</button>
                <button onClick={nextPeriod} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"><ChevronRight size={18} /></button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-between sm:justify-end">
              {activeTab === 'calendar' ? (
                <>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 w-full sm:w-auto">
                    {[
                      { id: 'month', label: 'Mês' },
                      { id: 'week', label: 'Semana' },
                      { id: 'day', label: 'Dia' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCalendarMode(mode.id)}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          calendarMode === mode.id 
                            ? 'bg-white/10 text-white shadow' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => abrirModalNovoEvento(currentDate)} 
                    className="hidden sm:flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 shrink-0"
                  >
                    <Plus size={16} /> Novo Evento
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5 w-full sm:w-auto justify-between sm:justify-center">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <ListTodo size={14} className="text-cyan-400" />
                    {tarefasDoDiaSelecionado.filter(t => !t.completed).length} pendentes
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    {inboxProgress}% concluído
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 1: CALENDÁRIO ================= */}
        {activeTab === 'calendar' && (
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-b-2xl sm:rounded-b-3xl border-t-0 backdrop-blur-xl shadow-2xl flex flex-col flex-1 overflow-hidden min-h-[520px] sm:min-h-[650px]">
            <div className={`flex-1 grid bg-black/20 overflow-y-auto ${calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
              
              {calendarMode !== 'day' && ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                <div key={dia} className="bg-black/40 py-2.5 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-white/10">
                  {dia}
                </div>
              ))}
              
              {calendarDays.map((diaAtual, index) => {
                const isCurrentMonth = isSameMonth(diaAtual, currentDate);
                const isToday = isSameDay(diaAtual, new Date());
                const dataString = format(diaAtual, 'yyyy-MM-dd');
                const query = searchQuery.toLowerCase().trim();
                
                const eventosDoDia = sortEventsByTime(
                  (agendaItems || []).filter(item => 
                    item.date === dataString && 
                    (!query || item.title.toLowerCase().includes(query) || (item.category || '').toLowerCase().includes(query))
                  )
                );
                const transacoesDoDia = (transactions || []).filter(t => 
                  t.date === dataString && 
                  (!query || t.description.toLowerCase().includes(query))
                );
                const tarefasDoDia = (inboxTasks || []).filter(t => 
                  t.date === dataString && !t.completed &&
                  (!query || t.title.toLowerCase().includes(query))
                );
                
                const totalItens = eventosDoDia.length + transacoesDoDia.length + tarefasDoDia.length;

                return (
                  <div 
                    key={index} 
                    onClick={() => setSelectedDayModal({ isOpen: true, date: diaAtual })}
                    className={`p-1.5 sm:p-3 border-b border-r border-white/5 hover:bg-white/5 transition-colors group relative flex flex-col min-w-0 cursor-pointer
                      ${calendarMode === 'month' ? 'min-h-[75px] sm:min-h-[125px]' : 'min-h-[420px]'} 
                      ${isCurrentMonth || calendarMode !== 'month' ? 'bg-transparent' : 'bg-black/60'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                      <span className={`text-[10px] sm:text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]' : isCurrentMonth || calendarMode !== 'month' ? 'text-slate-200' : 'text-slate-600'}`}>
                        {format(diaAtual, 'd')}
                      </span>
                      {calendarMode === 'day' && <span className="text-slate-400 text-xs sm:text-sm font-bold capitalize">{format(diaAtual, 'EEEE', { locale: ptBR })}</span>}
                      
                      {calendarMode === 'month' && totalItens > 2 && (
                        <span className="hidden sm:inline-block text-[9px] font-bold bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
                          +{totalItens - 2}
                        </span>
                      )}
                      
                      {calendarMode === 'month' && totalItens > 0 && (
                        <div className="sm:hidden flex items-center gap-0.5 mt-1 mr-0.5">
                          {eventosDoDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
                          {transacoesDoDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                          {tarefasDoDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                        </div>
                      )}
                    </div>
                    
                    <div className={`flex flex-col gap-1 overflow-hidden flex-1 ${calendarMode === 'month' ? 'hidden sm:flex' : 'flex'}`}>
                      {eventosDoDia.slice(0, calendarMode === 'month' ? 2 : eventosDoDia.length).map(evento => {
                        const style = getCategoryStyle(evento.category);
                        return (
                          <div 
                            key={`ev-${evento.id}`} 
                            className={`px-1.5 py-0.5 sm:px-2 sm:py-1 border-l-2 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1 ${style.badge}`} 
                            title={evento.title}
                          >
                            {evento.time && <span className="opacity-75 font-mono tracking-wider shrink-0 hidden sm:inline">{evento.time.substring(0,5)}</span>}
                            <span className="truncate">{evento.title}</span>
                          </div>
                        );
                      })}

                      {transacoesDoDia.slice(0, calendarMode === 'month' ? 1 : transacoesDoDia.length).map(transacao => {
                        const isDespesa = transacao.type === 'despesa';
                        return (
                          <div 
                            key={`fin-${transacao.id}`} 
                            className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-bold rounded flex justify-between gap-1 items-center overflow-hidden ${isDespesa ? 'bg-rose-500/15 border-l-2 border-rose-500 text-rose-300' : 'bg-emerald-500/15 border-l-2 border-emerald-500 text-emerald-300'}`}
                            title={transacao.description}
                          >
                            <span className="truncate flex-1">{transacao.description.split(' [')[0]}</span>
                            <span className="hidden xl:inline font-mono">R${Number(transacao.amount).toFixed(0)}</span>
                          </div>
                        );
                      })}
                      
                      {(calendarMode === 'week' || calendarMode === 'day') && tarefasDoDia.length > 0 && (
                        <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-500/15 border-l-2 border-amber-500 text-amber-300 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1 mt-0.5">
                          <CheckSquare size={10} className="shrink-0" />
                          <span className="truncate">{tarefasDoDia.length} {tarefasDoDia.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}</span>
                        </div>
                      )}
                    </div>

                    {calendarMode === 'month' && totalItens > 0 && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center rounded-lg hidden sm:flex">
                        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1 bg-cyan-950/90 border border-cyan-500/40 px-3 py-1.5 rounded-lg shadow-lg">
                          <Eye size={14} /> Detalhes ({totalItens})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= ABA 2: INBOX DIÁRIO (COM EDIÇÃO INLINE DE TEXTO E DATA) ================= */}
        {activeTab === 'inbox' && (
          <div className="w-full bg-gradient-to-b from-white/10 to-white/5 border border-white/10 border-t-0 p-5 sm:p-8 rounded-b-2xl sm:rounded-b-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[500px] h-[700px]">
            <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
              
              {tarefasDoDiaSelecionado.length > 0 && (
                <div className="mb-5">
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${inboxProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <form onSubmit={handleAddInboxTaskWithDate} className="flex flex-col sm:flex-row gap-3 mb-6">
                <input 
                  type="text" 
                  value={newInboxTitle} 
                  onChange={(e) => setNewInboxTitle(e.target.value)}
                  placeholder="Ex: Revisar artigo, enviar relatório, ligar para orientadora..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3.5 sm:p-4 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
                <button type="submit" disabled={!newInboxTitle.trim()} className="px-6 py-3.5 sm:py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-cyan-500/25 transition-all font-bold text-sm flex items-center justify-center gap-2 shrink-0">
                  <Plus size={18} /> <span>Adicionar Tarefa</span>
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 sm:pr-2">
                {tarefasDoDiaSelecionado.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                    <div className="p-5 bg-black/20 rounded-full border border-white/5">
                      <CheckSquare size={40} className="opacity-40 text-cyan-500/50" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma tarefa programada para este dia.</p>
                  </div>
                ) : (
                  tarefasDoDiaSelecionado.map(task => {
                    const confirmKey = `inbox-${task.id}`;
                    const isConfirming = confirmDeleteId === confirmKey;
                    const isEditingThis = editingInboxId === task.id;

                    return (
                      <div 
                        key={task.id} 
                        className={`group flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
                          isEditingThis
                            ? 'bg-black/50 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                            : task.completed 
                              ? 'bg-black/20 border-white/5 opacity-60' 
                              : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 shadow-lg'
                        }`}
                      >
                        {isEditingThis ? (
                          /* MODO EDIÇÃO INLINE DA TAREFA */
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
                            <input
                              autoFocus
                              type="text"
                              value={editInboxTitle}
                              onChange={(e) => setEditInboxTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditInbox(task.id);
                                if (e.key === 'Escape') setEditingInboxId(null);
                              }}
                              className="flex-1 bg-black/60 border border-cyan-500/40 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="Título da tarefa..."
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={editInboxDate}
                                onChange={(e) => setEditInboxDate(e.target.value)}
                                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
                                title="Reagendar data da tarefa"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditInbox(task.id)}
                                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                              >
                                <Check size={15} /> Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInboxId(null)}
                                className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl shrink-0"
                                title="Cancelar"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* MODO VISUALIZAÇÃO PADRÃO */
                          <>
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={task.completed} 
                                onChange={() => toggleInboxTask(task.id, task.completed)}
                                className="w-5 h-5 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-slate-900 cursor-pointer shrink-0 transition-colors"
                              />
                              <span 
                                onDoubleClick={() => handleStartEditInbox(task)}
                                title="Duplo clique para editar"
                                className={`flex-1 text-sm sm:text-base font-medium truncate cursor-pointer ${
                                  task.completed ? 'line-through text-slate-500' : 'text-slate-200'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditInbox(task)}
                                title="Editar Tarefa"
                                className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => triggerSafeDelete(confirmKey, () => deleteInboxTask(task.id))}
                                className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold ${
                                  isConfirming 
                                    ? 'bg-rose-500 text-white px-3 animate-pulse' 
                                    : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                }`}
                                title="Excluir Tarefa"
                              >
                                <Trash2 size={16} />
                                {isConfirming && <span>Confirmar?</span>}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 3: KANBAN (COM EDIÇÃO INLINE + TOUCH MOVE) ================= */}
        {activeTab === 'projects' && (
          <div className="h-[720px] flex gap-5 sm:gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory mt-2">
            {KANBAN_COLUMNS.map((column) => {
              const colTasks = (kanbanTasks || []).filter(t => 
                t.status === column.id &&
                (!searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
              );

              return (
                <div 
                  key={column.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const taskId = e.dataTransfer.getData('taskId');
                    if (taskId) moveTask(taskId, column.id);
                  }}
                  className="min-w-[85vw] sm:min-w-[350px] flex-1 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-3xl p-5 flex flex-col max-h-full backdrop-blur-xl snap-center"
                >
                  <div className={`flex justify-between items-center mb-5 pb-4 border-b ${column.border}`}>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${column.color} shadow-[0_0_10px_currentColor]`}></div> 
                      {column.label}
                    </h3>
                    <span className="bg-black/40 border border-white/10 text-slate-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                      {colTasks.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                    {colTasks.map(task => {
                      const confirmKey = `kb-${task.id}`;
                      const isConfirming = confirmDeleteId === confirmKey;
                      const isEditingCard = editingKanbanId === task.id;

                      return (
                        <div 
                          key={task.id}
                          draggable={!isEditingCard}
                          onDragStart={(e) => !isEditingCard && e.dataTransfer.setData('taskId', task.id)}
                          className={`bg-black/40 border p-4 rounded-2xl shadow-lg transition-all flex flex-col gap-3 ${
                            isEditingCard 
                              ? 'border-cyan-500/50' 
                              : 'border-white/10 cursor-grab active:cursor-grabbing hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          {isEditingCard ? (
                            <div className="flex flex-col gap-2.5">
                              <input
                                autoFocus
                                type="text"
                                value={editKanbanTitle}
                                onChange={(e) => setEditKanbanTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditKanban(task.id);
                                  if (e.key === 'Escape') setEditingKanbanId(null);
                                }}
                                className="w-full bg-black/60 border border-cyan-500/40 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingKanbanId(null)}
                                  className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-white/5"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditKanban(task.id)}
                                  className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1"
                                >
                                  <Check size={13} /> Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start gap-2">
                                <h4 
                                  onDoubleClick={() => handleStartEditKanban(task)}
                                  className="text-slate-200 text-sm font-bold leading-relaxed break-words flex-1"
                                >
                                  {task.title}
                                </h4>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditKanban(task)}
                                    title="Editar Cartão"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => triggerSafeDelete(confirmKey, () => deleteKanbanTask(task.id))}
                                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold ${
                                      isConfirming 
                                        ? 'bg-rose-500 text-white px-2 animate-pulse' 
                                        : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                    }`}
                                    title="Excluir Cartão"
                                  >
                                    <Trash2 size={14} />
                                    {isConfirming && <span>Apagar?</span>}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
                                {column.prev && (
                                  <button
                                    type="button"
                                    onClick={() => moveTask(task.id, column.prev)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] font-bold transition-colors"
                                  >
                                    <ArrowLeft size={12} /> Voltar
                                  </button>
                                )}
                                {column.next && (
                                  <button
                                    type="button"
                                    onClick={() => moveTask(task.id, column.next)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold transition-colors"
                                  >
                                    Avançar <ArrowRight size={12} />
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {addingKanbanCol === column.id ? (
                    <form onSubmit={(e) => handleAddKanbanSubmit(e, column.id)} className="mt-4 bg-black/40 p-3 rounded-2xl border border-cyan-500/30 space-y-2.5">
                      <input
                        autoFocus
                        type="text"
                        value={newKanbanTitle}
                        onChange={(e) => setNewKanbanTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setAddingKanbanCol(null); }}
                        placeholder="Título do cartão..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setAddingKanbanCol(null); setNewKanbanTitle(''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!newKanbanTitle.trim()}
                          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white"
                        >
                          Adicionar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      onClick={() => { setAddingKanbanCol(column.id); setNewKanbanTitle(''); }}
                      className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-white py-3.5 bg-black/20 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl w-full transition-all"
                    >
                      <Plus size={16} /> Adicionar Cartão
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ================= MODAL DE DETALHES DO DIA SELECIONADO ================= */}
      {selectedDayModal.isOpen && selectedDayModal.date && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 p-5 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white capitalize">
                  {format(selectedDayModal.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Resumo completo de compromissos, tarefas e caixa</p>
              </div>
              <button onClick={() => setSelectedDayModal({ isOpen: false, date: null })} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
              
              {/* Seção 1: Eventos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                    <CalendarIcon size={14} /> Compromissos
                  </h4>
                  <button
                    onClick={() => {
                      const targetDate = selectedDayModal.date;
                      setSelectedDayModal({ isOpen: false, date: null });
                      abrirModalNovoEvento(targetDate);
                    }}
                    className="text-[11px] font-bold text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} /> Agendar neste dia
                  </button>
                </div>
                
                {sortEventsByTime(agendaItems?.filter(i => i.date === format(selectedDayModal.date, 'yyyy-MM-dd'))).length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhum evento agendado.</p>
                ) : (
                  <div className="space-y-2.5">
                    {sortEventsByTime(agendaItems?.filter(i => i.date === format(selectedDayModal.date, 'yyyy-MM-dd'))).map(evento => {
                      const style = getCategoryStyle(evento.category);
                      const confirmKey = `ev-${evento.id}`;
                      const isConfirming = confirmDeleteId === confirmKey;

                      return (
                        <div key={evento.id} className={`border p-4 rounded-2xl flex flex-col gap-2 transition-colors ${style.card}`}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="overflow-hidden">
                              <span className="text-sm sm:text-base font-bold text-slate-100 block truncate">{evento.title}</span>
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded-md mt-1 inline-block">
                                {style.label}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              {evento.time && (
                                <span className="text-xs font-bold font-mono text-cyan-300 bg-black/40 px-2.5 py-1 rounded-lg mr-1">
                                  <Clock size={12} className="inline mr-1 pb-0.5" />{evento.time.substring(0,5)}
                                </span>
                              )}
                              <button 
                                onClick={() => handleEditClick(evento)} 
                                className="p-2 text-slate-300 hover:text-cyan-300 hover:bg-white/10 rounded-xl transition-colors"
                                title="Editar Evento"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                onClick={() => triggerSafeDelete(confirmKey, () => deleteAgendaItem && deleteAgendaItem(evento.id))} 
                                className={`p-2 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold ${
                                  isConfirming ? 'bg-rose-500 text-white px-2.5 animate-pulse' : 'text-slate-300 hover:text-rose-400 hover:bg-rose-500/20'
                                }`}
                                title="Excluir Evento"
                              >
                                <Trash2 size={15} />
                                {isConfirming && <span>Confirmar?</span>}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção 2: Tarefas do Dia (Com Edição e Exclusão Direta no Modal) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
                  <CheckSquare size={14} /> Tarefas do Dia
                </h4>
                {(inboxTasks || []).filter(t => t.date === format(selectedDayModal.date, 'yyyy-MM-dd')).length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhuma tarefa vinculada a esta data.</p>
                ) : (
                  <div className="space-y-2">
                    {(inboxTasks || []).filter(t => t.date === format(selectedDayModal.date, 'yyyy-MM-dd')).map(task => {
                      const isEditingModalTask = editingInboxId === task.id;
                      const confirmModalTaskKey = `modal-inbox-${task.id}`;
                      const isConfirmingModalTask = confirmDeleteId === confirmModalTaskKey;

                      return (
                        <div key={task.id} className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                          {isEditingModalTask ? (
                            <div className="flex items-center gap-2 w-full">
                              <input
                                autoFocus
                                type="text"
                                value={editInboxTitle}
                                onChange={(e) => setEditInboxTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditInbox(task.id);
                                  if (e.key === 'Escape') setEditingInboxId(null);
                                }}
                                className="flex-1 bg-black/60 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditInbox(task.id)}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInboxId(null)}
                                className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-xl"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => toggleInboxTask(task.id, task.completed)}
                                  className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 cursor-pointer shrink-0"
                                />
                                <span className={`text-sm font-medium truncate ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                  {task.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditInbox(task)}
                                  className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/10 transition-colors"
                                  title="Editar Tarefa"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerSafeDelete(confirmModalTaskKey, () => deleteInboxTask(task.id))}
                                  className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold ${
                                    isConfirmingModalTask ? 'bg-rose-500 text-white px-2' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                  }`}
                                  title="Excluir Tarefa"
                                >
                                  <Trash2 size={14} />
                                  {isConfirmingModalTask && <span>Apagar?</span>}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção 3: Transações Financeiras */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                  <Target size={14} /> Caixa do Dia
                </h4>
                
                {(transactions || []).filter(t => t.date === format(selectedDayModal.date, 'yyyy-MM-dd')).length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhuma movimentação financeira.</p>
                ) : (
                  <div className="space-y-2.5">
                    {(transactions || []).filter(t => t.date === format(selectedDayModal.date, 'yyyy-MM-dd')).map(transacao => {
                      const isDespesa = transacao.type === 'despesa';
                      const isPendente = (transacao.status || 'pago') === 'pendente';
                      return (
                        <div key={transacao.id} className={`p-4 rounded-2xl border flex justify-between items-center gap-3 ${isDespesa ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                          <div className="overflow-hidden">
                            <span className="text-sm font-bold block truncate">{transacao.description.split(' [')[0]}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold uppercase opacity-70 tracking-wider">{transacao.category}</span>
                              {isPendente && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-sm sm:text-base">
                              {isDespesa ? '-' : '+'} R$ {Number(transacao.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {isPendente && toggleTransactionStatus && (
                              <button
                                onClick={() => toggleTransactionStatus(transacao.id)}
                                title="Dar Baixa Rápida"
                                className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/30 transition-colors"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex justify-between gap-3">
              <button 
                onClick={() => {
                  setCurrentDate(selectedDayModal.date);
                  setActiveTab('inbox');
                  setSelectedDayModal({ isOpen: false, date: null });
                }}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs sm:text-sm font-bold rounded-xl transition-colors"
              >
                Ir para o Inbox do Dia
              </button>
              <button 
                onClick={() => {
                  setCurrentDate(selectedDayModal.date);
                  setCalendarMode('day');
                  setSelectedDayModal({ isOpen: false, date: null });
                }}
                className="flex-1 px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs sm:text-sm font-bold rounded-xl transition-colors"
              >
                Abrir Visão Diária
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DE CRIAR / EDITAR EVENTOS ================= */}
      {isModalOpen && (
        <form 
          onSubmit={handleAddSubmit}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] sm:p-4"
        >
          <div className="bg-[#1e2330] w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 border border-white/10 max-h-[90vh]">
            
            <div className="flex justify-between items-center px-4 py-3.5 border-b border-white/5 bg-[#171b26] sm:rounded-t-3xl rounded-t-3xl shrink-0">
              <button type="button" onClick={fecharModalFormulario} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                <X size={22} />
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {editingId ? 'Editar Compromisso' : 'Novo Compromisso'}
              </span>
              <button 
                type="submit"
                disabled={agendaLoading || isSubmitting || !newItem.title.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95"
              >
                {agendaLoading || isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 pb-10 custom-scrollbar">
              
              <div>
                <input 
                  autoFocus
                  required 
                  type="text" 
                  value={newItem.title} 
                  onChange={(e) => setNewItem({...newItem, title: e.target.value})} 
                  className="w-full bg-transparent border-b border-white/10 focus:border-cyan-500 text-xl sm:text-2xl font-bold text-white placeholder:text-slate-500 pb-2.5 outline-none transition-colors" 
                  placeholder="Adicionar título..." 
                />
              </div>

              <div className="flex items-start gap-4">
                <Clock className="text-cyan-400 mt-2.5 shrink-0" size={22} />
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Data</label>
                    <input 
                      required 
                      type="date" 
                      value={newItem.date} 
                      onChange={(e) => setNewItem({...newItem, date: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] transition-all cursor-pointer" 
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Horário (Opcional)</label>
                    <input 
                      type="time" 
                      value={newItem.time} 
                      onChange={(e) => setNewItem({...newItem, time: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] transition-all cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              {!editingId && (
                <div className="flex items-start gap-4">
                  <RefreshCw className="text-cyan-400 mt-1 shrink-0" size={22} />
                  <div className="flex-1 flex flex-col gap-3">
                    <label className="flex items-center gap-2.5 text-sm font-medium text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer"
                      />
                      Repetir este compromisso
                    </label>

                    {isRecurring && (
                      <div className="flex flex-col sm:flex-row gap-3 p-3.5 bg-black/20 rounded-xl border border-white/5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex-1">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Frequência</span>
                          <select
                            value={recurrenceType}
                            onChange={(e) => setRecurrenceType(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                          >
                            <option value="daily" className="bg-slate-900">Diariamente</option>
                            <option value="weekly" className="bg-slate-900">Semanalmente</option>
                            <option value="monthly" className="bg-slate-900">Mensalmente</option>
                          </select>
                        </div>

                        <div className="flex-1">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Até quando?</span>
                          <input
                            required={isRecurring}
                            type="date"
                            min={newItem.date}
                            value={recurrenceEndDate}
                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <Tag className="text-cyan-400 shrink-0" size={22} />
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Categoria</label>
                  <select 
                    value={newItem.category} 
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})} 
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer transition-all"
                  >
                    {Object.entries(EVENT_CATEGORIES).map(([key, cfg]) => (
                      <option key={key} value={key} className="bg-slate-900">{cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
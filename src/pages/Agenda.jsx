import React, { useState, useEffect, useMemo } from 'react';
import { useAgendaStore } from '../store/useAgendaStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useInboxStore } from '../store/useInboxStore';
import { 
  Calendar as CalendarIcon, CheckSquare, Target, Plus, 
  ChevronLeft, ChevronRight, LayoutGrid, X, Trash2, Tag, Clock, Eye, Edit2, ListTodo, Layers
} from 'lucide-react'; 
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Agenda() {
  const { agendaItems, addAgendaItem, updateAgendaItem, deleteAgendaItem, fetchAgendaItems, isLoading: agendaLoading } = useAgendaStore();
  const { transactions, fetchTransactions } = useFinanceStore();
  
  const { tasks: kanbanTasks, moveTask, fetchKanbanTasks, deleteTask: deleteKanbanTask } = useKanbanStore();
  const { inboxTasks, addInboxTask, toggleInboxTask, deleteInboxTask, fetchInboxTasks } = useInboxStore();
  
  const [newInboxTitle, setNewInboxTitle] = useState('');
  
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [calendarMode, setCalendarMode] = useState('month'); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  // ESTADO DO NOVO EVENTO (MANTIDO O PADRÃO ORIGINAL DO SEU BANCO DE DADOS)
  const [newItem, setNewItem] = useState({ title: '', date: '', time: '', category: 'evento' });
  const [editingId, setEditingId] = useState(null);

  const [selectedDayModal, setSelectedDayModal] = useState({ isOpen: false, date: null });
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextPeriod = () => {
    if (activeTab === 'inbox' || calendarMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (calendarMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const prevPeriod = () => {
    if (activeTab === 'inbox' || calendarMode === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else if (calendarMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

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

  const calendarDays = [];
  let day = startDate;
  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const renderHeaderTitle = () => {
    if (calendarMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    if (calendarMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      if (isSameMonth(weekStart, weekEnd)) return `${format(weekStart, 'd')} a ${format(weekEnd, 'd')} de ${format(weekStart, 'MMMM yyyy', { locale: ptBR })}`;
      return `${format(weekStart, 'd')} de ${format(weekStart, 'MMM', { locale: ptBR })} a ${format(weekEnd, 'd')} de ${format(weekEnd, 'MMM yyyy', { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  useEffect(() => {
    fetchAgendaItems();
    if (fetchTransactions) fetchTransactions();
    fetchKanbanTasks();
    fetchInboxTasks();
  }, [fetchAgendaItems, fetchTransactions, fetchKanbanTasks, fetchInboxTasks]);

  const currentSelectedDateString = format(currentDate, 'yyyy-MM-dd');
  
  const tarefasDoDiaSelecionado = useMemo(() => {
    return inboxTasks.filter(t => !t.date || t.date === currentSelectedDateString);
  }, [inboxTasks, currentSelectedDateString]);

  const handleAddInboxTaskWithDate = (e) => {
    e.preventDefault();
    if (!newInboxTitle.trim()) return;
    addInboxTask(newInboxTitle, currentSelectedDateString); 
    setNewInboxTitle('');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (editingId && updateAgendaItem) {
      await updateAgendaItem(editingId, newItem);
    } else {
      await addAgendaItem(newItem);
    }
    fecharModalFormulario();
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

  const handleDeleteClick = async (id) => {
    if (window.confirm('Senhor, tem certeza que deseja excluir este compromisso?')) {
      if (deleteAgendaItem) await deleteAgendaItem(id);
    }
  };

  const fecharModalFormulario = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setNewItem({ title: '', date: '', time: '', category: 'evento' });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">
      
      {/* CABEÇALHO PADRÃO GLASSMORPHISM */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-2xl border border-cyan-500/20 backdrop-blur-md shadow-lg shadow-cyan-500/10">
            <Target className="text-cyan-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Produtividade</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Agenda, Tarefas e Projetos</p>
          </div>
        </div>

        {/* Menu de Abas Segmentado (Scrollable no Mobile) */}
        <div className="flex items-center bg-black/40 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-inner overflow-x-auto custom-scrollbar w-full sm:w-auto shrink-0 snap-x">
          <button onClick={() => setActiveTab('calendar')} className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'calendar' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            <CalendarIcon size={16} /> <span className="sm:inline">Calendário</span>
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'inbox' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            <ListTodo size={16} /> <span className="sm:inline">Inbox Diário</span>
          </button>
          <button onClick={() => setActiveTab('projects')} className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'projects' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            <Layers size={16} /> <span className="sm:inline">Kanban</span>
          </button>
        </div>
      </div>

      <main className="w-full max-w-7xl flex-1 flex flex-col relative">
        
        {/* BOTÃO FLUTUANTE (FAB) PARA MOBILE */}
        {activeTab === 'calendar' && (
          <button 
            onClick={() => setIsModalOpen(true)}
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
                  <select 
                    value={calendarMode}
                    onChange={(e) => setCalendarMode(e.target.value)}
                    className="w-full sm:w-auto bg-black/40 text-xs sm:text-sm font-bold text-slate-200 border border-white/10 rounded-xl py-2.5 px-3 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                  >
                    <option value="month" className="bg-slate-900">Visão Mensal</option>
                    <option value="week" className="bg-slate-900">Visão Semanal</option>
                    <option value="day" className="bg-slate-900">Visão Diária</option>
                  </select>
                  
                  {/* Botão de Novo Evento OCULTO no mobile (agora usa o FAB) */}
                  <button onClick={() => setIsModalOpen(true)} className="hidden sm:flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shrink-0">
                    <Plus size={16} /> Novo Evento
                  </button>
                </>
              ) : (
                <span className="text-xs font-bold text-slate-400 bg-black/40 px-4 py-2 rounded-xl border border-white/5 w-full sm:w-auto text-center flex items-center justify-center gap-2">
                  <ListTodo size={14} className="text-cyan-500" />
                  {tarefasDoDiaSelecionado.filter(t => !t.completed).length} pendentes
                </span>
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 1: CALENDÁRIO ================= */}
        {activeTab === 'calendar' && (
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-b-2xl sm:rounded-b-3xl border-t-0 backdrop-blur-xl shadow-2xl flex flex-col flex-1 overflow-hidden min-h-[500px] sm:min-h-[650px]">
            <div className={`flex-1 grid bg-black/20 overflow-y-auto ${calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
              
              {calendarMode !== 'day' && ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                <div key={dia} className="bg-black/40 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-white/10">
                  {dia}
                </div>
              ))}
              
              {calendarDays.map((diaAtual, index) => {
                const isCurrentMonth = isSameMonth(diaAtual, currentDate);
                const isToday = isSameDay(diaAtual, new Date());
                const dataString = format(diaAtual, 'yyyy-MM-dd');
                
                const eventosDoDia = agendaItems?.filter(item => item.date === dataString) || [];
                const transacoesDoDia = transactions?.filter(t => t.date === dataString) || [];
                const tarefasDoDia = inboxTasks?.filter(t => t.date === dataString && !t.completed) || [];
                
                const totalItens = eventosDoDia.length + transacoesDoDia.length + tarefasDoDia.length;

                return (
                  <div 
                    key={index} 
                    onClick={() => {
                      if (calendarMode === 'month') {
                        setSelectedDayModal({ isOpen: true, date: diaAtual });
                      }
                    }}
                    className={`p-1 sm:p-3 border-b border-r border-white/5 hover:bg-white/5 transition-colors group relative flex flex-col min-w-0
                      ${calendarMode === 'month' ? 'cursor-pointer min-h-[70px] sm:min-h-[120px]' : 'min-h-[400px]'} 
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
                        <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-80 mt-1 mr-1"></span>
                      )}
                    </div>
                    
                    <div className={`flex flex-col gap-1 overflow-hidden flex-1 ${calendarMode === 'month' ? 'hidden sm:flex' : 'flex'}`}>
                      {transacoesDoDia.slice(0, calendarMode === 'month' ? 2 : transacoesDoDia.length).map(transacao => {
                        const isDespesa = transacao.type === 'despesa';
                        return (
                          <div key={`fin-${transacao.id}`} className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-bold rounded flex justify-between gap-1 items-center overflow-hidden
                            ${isDespesa ? 'bg-rose-500/15 border-l-2 border-rose-500 text-rose-300' : 'bg-emerald-500/15 border-l-2 border-emerald-500 text-emerald-300'}`}
                            title={transacao.description}
                          >
                            <span className="truncate flex-1">{transacao.description}</span>
                            <span className="hidden xl:inline font-mono">R${Number(transacao.amount).toFixed(0)}</span>
                          </div>
                        );
                      })}

                      {eventosDoDia.slice(0, calendarMode === 'month' ? 2 : eventosDoDia.length).map(evento => (
                        <div key={`ev-${evento.id}`} className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-cyan-500/15 border-l-2 border-cyan-500 text-cyan-200 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1" title={evento.title}>
                          {evento.time && <span className="opacity-70 font-mono tracking-wider shrink-0 hidden sm:inline">{evento.time.substring(0,5)}</span>}
                          <span className="truncate">{evento.title}</span>
                        </div>
                      ))}
                      
                      {(calendarMode === 'week' || calendarMode === 'day') && tarefasDoDia.length > 0 && (
                        <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-indigo-500/15 border-l-2 border-indigo-500 text-indigo-300 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1 mt-1">
                          <CheckSquare size={10} className="shrink-0" />
                          <span className="truncate">{tarefasDoDia.length} tarefas pendentes</span>
                        </div>
                      )}
                    </div>

                    {calendarMode === 'month' && totalItens > 0 && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg hidden sm:flex">
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

        {/* ================= ABA 2: INBOX DIÁRIO (VINCULADO À DATA) ================= */}
        {activeTab === 'inbox' && (
          <div className="w-full bg-gradient-to-b from-white/10 to-white/5 border border-white/10 border-t-0 p-5 sm:p-8 rounded-b-2xl sm:rounded-b-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[500px] h-[700px]">
            <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
              <form onSubmit={handleAddInboxTaskWithDate} className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8 mt-2">
                <input 
                  type="text" 
                  value={newInboxTitle} 
                  onChange={(e) => setNewInboxTitle(e.target.value)}
                  placeholder="Ex: Ligar para o orientador..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3.5 sm:p-4 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 shadow-inner"
                />
                <button type="submit" disabled={!newInboxTitle.trim()} className="px-6 py-3.5 sm:py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-cyan-500/25 transition-all font-bold text-sm flex items-center justify-center gap-2">
                  <Plus size={18} /> <span className="sm:hidden lg:inline">Adicionar à Lista</span>
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {tarefasDoDiaSelecionado.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 mt-8">
                    <div className="p-5 bg-black/20 rounded-full border border-white/5">
                      <CheckSquare size={40} className="opacity-40 text-cyan-500/50" />
                    </div>
                    <p className="text-sm font-medium">Nenhuma tarefa programada para este dia.</p>
                  </div>
                ) : (
                  tarefasDoDiaSelecionado.map(task => (
                    <div key={task.id} className={`group flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${task.completed ? 'bg-black/20 border-white/5 opacity-60' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 shadow-lg'}`}>
                      <input 
                        type="checkbox" 
                        checked={task.completed} 
                        onChange={() => toggleInboxTask(task.id, task.completed)}
                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-slate-900 cursor-pointer shrink-0 transition-colors"
                      />
                      <span className={`flex-1 text-sm sm:text-base font-medium truncate ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {task.title}
                      </span>
                      <button onClick={() => deleteInboxTask(task.id)} className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 3: KANBAN ================= */}
        {activeTab === 'projects' && (
          <div className="h-[700px] flex gap-5 sm:gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory mt-6">
            {[
              { id: 'backlog', label: 'Backlog', color: 'bg-slate-400', border: 'border-slate-400/30' },
              { id: 'in-progress', label: 'Em Andamento', color: 'bg-cyan-400', border: 'border-cyan-400/30' },
              { id: 'done', label: 'Concluído', color: 'bg-emerald-400', border: 'border-emerald-400/30' }
            ].map((column) => (
              <div 
                key={column.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const taskId = e.dataTransfer.getData('taskId');
                  moveTask(taskId, column.id);
                }}
                className="min-w-[85vw] sm:min-w-[340px] w-[85vw] sm:w-[340px] bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-3xl p-5 flex flex-col max-h-full backdrop-blur-xl snap-center"
              >
                <div className={`flex justify-between items-center mb-6 pb-4 border-b ${column.border}`}>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${column.color} shadow-[0_0_10px_currentColor]`}></div> 
                    {column.label}
                  </h3>
                  <span className="bg-black/40 border border-white/10 text-slate-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                    {kanbanTasks.filter(t => t.status === column.id).length}
                  </span>
                </div>
                
                <div className="flex-1 space-y-3.5 overflow-y-auto custom-scrollbar pr-2">
                  {kanbanTasks
                    .filter(task => task.status === column.id)
                    .map(task => (
                      <div 
                        key={task.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                        className="bg-black/40 border border-white/10 p-4 rounded-2xl shadow-lg cursor-grab active:cursor-grabbing hover:border-white/20 hover:bg-white/5 transition-all group relative"
                      >
                        <h4 className="text-slate-200 text-sm font-bold pr-8 leading-relaxed">{task.title}</h4>
                        <button 
                          onClick={() => { if(window.confirm('Senhor, deseja mesmo excluir este cartão?')) deleteKanbanTask(task.id) }} 
                          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/10 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                </div>

                <button 
                  onClick={() => {
                    const title = window.prompt(`Nova tarefa em ${column.label}:`);
                    if (title) useKanbanStore.getState().addTask(title, column.id);
                  }}
                  className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-white py-3.5 bg-black/20 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl w-full transition-all"
                >
                  <Plus size={16} /> Adicionar Cartão
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ================= MODAL DE DETALHES DO DIA SELECIONADO ================= */}
      {selectedDayModal.isOpen && selectedDayModal.date && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 p-5 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white capitalize">
                  {format(selectedDayModal.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Resumo diário de compromissos e finanças</p>
              </div>
              <button onClick={() => setSelectedDayModal({ isOpen: false, date: null })} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
              
              {/* Seção de Eventos */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2">
                  <CalendarIcon size={14} /> Compromissos
                </h4>
                
                {agendaItems?.filter(i => i.date === format(selectedDayModal.date, 'yyyy-MM-dd')).length === 0 ? (
                  <p className="text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhum evento agendado.</p>
                ) : (
                  <div className="space-y-2.5">
                    {agendaItems?.filter(i => i.date === format(selectedDayModal.date, 'yyyy-MM-dd')).map(evento => (
                      <div key={evento.id} className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-2xl flex flex-col gap-2 group hover:bg-cyan-500/15 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="overflow-hidden">
                            <span className="text-sm sm:text-base font-bold text-slate-100 block truncate">{evento.title}</span>
                            {evento.category && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-md mt-1 inline-block">{evento.category}</span>}
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {evento.time && (
                              <span className="text-xs font-bold font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg mr-2">
                                <Clock size={12} className="inline mr-1 pb-0.5" />{evento.time.substring(0,5)}
                              </span>
                            )}
                            <button 
                              onClick={() => handleEditClick(evento)} 
                              className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded-xl transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                              title="Editar Evento"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(evento.id)} 
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-xl transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                              title="Excluir Evento"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção de Transações */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                  <Target size={14} /> Caixa do Dia
                </h4>
                
                {transactions?.filter(t => t.date === format(selectedDayModal.date, 'yyyy-MM-dd')).length === 0 ? (
                  <p className="text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhuma transação financeira.</p>
                ) : (
                  <div className="space-y-2.5">
                    {transactions?.filter(t => t.date === format(selectedDayModal.date, 'yyyy-MM-dd')).map(transacao => {
                      const isDespesa = transacao.type === 'despesa';
                      return (
                        <div key={transacao.id} className={`p-4 rounded-2xl border flex justify-between items-center gap-3 ${isDespesa ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                          <div className="overflow-hidden">
                            <span className="text-sm font-bold block truncate">{transacao.description}</span>
                            <span className="text-[10px] font-bold uppercase opacity-70 tracking-wider">{transacao.category}</span>
                          </div>
                          <span className="font-mono font-bold text-sm sm:text-base shrink-0">
                            {isDespesa ? '-' : '+'} R$ {Number(transacao.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
              <button 
                onClick={() => {
                  setCurrentDate(selectedDayModal.date);
                  setCalendarMode('day');
                  setSelectedDayModal({ isOpen: false, date: null });
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Abrir Visão Expandida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL "GOOGLE CALENDAR STYLE" PARA EVENTOS ================= */}
      {isModalOpen && (
        <form 
          onSubmit={handleAddSubmit}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] sm:p-4"
        >
          {/* O painel sobe de baixo no mobile (bottom sheet) e centraliza no desktop */}
          <div className="bg-[#1e2330] w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 border border-white/5 max-h-[90vh]">
            
            {/* Cabeçalho Limpo (Apenas X e Salvar) */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 bg-[#171b26] sm:rounded-t-3xl rounded-t-3xl shrink-0">
              <button type="button" onClick={fecharModalFormulario} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                <X size={22} />
              </button>
              <button 
                type="submit"
                disabled={agendaLoading || !newItem.title.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-6 py-2 rounded-full text-sm font-bold transition-all shadow-md active:scale-95"
              >
                {agendaLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            
            {/* Corpo do Formulário */}
            <div className="p-6 overflow-y-auto space-y-7 pb-10 custom-scrollbar">
              
              {/* Título Gigante (Sem label) */}
              <div className="pl-10">
                <input 
                  autoFocus
                  required 
                  type="text" 
                  value={newItem.title} 
                  onChange={(e) => setNewItem({...newItem, title: e.target.value})} 
                  className="w-full bg-transparent border-b border-transparent hover:border-white/10 focus:border-cyan-500 text-2xl text-white placeholder:text-slate-500 pb-2 outline-none transition-colors" 
                  placeholder="Adicionar título" 
                />
              </div>

              {/* Data e Hora agrupados com ícone único */}
              <div className="flex items-start gap-4">
                <Clock className="text-slate-400 mt-2 shrink-0" size={24} />
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input 
                      required 
                      type="date" 
                      value={newItem.date} 
                      onChange={(e) => setNewItem({...newItem, date: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] transition-all cursor-pointer" 
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <input 
                      type="time" 
                      value={newItem.time} 
                      onChange={(e) => setNewItem({...newItem, time: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] transition-all cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              {/* Categoria com ícone único */}
              <div className="flex items-center gap-4">
                <Tag className="text-slate-400 shrink-0" size={24} />
                <div className="flex-1">
                  <select 
                    value={newItem.category} 
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})} 
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer transition-all appearance-none"
                  >
                    <option value="evento" className="bg-slate-900">Evento / Compromisso</option>
                    <option value="tarefa" className="bg-slate-900">Tarefa</option>
                    <option value="aula" className="bg-slate-900">Aula / Estudo</option>
                    <option value="reuniao" className="bg-slate-900">Trabalho / Reunião</option>
                    <option value="saude" className="bg-slate-900">Saúde / Médico</option>
                    <option value="financeiro" className="bg-slate-900">Financeiro / Pagamento</option>
                    <option value="lazer" className="bg-slate-900">Lazer / Social</option>
                    <option value="lembrete" className="bg-slate-900">Lembrete</option>
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
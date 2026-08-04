import React, { useState, useEffect } from 'react';
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
  const [newItem, setNewItem] = useState({ title: '', date: '', time: '', category: 'evento' });
  const [editingId, setEditingId] = useState(null);

  const [selectedDayModal, setSelectedDayModal] = useState({ isOpen: false, date: null });
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextPeriod = () => {
    if (calendarMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (calendarMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prevPeriod = () => {
    if (calendarMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (calendarMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
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

        {/* Menu de Abas Segmentado (Estilo iOS) */}
        <div className="flex items-center bg-black/40 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-inner overflow-x-auto custom-scrollbar w-full sm:w-auto shrink-0">
          <button onClick={() => setActiveTab('calendar')} className={`flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'calendar' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            <CalendarIcon size={16} /> <span className="sm:inline">Calendário</span>
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'inbox' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            <ListTodo size={16} /> <span className="sm:inline">Inbox Diário</span>
          </button>
          <button onClick={() => setActiveTab('projects')} className={`flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${activeTab === 'projects' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
            <Layers size={16} /> <span className="sm:inline">Kanban</span>
          </button>
        </div>
      </div>

      <main className="w-full max-w-7xl flex-1 flex flex-col">
        
        {/* ================= ABA 1: CALENDÁRIO ================= */}
        {activeTab === 'calendar' && (
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col flex-1 overflow-hidden min-h-[600px] sm:min-h-[750px]">
            
            <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 bg-black/20">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 w-full md:w-auto">
                <h2 className="text-lg sm:text-xl font-bold text-white capitalize text-center sm:text-left min-w-[200px]">
                  {renderHeaderTitle()}
                </h2>
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                  <button onClick={prevPeriod} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"><ChevronLeft size={18} /></button>
                  <button onClick={goToToday} className="px-4 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Hoje</button>
                  <button onClick={nextPeriod} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-between sm:justify-end">
                <select 
                  value={calendarMode}
                  onChange={(e) => setCalendarMode(e.target.value)}
                  className="bg-black/40 text-xs sm:text-sm font-bold text-slate-200 border border-white/10 rounded-xl py-2 px-3 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="month" className="bg-slate-900">Mensal</option>
                  <option value="week" className="bg-slate-900">Semanal</option>
                  <option value="day" className="bg-slate-900">Diário</option>
                </select>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-cyan-500/25 shrink-0">
                  <Plus size={16} /> <span className="hidden sm:inline">Novo Evento</span><span className="sm:hidden">Novo</span>
                </button>
              </div>
            </div>

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
                const totalItens = eventosDoDia.length + transacoesDoDia.length;

                return (
                  <div 
                    key={index} 
                    onClick={() => {
                      if (calendarMode === 'month') {
                        setSelectedDayModal({ isOpen: true, date: diaAtual });
                      }
                    }}
                    className={`p-1.5 sm:p-3 border-b border-r border-white/5 hover:bg-white/5 transition-colors group relative flex flex-col min-w-0
                      ${calendarMode === 'month' ? 'cursor-pointer min-h-[80px] sm:min-h-[120px]' : 'min-h-[400px]'} 
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
                      {calendarMode === 'month' && totalItens > 1 && (
                        <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1 overflow-hidden flex-1">
                      {transacoesDoDia.slice(0, calendarMode === 'month' ? (window.innerWidth < 640 ? 1 : 2) : transacoesDoDia.length).map(transacao => {
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

                      {eventosDoDia.slice(0, calendarMode === 'month' ? (window.innerWidth < 640 ? 1 : 2) : eventosDoDia.length).map(evento => (
                        <div key={`ev-${evento.id}`} className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-cyan-500/15 border-l-2 border-cyan-500 text-cyan-200 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1" title={evento.title}>
                          {evento.time && <span className="opacity-70 font-mono tracking-wider shrink-0 hidden sm:inline">{evento.time.substring(0,5)}</span>}
                          <span className="truncate">{evento.title}</span>
                        </div>
                      ))}
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

        {/* ================= ABA 2: INBOX DIÁRIO ================= */}
        {activeTab === 'inbox' && (
          <div className="max-w-4xl mx-auto w-full bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col h-[700px]">
            <div className="flex items-center justify-between mb-6 sm:mb-8 border-b border-white/10 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare size={20} className="text-cyan-400" /> Tarefas Rápidas
              </h2>
              <span className="text-xs font-bold text-slate-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                {inboxTasks.filter(t => !t.completed).length} pendentes
              </span>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); addInboxTask(newInboxTitle); setNewInboxTitle(''); }} className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
              <input 
                type="text" 
                value={newInboxTitle} 
                onChange={(e) => setNewInboxTitle(e.target.value)}
                placeholder="Ex: Pagar boleto da internet..."
                // text-base bloqueia o zoom no iOS
                className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3.5 sm:p-4 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
              />
              <button type="submit" disabled={!newInboxTitle.trim()} className="px-6 py-3.5 sm:py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-cyan-500/25 transition-all font-bold text-sm flex items-center justify-center gap-2">
                <Plus size={18} /> <span className="sm:hidden lg:inline">Adicionar</span>
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
              {inboxTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                  <div className="p-4 bg-black/20 rounded-full border border-white/5">
                    <CheckSquare size={32} className="opacity-40" />
                  </div>
                  <p className="text-sm font-medium">Tudo limpo! Nenhuma tarefa pendente.</p>
                </div>
              ) : (
                inboxTasks.map(task => (
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
        )}

        {/* ================= ABA 3: KANBAN ================= */}
        {activeTab === 'projects' && (
          <div className="h-[700px] flex gap-5 sm:gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
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

      {/* ================= MODAL DE FORMULÁRIO (CRIAR E EDITAR) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {editingId ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <button onClick={fecharModalFormulario} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Título</label>
                {/* text-base previne o zoom no iOS */}
                <input required type="text" value={newItem.title} onChange={(e) => setNewItem({...newItem, title: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 placeholder:text-slate-600 transition-all" placeholder="Ex: Reunião de Projeto" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Data</label>
                  <input required type="date" value={newItem.date} onChange={(e) => setNewItem({...newItem, date: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [color-scheme:dark] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Hora</label>
                  <input type="time" value={newItem.time} onChange={(e) => setNewItem({...newItem, time: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [color-scheme:dark] transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Categoria</label>
                <select value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer transition-all">
                  <option value="evento" className="bg-slate-900">Evento / Compromisso</option>
                  <option value="tarefa" className="bg-slate-900">Tarefa</option>
                  <option value="aula" className="bg-slate-900">Aula</option>
                </select>
              </div>
              <button type="submit" disabled={agendaLoading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm p-4 rounded-xl mt-6 shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2">
                {agendaLoading ? (editingId ? 'Atualizando...' : 'Salvando...') : (editingId ? <><Edit2 size={18}/> Atualizar Evento</> : <><Plus size={18}/> Salvar no Calendário</>)}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
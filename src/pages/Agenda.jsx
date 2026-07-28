import React, { useState, useEffect } from 'react';
import { useAgendaStore } from '../store/useAgendaStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useInboxStore } from '../store/useInboxStore';
import { 
  Calendar as CalendarIcon, CheckSquare, Target, Plus, 
  ChevronLeft, ChevronRight, LayoutGrid, X, Trash2, Tag, Clock 
} from 'lucide-react'; 
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Agenda() {
  const { agendaItems, addAgendaItem, fetchAgendaItems, isLoading: agendaLoading } = useAgendaStore();
  const { transactions, fetchTransactions } = useFinanceStore();
  
  const { tasks: kanbanTasks, moveTask, fetchKanbanTasks, deleteTask: deleteKanbanTask } = useKanbanStore();
  const { inboxTasks, addInboxTask, toggleInboxTask, deleteInboxTask, fetchInboxTasks } = useInboxStore();
  
  const [newInboxTitle, setNewInboxTitle] = useState('');
  
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [calendarMode, setCalendarMode] = useState('month'); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', date: '', time: '', category: 'evento' });

  const [currentDate, setCurrentDate] = useState(new Date());

  // Navegação do calendário
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

  // Lógica de dias do calendário
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
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
  };

  useEffect(() => {
    fetchAgendaItems();
    if (fetchTransactions) fetchTransactions();
    fetchKanbanTasks();
    fetchInboxTasks();
  }, [fetchAgendaItems, fetchTransactions, fetchKanbanTasks, fetchInboxTasks]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    await addAgendaItem(newItem);
    setIsModalOpen(false);
    setNewItem({ title: '', date: '', time: '', category: 'evento' });
  };

  return (
    <div className="min-h-screen p-8 font-sans flex flex-col items-center">
      
      {/* CABEÇALHO PADRÃO GLASSMORPHISM (Igual ao Financeiro) */}
      <div className="w-full max-w-6xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
            <Target className="text-cyan-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-wide">Produtividade</h1>
            <p className="text-sm text-slate-400">Agenda, Tarefas e Projetos</p>
          </div>
        </div>

        {/* Menu de Abas (Estilo Filtro do Financeiro) */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-lg overflow-x-auto">
          <button onClick={() => setActiveTab('calendar')} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'calendar' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
            <CalendarIcon size={16} /> <span className="hidden sm:inline">Calendário</span>
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'inbox' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
            <CheckSquare size={16} /> <span className="hidden sm:inline">Inbox Diário</span>
          </button>
          <button onClick={() => setActiveTab('projects')} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'projects' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
            <LayoutGrid size={16} /> <span className="hidden sm:inline">Kanban</span>
          </button>
        </div>
      </div>

      <main className="w-full max-w-6xl flex-1 flex flex-col">
        
        {/* ================= ABA 1: CALENDÁRIO ================= */}
        {activeTab === 'calendar' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-xl flex flex-col flex-1 overflow-hidden min-h-[700px]">
            
            <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-black/20">
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                <h2 className="text-lg font-semibold text-slate-200 capitalize min-w-[180px]">
                  {renderHeaderTitle()}
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={prevPeriod} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors border border-transparent hover:border-white/10"><ChevronLeft size={20} /></button>
                  <button onClick={goToToday} className="px-3 py-1 text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 rounded-md border border-white/10 transition-colors">Hoje</button>
                  <button onClick={nextPeriod} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors border border-transparent hover:border-white/10"><ChevronRight size={20} /></button>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
                <select 
                  value={calendarMode}
                  onChange={(e) => setCalendarMode(e.target.value)}
                  className="bg-black/20 text-sm font-medium text-slate-200 border border-white/10 rounded-lg py-1.5 px-3 focus:outline-none cursor-pointer"
                >
                  <option value="month" className="bg-slate-900">Mensal</option>
                  <option value="week" className="bg-slate-900">Semanal</option>
                  <option value="day" className="bg-slate-900">Diário</option>
                </select>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 bg-cyan-600/90 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-cyan-500/25">
                  <Plus size={16} /> Novo
                </button>
              </div>
            </div>

            <div className={`flex-1 grid bg-black/10 overflow-y-auto ${calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
              
              {calendarMode !== 'day' && ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                <div key={dia} className="bg-black/20 p-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-white/10">
                  {dia}
                </div>
              ))}
              
              {calendarDays.map((diaAtual, index) => {
                const isCurrentMonth = isSameMonth(diaAtual, currentDate);
                const isToday = isSameDay(diaAtual, new Date());
                const dataString = format(diaAtual, 'yyyy-MM-dd');
                
                const eventosDoDia = agendaItems?.filter(item => item.date === dataString) || [];
                const transacoesDoDia = transactions?.filter(t => t.date === dataString) || [];

                return (
                  <div key={index} className={`p-3 border-b border-r border-white/5 hover:bg-white/5 transition-colors group 
                    ${isCurrentMonth || calendarMode !== 'month' ? 'bg-transparent' : 'bg-black/40'}
                    ${calendarMode === 'month' ? 'min-h-[120px]' : 'min-h-[400px]'} 
                  `}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : isCurrentMonth || calendarMode !== 'month' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {format(diaAtual, 'd')}
                      </span>
                      {calendarMode === 'day' && <span className="text-slate-400 text-sm capitalize">{format(diaAtual, 'EEEE', { locale: ptBR })}</span>}
                    </div>
                    
                    <div className="flex flex-col gap-1.5 overflow-y-auto h-full custom-scrollbar pb-6">
                      {/* Transações Financeiras */}
                      {transacoesDoDia.map(transacao => {
                        const isDespesa = transacao.type === 'despesa';
                        return (
                          <div key={`fin-${transacao.id}`} className={`px-2 py-1.5 text-[10px] rounded-lg border flex justify-between gap-1 items-center
                            ${isDespesa ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}
                            title={transacao.description}
                          >
                            <span className="truncate">{transacao.description}</span>
                            <span className="font-mono font-medium">R$ {Number(transacao.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        );
                      })}

                      {/* Eventos da Agenda */}
                      {eventosDoDia.map(evento => (
                        <div key={`ev-${evento.id}`} className="px-2 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] rounded-lg truncate flex flex-col gap-0.5" title={evento.title}>
                          {evento.time && <span className="opacity-70 font-mono tracking-wider"><Clock size={8} className="inline mr-1 mb-0.5"/>{evento.time.substring(0,5)}</span>}
                          <span className="truncate font-medium">{evento.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= ABA 2: INBOX DIÁRIO ================= */}
        {activeTab === 'inbox' && (
          <div className="max-w-3xl mx-auto w-full bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-xl flex flex-col h-[700px]">
            <h2 className="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
              <CheckSquare size={16} className="text-cyan-400" /> Tarefas Rápidas
            </h2>
            
            <form onSubmit={(e) => { e.preventDefault(); addInboxTask(newInboxTitle); setNewInboxTitle(''); }} className="flex gap-3 mb-6">
              <input 
                type="text" 
                value={newInboxTitle} 
                onChange={(e) => setNewInboxTitle(e.target.value)}
                placeholder="Ex: Pagar boleto da internet..."
                className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              <button type="submit" disabled={!newInboxTitle.trim()} className="px-5 py-3 bg-cyan-600/90 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-cyan-500/25 transition-all font-medium text-sm">
                Adicionar
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {inboxTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                  <CheckSquare size={32} className="opacity-20 mb-2" />
                  Tudo limpo! Nenhuma tarefa pendente.
                </div>
              ) : (
                inboxTasks.map(task => (
                  <div key={task.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${task.completed ? 'bg-white/5 border-white/5 opacity-50' : 'bg-black/20 border-white/10 hover:border-white/20'}`}>
                    <input 
                      type="checkbox" 
                      checked={task.completed} 
                      onChange={() => toggleInboxTask(task.id, task.completed)}
                      className="w-4 h-4 rounded border-white/20 bg-black/20 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                      {task.title}
                    </span>
                    <button onClick={() => deleteInboxTask(task.id)} className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 3: KANBAN ================= */}
        {activeTab === 'projects' && (
          <div className="h-[700px] flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
            {[
              { id: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
              { id: 'in-progress', label: 'Em Andamento', color: 'bg-cyan-400' },
              { id: 'done', label: 'Concluído', color: 'bg-emerald-400' }
            ].map((column) => (
              <div 
                key={column.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const taskId = e.dataTransfer.getData('taskId');
                  moveTask(taskId, column.id);
                }}
                className="min-w-[320px] w-[320px] bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col max-h-full backdrop-blur-md"
              >
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${column.color} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}></div> 
                    {column.label}
                  </h3>
                  <span className="bg-black/30 border border-white/10 text-slate-400 text-xs px-2 py-0.5 rounded-md font-mono">
                    {kanbanTasks.filter(t => t.status === column.id).length}
                  </span>
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
                  {kanbanTasks
                    .filter(task => task.status === column.id)
                    .map(task => (
                      <div 
                        key={task.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                        className="bg-black/40 border border-white/10 p-4 rounded-xl shadow-lg cursor-grab active:cursor-grabbing hover:border-cyan-500/30 transition-colors group relative"
                      >
                        <h4 className="text-slate-200 text-sm font-medium pr-6 leading-relaxed">{task.title}</h4>
                        <button 
                          onClick={() => { if(window.confirm('Excluir esta tarefa?')) deleteKanbanTask(task.id) }} 
                          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-500/10 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    const title = window.prompt(`Nova tarefa em ${column.label}:`);
                    if (title) useKanbanStore.getState().addTask(title, column.id);
                  }}
                  className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 py-3 hover:bg-white/10 border border-transparent hover:border-white/10 rounded-xl w-full transition-all"
                >
                  <Plus size={14} /> Adicionar Cartão
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ================= MODAL DE ADICIONAR ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-slate-300">Novo Evento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Título</label>
                <input required type="text" value={newItem.title} onChange={(e) => setNewItem({...newItem, title: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50" placeholder="Ex: Reunião de Projeto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Data</label>
                  <input required type="date" value={newItem.date} onChange={(e) => setNewItem({...newItem, date: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Hora (Opcional)</label>
                  <input type="time" value={newItem.time} onChange={(e) => setNewItem({...newItem, time: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Categoria</label>
                <select value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer">
                  <option value="evento" className="bg-slate-900">Evento / Compromisso</option>
                  <option value="tarefa" className="bg-slate-900">Tarefa</option>
                  <option value="aula" className="bg-slate-900">Aula</option>
                </select>
              </div>
              <button type="submit" disabled={agendaLoading} className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-medium text-sm p-3 rounded-xl mt-4 shadow-lg shadow-cyan-500/25 transition-all">
                {agendaLoading ? 'Salvando...' : 'Salvar no Calendário'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
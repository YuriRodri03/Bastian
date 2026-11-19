// src/pages/Agenda.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAgendaStore } from '../store/useAgendaStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useInboxStore } from '../store/useInboxStore';
import { normalizeDateISO, parseFaturaDescription } from '../utils/financeUtils';
import {
  Calendar as CalendarIcon, CheckSquare, Target, Plus,
  ChevronLeft, ChevronRight, X, Trash2, Tag, Clock, Eye,
  Edit2, ListTodo, Layers, RefreshCw, Search, ArrowRight, ArrowLeft, CheckCircle2, Check, AlertCircle
} from 'lucide-react';
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth,
  isSameDay, parseISO, isAfter, isValid
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/* Constantes e helpers                                                */
/* ------------------------------------------------------------------ */

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

const MAX_RECORRENCIAS = 366;
const ERRO_PADRAO = 'Não foi possível concluir a ação. Tente novamente.';

const getCategoryStyle = (cat) => EVENT_CATEGORIES[cat] || EVENT_CATEGORIES.evento;

const sortEventsByTime = (events = []) =>
  [...events].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

// Busca sem diferenciar acento nem maiúscula ("cartao" acha "Cartão")
const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Agrupa uma lista por data (AAAA-MM-DD): o calendário consulta por dia em vez de filtrar a lista inteira 42 vezes
const porData = (lista, getDate) => {
  const mapa = new Map();
  (lista || []).forEach((item) => {
    const data = getDate(item);
    if (!data) return;
    if (!mapa.has(data)) mapa.set(data, []);
    mapa.get(data).push(item);
  });
  return mapa;
};

const tituloTransacao = (t) => parseFaturaDescription(t.description, t.category).mainTitle;

// Datas de um evento recorrente. Cada data parte da data INICIAL: acumular addMonths a partir do resultado
// anterior fazia 31/01 virar 28/02, 28/03, 28/04... (o dia "encolhia" para sempre).
const gerarDatasRecorrentes = (inicioISO, fimISO, tipo) => {
  const inicio = parseISO(inicioISO);
  const fim = parseISO(fimISO);
  if (!isValid(inicio) || !isValid(fim)) return { datas: [], truncado: false };

  const datas = [];
  for (let i = 0; i <= MAX_RECORRENCIAS; i++) {
    const d = tipo === 'daily' ? addDays(inicio, i) : tipo === 'weekly' ? addWeeks(inicio, i) : addMonths(inicio, i);
    if (isAfter(d, fim)) return { datas, truncado: false };
    if (i === MAX_RECORRENCIAS) return { datas, truncado: true }; // ainda havia datas, mas o limite foi atingido
    datas.push(format(d, 'yyyy-MM-dd'));
  }
  return { datas, truncado: false };
};

/* ------------------------------------------------------------------ */
/* Componentes pequenos                                                */
/* ------------------------------------------------------------------ */

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`snap-center flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-none ${active ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
  >
    {icon} <span>{label}</span>
  </button>
);

// Exclusão em 2 toques. O arredondamento e o tamanho vêm do className de quem usa.
const DeleteButton = ({
  confirming, onClick, title, confirmLabel = 'Confirmar?', iconSize = 16, className = '',
  confirmClassName = 'bg-rose-500 text-white px-3 animate-pulse',
  idleClassName = 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`transition-all flex items-center gap-1 font-bold ${className} ${confirming ? confirmClassName : idleClassName}`}
  >
    <Trash2 size={iconSize} />
    {confirming && <span>{confirmLabel}</span>}
  </button>
);

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Agenda() {
  const {
    agendaItems, addAgendaItem, updateAgendaItem, deleteAgendaItem, toggleItemCompletion,
    fetchAgendaItems, error: agendaError
  } = useAgendaStore();
  const { transactions, fetchTransactions, toggleTransactionStatus, error: financeError } = useFinanceStore();
  const {
    tasks: kanbanTasks, addTask: addKanbanTask, updateTask: updateKanbanTask, moveTask,
    fetchKanbanTasks, deleteTask: deleteKanbanTask, error: kanbanError
  } = useKanbanStore();
  const {
    inboxTasks, addInboxTask, updateInboxTask, toggleInboxTask, deleteInboxTask,
    fetchInboxTasks, error: inboxError
  } = useInboxStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [calendarMode, setCalendarMode] = useState('month');
  const [searchQuery, setSearchQuery] = useState('');

  // INBOX
  const [newInboxTitle, setNewInboxTitle] = useState('');
  const [editingInboxId, setEditingInboxId] = useState(null);
  const [editInboxTitle, setEditInboxTitle] = useState('');
  const [editInboxDate, setEditInboxDate] = useState('');

  // KANBAN
  const [addingKanbanCol, setAddingKanbanCol] = useState(null);
  const [newKanbanTitle, setNewKanbanTitle] = useState('');
  const [editingKanbanId, setEditingKanbanId] = useState(null);
  const [editKanbanTitle, setEditKanbanTitle] = useState('');
  const [dragOverCol, setDragOverCol] = useState(null);

  // EXCLUSÃO EM 2 TOQUES E ERROS DE AÇÕES
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);
  const [actionError, setActionError] = useState('');

  // MODAL DE EVENTO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newItem, setNewItem] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    category: 'evento'
  });

  // RECORRÊNCIA
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // MODAL DE DETALHES DO DIA
  const [selectedDayModal, setSelectedDayModal] = useState({ isOpen: false, date: null });

  useEffect(() => {
    fetchAgendaItems();
    fetchTransactions();
    fetchKanbanTasks();
    fetchInboxTasks();
  }, [fetchAgendaItems, fetchTransactions, fetchKanbanTasks, fetchInboxTasks]);

  useEffect(() => () => clearTimeout(confirmTimerRef.current), []);

  /* ------------------------ Erros e ações seguras ------------------------ */

  // Os stores lançam erro quando a requisição falha. Sem este catch, viravam rejeições não tratadas
  // e o usuário não via nada.
  const runAction = async (fn, mensagem = ERRO_PADRAO) => {
    try {
      setActionError('');
      await fn();
      return true;
    } catch (erro) {
      console.error(erro);
      setActionError(mensagem);
      return false;
    }
  };

  const erroDosStores = agendaError || inboxError || kanbanError || financeError;
  const erroVisivel = actionError || erroDosStores;

  const limparErros = () => {
    setActionError('');
    useAgendaStore.setState({ error: null });
    useInboxStore.setState({ error: null });
    useKanbanStore.setState({ error: null });
    useFinanceStore.setState({ error: null });
  };

  const triggerSafeDelete = (uniqueKey, callback) => {
    clearTimeout(confirmTimerRef.current);
    if (confirmDeleteId === uniqueKey) {
      setConfirmDeleteId(null);
      runAction(callback, 'Não foi possível excluir. Tente novamente.');
      return;
    }
    setConfirmDeleteId(uniqueKey);
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
  };

  /* --------------------- Navegação de datas e grade ---------------------- */

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
    let startDate;
    let endDate;
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

  /* ---------------------- Índices por dia (calendário) --------------------- */

  const query = useMemo(() => norm(searchQuery), [searchQuery]);

  const eventosPorDia = useMemo(() => porData(agendaItems, (i) => i.date), [agendaItems]);
  const tarefasPorDia = useMemo(() => porData(inboxTasks, (t) => t.date), [inboxTasks]);
  // As transações podem estar salvas como AAAA-MM-DD ou DD/MM/AAAA: normaliza como o módulo financeiro faz
  const transacoesPorDia = useMemo(
    () => porData(transactions, (t) => (t.date ? normalizeDateISO(t.date) : null)),
    [transactions]
  );

  const eventosDoDia = (dataISO) => {
    const lista = eventosPorDia.get(dataISO) || [];
    const filtrada = query ? lista.filter((e) => norm(`${e.title} ${e.category || ''}`).includes(query)) : lista;
    return sortEventsByTime(filtrada);
  };

  const transacoesDoDia = (dataISO) => {
    const lista = transacoesPorDia.get(dataISO) || [];
    return query ? lista.filter((t) => norm(tituloTransacao(t)).includes(query)) : lista;
  };

  const tarefasPendentesDoDia = (dataISO) =>
    (tarefasPorDia.get(dataISO) || []).filter((t) => !t.completed && (!query || norm(t.title).includes(query)));

  /* ----------------------------- Inbox diário ------------------------------ */

  const hojeISO = format(new Date(), 'yyyy-MM-dd');
  const currentSelectedDateString = format(currentDate, 'yyyy-MM-dd');
  const visualizandoHoje = currentSelectedDateString === hojeISO;

  // No dia de hoje, as tarefas pendentes de dias anteriores aparecem como "atrasadas"
  // (antes sumiam da tela e só reapareciam navegando até a data original)
  const tarefasDoDiaSelecionado = useMemo(() => {
    const lista = inboxTasks || [];
    const doDia = lista.filter((t) => !t.date || t.date === currentSelectedDateString);
    const atrasadas = visualizandoHoje
      ? lista.filter((t) => t.date && t.date < hojeISO && !t.completed).sort((a, b) => a.date.localeCompare(b.date))
      : [];
    return [...atrasadas, ...doDia].filter((t) => !query || norm(t.title).includes(query));
  }, [inboxTasks, currentSelectedDateString, visualizandoHoje, hojeISO, query]);

  const inboxProgress = useMemo(() => {
    if (tarefasDoDiaSelecionado.length === 0) return 0;
    const concluidas = tarefasDoDiaSelecionado.filter((t) => t.completed).length;
    return Math.round((concluidas / tarefasDoDiaSelecionado.length) * 100);
  }, [tarefasDoDiaSelecionado]);

  const handleAddInboxTaskWithDate = async (e) => {
    e.preventDefault();
    const titulo = newInboxTitle.trim();
    if (!titulo) return;
    const ok = await runAction(() => addInboxTask(titulo, currentSelectedDateString), 'Não foi possível adicionar a tarefa.');
    if (ok) setNewInboxTitle(''); // em caso de falha, o texto digitado fica no campo
  };

  const handleStartEditInbox = (task) => {
    setEditingInboxId(task.id);
    setEditInboxTitle(task.title || '');
    setEditInboxDate(task.date || currentSelectedDateString);
  };

  const handleSaveEditInbox = async (taskId, { mantemData = false } = {}) => {
    if (!editInboxTitle.trim()) return;
    const updates = { title: editInboxTitle.trim() };
    if (!mantemData) updates.date = editInboxDate || currentSelectedDateString;

    const ok = await runAction(() => updateInboxTask(taskId, updates), 'Não foi possível salvar a tarefa.');
    if (ok) setEditingInboxId(null); // se falhar, continua em edição
  };

  /* ------------------------------- Kanban --------------------------------- */

  const handleAddKanbanSubmit = async (e, columnId) => {
    e.preventDefault();
    const titulo = newKanbanTitle.trim();
    if (!titulo) return;
    const ok = await runAction(() => addKanbanTask(titulo, columnId), 'Não foi possível adicionar o cartão.');
    if (ok) {
      setNewKanbanTitle('');
      setAddingKanbanCol(null);
    }
  };

  const handleStartEditKanban = (task) => {
    setEditingKanbanId(task.id);
    setEditKanbanTitle(task.title || '');
  };

  const handleSaveEditKanban = async (taskId) => {
    if (!editKanbanTitle.trim()) return;
    const ok = await runAction(
      () => updateKanbanTask(taskId, { title: editKanbanTitle.trim() }),
      'Não foi possível salvar o cartão.'
    );
    if (ok) setEditingKanbanId(null);
  };

  /* ------------------------ Modal de evento da agenda ----------------------- */

  const fecharModalFormulario = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormError('');
    setNewItem({ title: '', date: format(currentDate, 'yyyy-MM-dd'), time: '', category: 'evento' });
    setIsRecurring(false);
    setRecurrenceEndDate('');
    setRecurrenceType('weekly');
  };

  const abrirModalNovoEvento = (defaultDate = currentDate) => {
    setEditingId(null);
    setFormError('');
    setNewItem({ title: '', date: format(defaultDate, 'yyyy-MM-dd'), time: '', category: 'evento' });
    setIsRecurring(false);
    setRecurrenceEndDate('');
    setIsModalOpen(true);
  };

  const handleEditClick = (evento) => {
    setEditingId(evento.id);
    setFormError('');
    setNewItem({
      title: evento.title,
      date: evento.date,
      time: evento.time ? evento.time.substring(0, 5) : '',
      category: evento.category || 'evento'
    });
    setSelectedDayModal({ isOpen: false, date: null });
    setIsModalOpen(true);
  };

  // Datas que serão criadas (pré-visualização e envio usam a mesma lista)
  const recorrencia = useMemo(() => {
    if (editingId || !isRecurring || !recurrenceEndDate || !newItem.date) return null;
    return gerarDatasRecorrentes(newItem.date, recurrenceEndDate, recurrenceType);
  }, [editingId, isRecurring, recurrenceEndDate, newItem.date, recurrenceType]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const titulo = newItem.title.trim();
    if (!titulo || !newItem.date) return;

    let lote = null;
    if (!editingId && isRecurring) {
      if (!recurrenceEndDate) return setFormError('Informe até quando o compromisso deve se repetir.');
      if (!recorrencia || recorrencia.datas.length === 0) {
        return setFormError('A data final precisa ser igual ou posterior à data inicial.');
      }
      lote = recorrencia.datas.map((data) => ({ ...newItem, title: titulo, date: data }));
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      if (editingId) await updateAgendaItem(editingId, { ...newItem, title: titulo });
      else if (lote) await addAgendaItem(lote);
      else await addAgendaItem({ ...newItem, title: titulo });

      fecharModalFormulario(); // só fecha se salvou (antes fechava mesmo com erro e o texto digitado se perdia)
    } catch (erro) {
      console.error('Erro ao salvar o evento:', erro);
      setFormError('Não foi possível salvar o compromisso. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Esc fecha os modais e a página não rola por baixo deles
  useEffect(() => {
    if (!isModalOpen && !selectedDayModal.isOpen) return undefined;

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (isModalOpen) fecharModalFormulario();
      else setSelectedDayModal({ isOpen: false, date: null });
    };
    document.addEventListener('keydown', onKey);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [isModalOpen, selectedDayModal.isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------ Dados do modal do dia -------------------------- */

  const diaModalISO = selectedDayModal.date ? format(selectedDayModal.date, 'yyyy-MM-dd') : null;
  const eventosModal = diaModalISO ? sortEventsByTime(eventosPorDia.get(diaModalISO) || []) : [];
  const tarefasModal = diaModalISO ? tarefasPorDia.get(diaModalISO) || [] : [];
  const transacoesModal = diaModalISO ? transacoesPorDia.get(diaModalISO) || [] : [];

  const abrirDia = (dia) => setSelectedDayModal({ isOpen: true, date: dia });

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">

      {/* CABEÇALHO */}
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
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              aria-label="Filtrar eventos ou tarefas"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar eventos ou tarefas..."
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-base sm:text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar filtro"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center bg-black/40 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-inner overflow-x-auto custom-scrollbar shrink-0 snap-x">
            <TabButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarIcon size={16} />} label="Calendário" />
            <TabButton active={activeTab === 'inbox'} onClick={() => setActiveTab('inbox')} icon={<ListTodo size={16} />} label="Inbox Diário" />
            <TabButton active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} icon={<Layers size={16} />} label="Kanban" />
          </div>
        </div>
      </div>

      {/* AVISO DE ERRO (ações e carregamento) */}
      {erroVisivel && (
        <div
          role="alert"
          title={erroDosStores || undefined}
          className="w-full max-w-7xl mb-4 flex items-start justify-between gap-3 text-xs sm:text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3"
        >
          <span className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            {actionError || 'Houve uma falha ao sincronizar alguns dados com o servidor.'}
          </span>
          <button type="button" onClick={limparErros} aria-label="Fechar aviso" className="shrink-0 hover:text-rose-200">
            <X size={16} />
          </button>
        </div>
      )}

      <main className="w-full max-w-7xl flex-1 flex flex-col relative">

        {/* BOTÃO FLUTUANTE (MOBILE) */}
        {activeTab === 'calendar' && (
          <button
            type="button"
            onClick={() => abrirModalNovoEvento(currentDate)}
            aria-label="Novo evento"
            className="sm:hidden fixed bottom-24 right-5 z-[90] w-14 h-14 bg-cyan-600 rounded-full shadow-[0_4px_20px_rgba(6,182,212,0.5)] flex items-center justify-center text-white hover:bg-cyan-500 active:scale-95 transition-all"
          >
            <Plus size={28} />
          </button>
        )}

        {/* NAVEGAÇÃO DE DATA */}
        {(activeTab === 'calendar' || activeTab === 'inbox') && (
          <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 bg-black/20 p-4 sm:p-5 border border-white/10 rounded-t-2xl sm:rounded-t-3xl transition-all">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 w-full md:w-auto">
              <h2 className="text-lg sm:text-xl font-bold text-white capitalize text-center sm:text-left min-w-[200px] flex items-center justify-center sm:justify-start gap-2">
                {activeTab === 'inbox' ? <><CheckSquare size={20} className="text-cyan-400" /> Tarefas do Dia</> : renderHeaderTitle()}
              </h2>

              <div className="flex items-center justify-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 w-full sm:w-auto">
                <button type="button" onClick={prevPeriod} aria-label="Período anterior" className="p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"><ChevronLeft size={18} /></button>

                {activeTab === 'inbox' && (
                  <span className="px-3 py-1 text-sm font-bold text-cyan-300 capitalize min-w-[90px] text-center tracking-wide">
                    {format(currentDate, 'dd MMM', { locale: ptBR })}
                  </span>
                )}

                <button type="button" onClick={goToToday} className="px-4 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Hoje</button>
                <button type="button" onClick={nextPeriod} aria-label="Próximo período" className="p-2 hover:bg-white/10 rounded-lg text-slate-300 transition-colors"><ChevronRight size={18} /></button>
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
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setCalendarMode(mode.id)}
                        aria-pressed={calendarMode === mode.id}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${calendarMode === mode.id ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
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
                    {tarefasDoDiaSelecionado.filter((t) => !t.completed).length} pendentes
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

              {calendarMode !== 'day' && ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                <div key={dia} className="bg-black/40 py-2.5 sm:py-3 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-white/10">
                  {dia}
                </div>
              ))}

              {calendarDays.map((diaAtual) => {
                const isCurrentMonth = isSameMonth(diaAtual, currentDate);
                const isToday = isSameDay(diaAtual, new Date());
                const dataString = format(diaAtual, 'yyyy-MM-dd');

                const eventosDia = eventosDoDia(dataString);
                const transacoesDia = transacoesDoDia(dataString);
                const tarefasDia = tarefasPendentesDoDia(dataString);
                const totalItens = eventosDia.length + transacoesDia.length + tarefasDia.length;

                return (
                  <div
                    key={dataString}
                    role="button"
                    tabIndex={0}
                    aria-label={`${format(diaAtual, "d 'de' MMMM", { locale: ptBR })}: ${totalItens} itens`}
                    onClick={() => abrirDia(diaAtual)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        abrirDia(diaAtual);
                      }
                    }}
                    className={`p-1.5 sm:p-3 border-b border-r border-white/5 hover:bg-white/5 transition-colors group relative flex flex-col min-w-0 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60
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
                          {eventosDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
                          {transacoesDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                          {tarefasDia.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                        </div>
                      )}
                    </div>

                    <div className={`flex flex-col gap-1 overflow-hidden flex-1 ${calendarMode === 'month' ? 'hidden sm:flex' : 'flex'}`}>
                      {eventosDia.slice(0, calendarMode === 'month' ? 2 : eventosDia.length).map((evento) => {
                        const style = getCategoryStyle(evento.category);
                        return (
                          <div
                            key={`ev-${evento.id}`}
                            className={`px-1.5 py-0.5 sm:px-2 sm:py-1 border-l-2 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1 ${style.badge} ${evento.is_completed ? 'opacity-60 line-through' : ''}`}
                            title={evento.title}
                          >
                            {evento.time && <span className="opacity-75 font-mono tracking-wider shrink-0 hidden sm:inline">{evento.time.substring(0, 5)}</span>}
                            <span className="truncate">{evento.title}</span>
                          </div>
                        );
                      })}

                      {transacoesDia.slice(0, calendarMode === 'month' ? 1 : transacoesDia.length).map((transacao) => {
                        const isDespesa = transacao.type === 'despesa';
                        return (
                          <div
                            key={`fin-${transacao.id}`}
                            className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-bold rounded flex justify-between gap-1 items-center overflow-hidden ${isDespesa ? 'bg-rose-500/15 border-l-2 border-rose-500 text-rose-300' : 'bg-emerald-500/15 border-l-2 border-emerald-500 text-emerald-300'}`}
                            title={tituloTransacao(transacao)}
                          >
                            <span className="truncate flex-1">{tituloTransacao(transacao)}</span>
                            <span className="hidden xl:inline font-mono">R${Number(transacao.amount).toFixed(0)}</span>
                          </div>
                        );
                      })}

                      {(calendarMode === 'week' || calendarMode === 'day') && tarefasDia.length > 0 && (
                        <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-500/15 border-l-2 border-amber-500 text-amber-300 text-[9px] sm:text-[10px] font-bold rounded overflow-hidden flex items-center gap-1 mt-0.5">
                          <CheckSquare size={10} className="shrink-0" />
                          <span className="truncate">{tarefasDia.length} {tarefasDia.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}</span>
                        </div>
                      )}
                    </div>

                    {calendarMode === 'month' && totalItens > 0 && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center rounded-lg hidden sm:flex pointer-events-none">
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
                  aria-label="Nova tarefa"
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
                  tarefasDoDiaSelecionado.map((task) => {
                    const confirmKey = `inbox-${task.id}`;
                    const isConfirming = confirmDeleteId === confirmKey;
                    const isEditingThis = editingInboxId === task.id;
                    const atrasada = visualizandoHoje && !task.completed && task.date && task.date < hojeISO;

                    return (
                      <div
                        key={task.id}
                        className={`group flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
                          isEditingThis
                            ? 'bg-black/50 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                            : task.completed
                              ? 'bg-black/20 border-white/5 opacity-60'
                              : atrasada
                                ? 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40 shadow-lg'
                                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 shadow-lg'
                        }`}
                      >
                        {isEditingThis ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
                            <input
                              autoFocus
                              type="text"
                              aria-label="Título da tarefa"
                              value={editInboxTitle}
                              onChange={(e) => setEditInboxTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditInbox(task.id);
                                if (e.key === 'Escape') setEditingInboxId(null);
                              }}
                              className="flex-1 bg-black/60 border border-cyan-500/40 rounded-xl px-3.5 py-2 text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="Título da tarefa..."
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                aria-label="Data da tarefa"
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
                                aria-label="Cancelar edição"
                                className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl shrink-0"
                                title="Cancelar"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                aria-label={`Concluir "${task.title}"`}
                                checked={Boolean(task.completed)}
                                onChange={() => runAction(() => toggleInboxTask(task.id, task.completed))}
                                className="w-5 h-5 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-slate-900 cursor-pointer shrink-0 transition-colors"
                              />
                              <span
                                onDoubleClick={() => handleStartEditInbox(task)}
                                title="Duplo clique para editar"
                                className={`flex-1 text-sm sm:text-base font-medium truncate cursor-pointer ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}
                              >
                                {task.title}
                              </span>
                              {atrasada && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  Atrasada · {format(parseISO(task.date), 'dd/MM')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditInbox(task)}
                                title="Editar Tarefa"
                                aria-label="Editar tarefa"
                                className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                              <DeleteButton
                                confirming={isConfirming}
                                onClick={() => triggerSafeDelete(confirmKey, () => deleteInboxTask(task.id))}
                                title="Excluir tarefa"
                                className="p-2 rounded-xl text-xs"
                              />
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

        {/* ================= ABA 3: KANBAN ================= */}
        {activeTab === 'projects' && (
          <div className="h-[720px] flex gap-5 sm:gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory mt-2">
            {KANBAN_COLUMNS.map((column) => {
              const colTasks = (kanbanTasks || []).filter(
                (t) => t.status === column.id && (!query || norm(t.title).includes(query))
              );

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverCol !== column.id) setDragOverCol(column.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const taskId = e.dataTransfer.getData('taskId');
                    if (taskId) runAction(() => moveTask(taskId, column.id), 'Não foi possível mover o cartão.');
                  }}
                  className={`min-w-[85vw] sm:min-w-[350px] flex-1 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-3xl p-5 flex flex-col max-h-full backdrop-blur-xl snap-center transition-shadow ${dragOverCol === column.id ? 'ring-2 ring-cyan-400/50' : ''}`}
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
                    {colTasks.map((task) => {
                      const confirmKey = `kb-${task.id}`;
                      const isConfirming = confirmDeleteId === confirmKey;
                      const isEditingCard = editingKanbanId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable={!isEditingCard}
                          onDragStart={(e) => {
                            if (isEditingCard) return;
                            e.dataTransfer.setData('taskId', String(task.id));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
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
                                aria-label="Título do cartão"
                                value={editKanbanTitle}
                                onChange={(e) => setEditKanbanTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditKanban(task.id);
                                  if (e.key === 'Escape') setEditingKanbanId(null);
                                }}
                                className="w-full bg-black/60 border border-cyan-500/40 rounded-xl p-2.5 text-base sm:text-sm text-white focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditingKanbanId(null)} className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-white/5">
                                  Cancelar
                                </button>
                                <button type="button" onClick={() => handleSaveEditKanban(task.id)} className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1">
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
                                    title="Editar cartão"
                                    aria-label="Editar cartão"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <DeleteButton
                                    confirming={isConfirming}
                                    onClick={() => triggerSafeDelete(confirmKey, () => deleteKanbanTask(task.id))}
                                    title="Excluir cartão"
                                    confirmLabel="Apagar?"
                                    iconSize={14}
                                    className="p-1.5 rounded-lg text-[10px]"
                                    confirmClassName="bg-rose-500 text-white px-2 animate-pulse"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
                                {column.prev && (
                                  <button
                                    type="button"
                                    onClick={() => runAction(() => moveTask(task.id, column.prev), 'Não foi possível mover o cartão.')}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] font-bold transition-colors"
                                  >
                                    <ArrowLeft size={12} /> Voltar
                                  </button>
                                )}
                                {column.next && (
                                  <button
                                    type="button"
                                    onClick={() => runAction(() => moveTask(task.id, column.next), 'Não foi possível mover o cartão.')}
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
                        aria-label="Título do novo cartão"
                        value={newKanbanTitle}
                        onChange={(e) => setNewKanbanTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setAddingKanbanCol(null); }}
                        placeholder="Título do cartão..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-base sm:text-sm text-white focus:outline-none focus:border-cyan-500"
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
                      type="button"
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

      {/* ================= MODAL DE DETALHES DO DIA ================= */}
      {selectedDayModal.isOpen && selectedDayModal.date && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDayModal({ isOpen: false, date: null })}
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do dia"
        >
          <div
            className="bg-slate-900 border border-white/10 p-5 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white capitalize">
                  {format(selectedDayModal.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Resumo completo de compromissos, tarefas e caixa</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayModal({ isOpen: false, date: null })}
                aria-label="Fechar"
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">

              {/* Compromissos */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                    <CalendarIcon size={14} /> Compromissos
                  </h4>
                  <button
                    type="button"
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

                {eventosModal.length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhum evento agendado.</p>
                ) : (
                  <div className="space-y-2.5">
                    {eventosModal.map((evento) => {
                      const style = getCategoryStyle(evento.category);
                      const confirmKey = `ev-${evento.id}`;
                      const isConfirming = confirmDeleteId === confirmKey;
                      const concluido = Boolean(evento.is_completed);

                      return (
                        <div key={evento.id} className={`border p-4 rounded-2xl flex flex-col gap-2 transition-colors ${style.card} ${concluido ? 'opacity-60' : ''}`}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="overflow-hidden">
                              <span className={`text-sm sm:text-base font-bold text-slate-100 block truncate ${concluido ? 'line-through' : ''}`}>{evento.title}</span>
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded-md mt-1 inline-block">
                                {style.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {evento.time && (
                                <span className="text-xs font-bold font-mono text-cyan-300 bg-black/40 px-2.5 py-1 rounded-lg mr-1">
                                  <Clock size={12} className="inline mr-1 pb-0.5" />{evento.time.substring(0, 5)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => runAction(() => toggleItemCompletion(evento.id, concluido))}
                                className={`p-2 rounded-xl transition-colors ${concluido ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-300 hover:text-emerald-300 hover:bg-white/10'}`}
                                title={concluido ? 'Reabrir compromisso' : 'Marcar como concluído'}
                                aria-label={concluido ? 'Reabrir compromisso' : 'Marcar como concluído'}
                              >
                                <CheckCircle2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditClick(evento)}
                                className="p-2 text-slate-300 hover:text-cyan-300 hover:bg-white/10 rounded-xl transition-colors"
                                title="Editar evento"
                                aria-label="Editar evento"
                              >
                                <Edit2 size={15} />
                              </button>
                              <DeleteButton
                                confirming={isConfirming}
                                onClick={() => triggerSafeDelete(confirmKey, () => deleteAgendaItem(evento.id))}
                                title="Excluir evento"
                                iconSize={15}
                                className="p-2 rounded-xl text-[11px]"
                                confirmClassName="bg-rose-500 text-white px-2.5 animate-pulse"
                                idleClassName="text-slate-300 hover:text-rose-400 hover:bg-rose-500/20"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tarefas do dia */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
                  <CheckSquare size={14} /> Tarefas do Dia
                </h4>
                {tarefasModal.length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhuma tarefa vinculada a esta data.</p>
                ) : (
                  <div className="space-y-2">
                    {tarefasModal.map((task) => {
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
                                aria-label="Título da tarefa"
                                value={editInboxTitle}
                                onChange={(e) => setEditInboxTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditInbox(task.id, { mantemData: true });
                                  if (e.key === 'Escape') setEditingInboxId(null);
                                }}
                                className="flex-1 bg-black/60 border border-cyan-500/40 rounded-xl px-3 py-1.5 text-base sm:text-sm text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditInbox(task.id, { mantemData: true })}
                                aria-label="Salvar tarefa"
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInboxId(null)}
                                aria-label="Cancelar edição"
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
                                  aria-label={`Concluir "${task.title}"`}
                                  checked={Boolean(task.completed)}
                                  onChange={() => runAction(() => toggleInboxTask(task.id, task.completed))}
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
                                  title="Editar tarefa"
                                  aria-label="Editar tarefa"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <DeleteButton
                                  confirming={isConfirmingModalTask}
                                  onClick={() => triggerSafeDelete(confirmModalTaskKey, () => deleteInboxTask(task.id))}
                                  title="Excluir tarefa"
                                  confirmLabel="Apagar?"
                                  iconSize={14}
                                  className="p-1.5 rounded-lg text-[10px]"
                                  confirmClassName="bg-rose-500 text-white px-2"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Caixa do dia */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-2">
                  <Target size={14} /> Caixa do Dia
                </h4>

                {transacoesModal.length === 0 ? (
                  <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-2xl border border-white/5 text-center">Nenhuma movimentação financeira.</p>
                ) : (
                  <div className="space-y-2.5">
                    {transacoesModal.map((transacao) => {
                      const isDespesa = transacao.type === 'despesa';
                      const isPendente = (transacao.status || 'pago') === 'pendente';
                      return (
                        <div key={transacao.id} className={`p-4 rounded-2xl border flex justify-between items-center gap-3 ${isDespesa ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                          <div className="overflow-hidden">
                            <span className="text-sm font-bold block truncate">{tituloTransacao(transacao)}</span>
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
                            {isPendente && (
                              <button
                                type="button"
                                onClick={() => runAction(() => toggleTransactionStatus(transacao.id), 'Não foi possível dar baixa.')}
                                title="Dar baixa rápida"
                                aria-label="Dar baixa rápida"
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
                type="button"
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
                type="button"
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
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Editar compromisso' : 'Novo compromisso'}
        >
          <div className="bg-[#1e2330] w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 border border-white/10 max-h-[90vh]">

            <div className="flex justify-between items-center px-4 py-3.5 border-b border-white/5 bg-[#171b26] sm:rounded-t-3xl rounded-t-3xl shrink-0">
              <button type="button" onClick={fecharModalFormulario} aria-label="Fechar" className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                <X size={22} />
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {editingId ? 'Editar Compromisso' : 'Novo Compromisso'}
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !newItem.title.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 pb-10 custom-scrollbar">

              {formError && (
                <div role="alert" className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {formError}
                </div>
              )}

              <div>
                <input
                  autoFocus
                  required
                  type="text"
                  aria-label="Título"
                  value={newItem.title}
                  onChange={(e) => { setNewItem({ ...newItem, title: e.target.value }); setFormError(''); }}
                  className="w-full bg-transparent border-b border-white/10 focus:border-cyan-500 text-xl sm:text-2xl font-bold text-white placeholder:text-slate-500 pb-2.5 outline-none transition-colors"
                  placeholder="Adicionar título..."
                />
              </div>

              <div className="flex items-start gap-4">
                <Clock className="text-cyan-400 mt-2.5 shrink-0" size={22} />
                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label htmlFor="ag-data" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Data</label>
                    <input
                      id="ag-data"
                      required
                      type="date"
                      value={newItem.date}
                      onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] transition-all cursor-pointer"
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <label htmlFor="ag-hora" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Horário (Opcional)</label>
                    <input
                      id="ag-hora"
                      type="time"
                      value={newItem.time}
                      onChange={(e) => setNewItem({ ...newItem, time: e.target.value })}
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
                        onChange={(e) => { setIsRecurring(e.target.checked); setFormError(''); }}
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer"
                      />
                      Repetir este compromisso
                    </label>

                    {isRecurring && (
                      <div className="flex flex-col gap-3 p-3.5 bg-black/20 rounded-xl border border-white/5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <label htmlFor="ag-freq" className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Frequência</label>
                            <select
                              id="ag-freq"
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
                            <label htmlFor="ag-fim" className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Até quando?</label>
                            <input
                              id="ag-fim"
                              required={isRecurring}
                              type="date"
                              min={newItem.date}
                              value={recurrenceEndDate}
                              onChange={(e) => { setRecurrenceEndDate(e.target.value); setFormError(''); }}
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 [color-scheme:dark] cursor-pointer"
                            />
                          </div>
                        </div>

                        {recorrencia && (
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {recorrencia.datas.length === 0
                              ? 'A data final precisa ser igual ou posterior à data inicial.'
                              : `Serão criados ${recorrencia.datas.length} compromissos${
                                  recorrencia.truncado
                                    ? `, limitados a ${MAX_RECORRENCIAS} (o último será em ${format(parseISO(recorrencia.datas[recorrencia.datas.length - 1]), 'dd/MM/yyyy')}). Escolha uma data final mais próxima para cobrir só o período desejado.`
                                    : '.'
                                }`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <Tag className="text-cyan-400 shrink-0" size={22} />
                <div className="flex-1">
                  <label htmlFor="ag-categoria" className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Categoria</label>
                  <select
                    id="ag-categoria"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
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
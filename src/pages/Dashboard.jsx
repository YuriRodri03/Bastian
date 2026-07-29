import React, { useState, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useFitnessStore } from '../store/useFitnessStore';
import { useAgendaStore } from '../store/useAgendaStore'; // NOVO: Trazendo a agenda
import { useInboxStore } from '../store/useInboxStore';   // NOVO: Trazendo as tarefas rápidas
import { Wallet, Dumbbell, Calendar as CalendarIcon, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Calendar, Target, CheckSquare } from 'lucide-react';

// Importando nossos componentes modulares
import StatCard from '../components/StatCard';
import PomodoroWidget from '../components/PomodoroWidget';
import FinanceChart from '../components/FinanceChart';
import WeightChart from '../components/WeightChart';
import ActivityFeed from '../components/ActivityFeed';

export default function Dashboard() {
  const { transactions, fetchTransactions } = useFinanceStore();
  const { healthLogs, fetchHealthLogs } = useFitnessStore();
  const { agendaItems, fetchAgendaItems } = useAgendaStore();
  const { inboxTasks, fetchInboxTasks, toggleInboxTask } = useInboxStore();

  // --- ESTADO DE FILTRO POR MÊS E ANO ---
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const currentDatePointer = useMemo(() => {
    return new Date(Number(filterYear), Number(filterMonth) - 1, 1);
  }, [filterMonth, filterYear]);

  const formatToMonthInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const handleMonthInputSelect = (e) => {
    if (!e.target.value) return;
    const [y, m] = e.target.value.split('-');
    setFilterYear(y);
    setFilterMonth(m);
    setIsPickerOpen(false);
  };

  const handlePrevMonth = () => {
    let m = Number(filterMonth) - 1;
    let y = Number(filterYear);
    if (m < 1) { m = 12; y -= 1; }
    setFilterMonth(String(m).padStart(2, '0'));
    setFilterYear(String(y));
  };

  const handleNextMonth = () => {
    let m = Number(filterMonth) + 1;
    let y = Number(filterYear);
    if (m > 12) { m = 1; y += 1; }
    setFilterMonth(String(m).padStart(2, '0'));
    setFilterYear(String(y));
  };

  const formattedMonthName = currentDatePointer.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    fetchTransactions();
    fetchHealthLogs();
    fetchAgendaItems();
    fetchInboxTasks();
  }, [fetchTransactions, fetchHealthLogs, fetchAgendaItems, fetchInboxTasks]);

  // --- FILTRAGEM DE HOJE (AGENDA E TAREFAS) ---
  const { eventosDeHoje, tarefasPendentes } = useMemo(() => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const dataDeHojeStr = `${yyyy}-${mm}-${dd}`;

    const eventos = agendaItems
      .filter(item => item.date === dataDeHojeStr)
      .sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

    const tarefas = inboxTasks.filter(t => !t.completed);

    return { eventosDeHoje: eventos, tarefasPendentes: tarefas };
  }, [agendaItems, inboxTasks]);

  // --- FILTRAGEM MENSAL (FINANÇAS E SAÚDE) ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return true;
      let y, m;
      if (t.date.includes('/')) {
        const parts = t.date.split('/');
        y = parts[2]; m = parts[1];
      } else {
        const parts = t.date.split('-');
        y = parts[0]; m = parts[1];
      }
      if (filterYear !== y) return false;
      if (filterMonth !== 'all' && filterMonth !== m) return false;
      return true;
    });
  }, [transactions, filterMonth, filterYear]);

  const filteredHealthLogs = useMemo(() => {
    return healthLogs.filter(l => {
      const dateStr = l.date || l.created_at;
      if (!dateStr) return true;
      let y, m;
      const cleanDate = String(dateStr).substring(0, 10);
      if (cleanDate.includes('/')) {
        const parts = cleanDate.split('/');
        y = parts[2]; m = parts[1];
      } else {
        const parts = cleanDate.split('-');
        y = parts[0]; m = parts[1];
      }
      if (filterYear !== y) return false;
      if (filterMonth !== 'all' && filterMonth !== m) return false;
      return true;
    });
  }, [healthLogs, filterMonth, filterYear]);

  // --- CÁLCULOS ---
  const totalReceitas = filteredTransactions
    .filter(t => (t.type === 'receita' || t.type === 'income') && (t.status || 'pago') === 'pago')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalDespesas = filteredTransactions
    .filter(t => (t.type === 'despesa' || t.type === 'expense') && (t.status || 'pago') === 'pago')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const saldoTotal = totalReceitas - totalDespesas;
  const totalTreinos = filteredHealthLogs.filter(l => l.type === 'treino').length;
  
  const ultimoPeso = healthLogs
    .filter(l => l.type === 'peso')
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))[0];

  const ultimasAtividades = filteredHealthLogs
    .slice()
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 5);

  const financeChartData = useMemo(() => {
    const agrupado = filteredTransactions.reduce((acc, t) => {
      const rawDate = t.date || t.created_at;
      if (!rawDate) return acc;
      let day, month, year;
      const cleanDate = String(rawDate).substring(0, 10);
      if (cleanDate.includes('/')) {
        const parts = cleanDate.split('/');
        day = parts[0]; month = parts[1]; year = parts[2];
      } else {
        const parts = cleanDate.split('-');
        year = parts[0]; month = parts[1]; day = parts[2];
      }

      const dateKey = `${day}/${month}`;
      const sortDateObj = new Date(`${year}-${month}-${day}`);
      
      let existing = acc.find(item => item.date === dateKey);
      if (!existing) {
        existing = { date: dateKey, receitas: 0, despesas: 0, rawDate: sortDateObj };
        acc.push(existing);
      }
      
      const tStatus = t.status || 'pago';
      if (tStatus === 'pago') {
        if (t.type === 'receita' || t.type === 'income') existing.receitas += Number(t.amount || 0);
        if (t.type === 'despesa' || t.type === 'expense') existing.despesas += Number(t.amount || 0);
      }
      return acc;
    }, []);

    return agrupado.sort((a, b) => a.rawDate - b.rawDate);
  }, [filteredTransactions]);

  const pesoChartData = useMemo(() => {
    return healthLogs
      .filter(l => l.type === 'peso')
      .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))
      .map(l => {
        const rawDate = l.date || l.created_at;
        const cleanDateStr = String(rawDate).substring(0, 10);
        const [, month, day] = cleanDateStr.split('-');
        return { date: `${day}/${month}`, peso: Number(l.value || 0) };
      });
  }, [healthLogs]);

  return (
    <div className="min-h-screen p-8 font-sans flex flex-col items-center">
      
      {/* CABEÇALHO */}
      <div className="w-full max-w-7xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-wide">Centro de Comando</h1>
          <p className="text-sm text-slate-400">Visão geral integrada com foco, finanças e performance</p>
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl shadow-lg">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
            <ChevronLeft size={16} />
          </button>

          <div className="relative flex items-center gap-2 px-3 py-1 cursor-pointer" onClick={() => setIsPickerOpen(!isPickerOpen)}>
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200 capitalize min-w-[130px] text-center">
              {formattedMonthName}
            </span>
            {isPickerOpen && (
              <input 
                type="month" 
                value={formatToMonthInput(currentDatePointer)}
                onChange={handleMonthInputSelect}
                onBlur={() => setIsPickerOpen(false)}
                autoFocus
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            )}
          </div>

          <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded-xl transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* BLOCO SUPERIOR: CARDS DE MÉTRICAS */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Saldo no Mês" 
            icon={Wallet} 
            colorClass="text-emerald-400"
            mainValue={`R$ ${saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            footerContent={
              <>
                <span className="text-emerald-400 flex items-center gap-1"><TrendingUp size={12}/> R$ {totalReceitas.toFixed(2)}</span>
                <span className="text-rose-400 flex items-center gap-1"><TrendingDown size={12}/> R$ {totalDespesas.toFixed(2)}</span>
              </>
            }
          />

          <StatCard 
            title="Treinos no Mês" 
            icon={Dumbbell} 
            colorClass="text-cyan-400"
            mainValue={<>{totalTreinos} <span className="text-sm font-normal text-slate-400">sessões</span></>}
            footerContent={<span>Peso atual: <strong className="font-mono text-slate-200">{ultimoPeso ? `${ultimoPeso.value} ${ultimoPeso.unit}` : '--'}</strong></span>}
          />

          <StatCard 
            title="Status da Rotina" 
            icon={CalendarIcon} 
            colorClass="text-indigo-400"
            mainValue="Foco & Produtividade"
            subtext="Utilize o Pomodoro ao lado para gerenciar suas tarefas."
            footerContent={<span className="text-indigo-400 font-medium">Sincronizado</span>}
          />
        </div>

        {/* SEÇÃO DE GRÁFICOS ANALÍTICOS */}
        <div className="lg:col-span-8 grid grid-cols-1 gap-6">
          <FinanceChart data={financeChartData} />
          <WeightChart data={pesoChartData} />
        </div>

        {/* COLUNA LATERAL: POMODORO, FOCO DO DIA & ATIVIDADES */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <PomodoroWidget />
          
          {/* --- NOVO WIDGET: FOCO DO DIA --- */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Target size={16} className="text-indigo-400" /> Foco de Hoje
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-black/20 px-2 py-1 rounded-md">
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
            
            {/* Subseção: Eventos */}
            <div className="flex flex-col gap-2">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <CalendarIcon size={12} /> Compromissos
              </h4>
              {eventosDeHoje.length === 0 ? (
                <p className="text-xs text-slate-500 italic bg-black/20 p-3 rounded-xl border border-white/5 text-center">Nenhum evento para hoje.</p>
              ) : (
                eventosDeHoje.map(evento => (
                  <div key={evento.id} className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl transition-colors hover:bg-indigo-500/20">
                    <span className="text-sm text-slate-200 font-medium truncate pr-2">{evento.title}</span>
                    {evento.time && <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/50 px-2 py-1 rounded shadow-inner shrink-0">{evento.time.substring(0,5)}</span>}
                  </div>
                ))
              )}
            </div>

            {/* Subseção: Tarefas */}
            <div className="flex flex-col gap-2 mt-2">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <CheckSquare size={12} /> Inbox Pendente
              </h4>
              {tarefasPendentes.length === 0 ? (
                <p className="text-xs text-slate-500 italic bg-black/20 p-3 rounded-xl border border-white/5 text-center">Sua mesa está limpa, senhor.</p>
              ) : (
                tarefasPendentes.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 bg-black/20 border border-white/5 p-3 rounded-xl transition-colors hover:border-white/10 group">
                    <input 
                      type="checkbox" 
                      checked={task.completed}
                      onChange={() => toggleInboxTask(task.id, task.completed)}
                      className="w-4 h-4 rounded border-white/20 bg-black/30 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer transition-colors"
                    />
                    <span className="text-sm text-slate-300 truncate group-hover:text-slate-100 transition-colors">{task.title}</span>
                  </div>
                ))
              )}
              {tarefasPendentes.length > 5 && (
                <span className="text-[10px] text-slate-500 text-center mt-1">+ {tarefasPendentes.length - 5} tarefas na aba Agenda</span>
              )}
            </div>
          </div>
          {/* -------------------------------- */}

          <ActivityFeed atividades={ultimasAtividades} />
        </div>

      </main>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useFitnessStore } from '../store/useFitnessStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';   
import { 
  Wallet, Dumbbell, Calendar as CalendarIcon, TrendingUp, TrendingDown, 
  ChevronLeft, ChevronRight, Calendar, Target, CheckSquare, Clock, 
  BarChart3, LayoutGrid 
} from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

import StatCard from '../components/StatCard';
import PomodoroWidget from '../components/PomodoroWidget';
import WeightChart from '../components/WeightChart';
import ActivityFeed from '../components/ActivityFeed';

// Formatador blindado contra valores nulos
const formatCompactCurrency = (value) => {
  const num = Number(value) || 0;
  if (num >= 1000 || num <= -1000) {
    return `R$${(num / 1000).toFixed(1).replace('.0', '')}k`;
  }
  return `R$${num}`;
};

// Tooltip Blindado contra falhas de renderização
const CustomFinanceTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-white/10 p-4 rounded-xl backdrop-blur-xl shadow-2xl z-50">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 border-b border-white/10 pb-2">{label}</p>
        {payload.map((entry, index) => {
          const valorSeguro = Number(entry.value) || 0;
          return (
            <div key={index} className="flex items-center gap-3 mb-2 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
              <span className="text-slate-300 text-sm font-medium">{entry.name}:</span>
              <span className={`font-mono text-sm font-bold ml-auto ${entry.name === 'Saldo Acumulado' ? 'text-indigo-300' : 'text-white'}`}>
                {valorSeguro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { transactions, fetchTransactions } = useFinanceStore();
  const { healthLogs, fetchHealthLogs } = useFitnessStore();
  const { agendaItems, fetchAgendaItems } = useAgendaStore();
  const { inboxTasks, fetchInboxTasks, toggleInboxTask } = useInboxStore();

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

  const { eventosDeHoje, tarefasPendentes, tarefasTotaisHoje, proximoEvento } = useMemo(() => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const dataDeHojeStr = `${yyyy}-${mm}-${dd}`;

    const eventos = agendaItems
      .filter(item => item.date === dataDeHojeStr)
      .sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

    // Filtra tarefas não concluídas que pertencem a HOJE ou que não tem data (retrocompatibilidade)
    const tarefas = inboxTasks.filter(t => !t.completed && (!t.date || t.date === dataDeHojeStr));
    const tarefasTotais = inboxTasks.filter(t => (!t.date || t.date === dataDeHojeStr)).length;
    
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const eventoSeguinte = eventos.find(e => (e.time || '24:00') >= horaAtual);

    return { 
      eventosDeHoje: eventos, 
      tarefasPendentes: tarefas,
      tarefasTotaisHoje: tarefasTotais,
      proximoEvento: eventoSeguinte
    };
  }, [agendaItems, inboxTasks]);

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

  const tarefasConcluidas = tarefasTotaisHoje - tarefasPendentes.length;
  const porcentagemProgresso = tarefasTotaisHoje === 0 ? 0 : Math.round((tarefasConcluidas / tarefasTotaisHoje) * 100);

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
        existing = { date: dateKey, Receitas: 0, Despesas: 0, rawDate: sortDateObj };
        acc.push(existing);
      }
      
      const tStatus = t.status || 'pago';
      if (tStatus === 'pago') {
        if (t.type === 'receita' || t.type === 'income') existing.Receitas += Number(t.amount || 0);
        if (t.type === 'despesa' || t.type === 'expense') existing.Despesas += Number(t.amount || 0);
      }
      return acc;
    }, []);

    const sorted = agrupado.sort((a, b) => a.rawDate - b.rawDate);
    
    let saldoAcumulado = 0;
    return sorted.map(item => {
      saldoAcumulado += (item.Receitas - item.Despesas);
      return { ...item, Saldo: saldoAcumulado };
    });
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
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">
      
      {/* CABEÇALHO PADRÃO GLASSMORPHISM (Alinhado com outras páginas) */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-lg shadow-indigo-500/10">
            <LayoutGrid className="text-indigo-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Centro de Comando</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Visão geral integrada do seu sistema</p>
          </div>
        </div>

        {/* NAVEGADOR TEMPORAL (Estilo Financeiro) */}
        <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl shadow-xl flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex-1 flex justify-center relative min-w-[140px]" onClick={() => setIsPickerOpen(!isPickerOpen)}>
            <div className="flex items-center justify-center gap-2 cursor-pointer py-1.5 px-2 hover:text-white transition-colors group">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-sm font-bold text-slate-200 capitalize tracking-wide truncate group-hover:text-white transition-colors">
                {formattedMonthName}
              </span>
            </div>
            {isPickerOpen && (
              <input 
                type="month" 
                value={formatToMonthInput(currentDatePointer)}
                onChange={handleMonthInputSelect}
                onBlur={() => setIsPickerOpen(false)}
                autoFocus
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base"
              />
            )}
          </div>

          <button onClick={handleNextMonth} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* BLOCO SUPERIOR: CARDS DE MÉTRICAS */}
        <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatCard 
            title="Saldo no Mês" 
            icon={Wallet} 
            colorClass="text-emerald-400"
            mainValue={`R$ ${saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            footerContent={
              <>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-xs"><TrendingUp size={12} className="shrink-0"/> <span className="truncate">{totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                <span className="text-rose-400 flex items-center gap-1 font-mono text-xs"><TrendingDown size={12} className="shrink-0"/> <span className="truncate">{totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
              </>
            }
          />

          <StatCard 
            title="Treinos no Mês" 
            icon={Dumbbell} 
            colorClass="text-cyan-400"
            mainValue={<>{totalTreinos} <span className="text-sm font-medium text-slate-400">sessões</span></>}
            footerContent={<span className="text-xs text-slate-400 truncate">Peso atual: <strong className="font-mono text-cyan-300">{ultimoPeso ? `${ultimoPeso.value} ${ultimoPeso.unit}` : '--'}</strong></span>}
          />

          <StatCard 
            title="Execução Diária" 
            icon={Target} 
            colorClass="text-indigo-400"
            mainValue={`${porcentagemProgresso}%`}
            subtext={
              <span className="flex items-center gap-1.5 mt-2">
                <Clock size={12} className="text-indigo-400 shrink-0" />
                {proximoEvento ? (
                  <span className="truncate text-slate-300 text-xs font-medium">Próximo: {proximoEvento.title} ({proximoEvento.time.substring(0,5)})</span>
                ) : (
                  <span className="text-slate-500 text-xs truncate">Agenda livre para hoje.</span>
                )}
              </span>
            }
            footerContent={
              <div className="w-full bg-black/40 rounded-full h-1.5 mt-2 border border-white/5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-600 to-purple-500 h-1.5 rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(99,102,241,0.6)]" 
                  style={{ width: `${porcentagemProgresso}%` }}
                ></div>
              </div>
            }
          />
        </div>

        {/* COLUNA ESQUERDA (FOCO PRINCIPAL) */}
        <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6">
          
          <div className="w-full relative z-10 transition-transform duration-300 hover:scale-[1.01] bg-black/20 rounded-[2.5rem] border border-white/5 p-1 shadow-inner">
            <PomodoroWidget />
          </div>

          {/* GRÁFICO COMPOSTO UNIFICADO */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400 shrink-0" /> Inteligência Financeira
              </h2>
            </div>
            
            <div className="flex flex-col h-80 sm:h-96 w-full">
              <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 size={14} className="text-indigo-400 shrink-0"/> Fluxo Diário vs Saldo Acumulado
              </h3>
              
              <div className="flex-1 w-full relative">
                {financeChartData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-medium border border-dashed border-white/10 rounded-2xl">
                    Sem transações no período selecionado.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      
                      {/* Eixo Y Esquerdo (Barras de Fluxo) */}
                      <YAxis 
                        yAxisId="left" 
                        stroke="#ffffff40" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={formatCompactCurrency} 
                        width={45} 
                      />
                      
                      {/* Eixo Y Direito (Linha de Saldo) */}
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="#818cf8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={formatCompactCurrency} 
                        width={45} 
                      />
                      
                      <RechartsTooltip content={<CustomFinanceTooltip />} cursor={{fill: '#ffffff05'}} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', paddingTop: '15px' }} iconType="circle" />
                      
                      <Bar yAxisId="left" name="Receitas" dataKey="Receitas" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={16} />
                      <Bar yAxisId="left" name="Despesas" dataKey="Despesas" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={16} />
                      
                      <Line 
                        yAxisId="right" 
                        name="Saldo Acumulado" 
                        type="monotone" 
                        dataKey="Saldo" 
                        stroke="#818cf8" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: '#818cf8', stroke: '#1e293b', strokeWidth: 2 }} 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#c7d2fe' }} 
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <WeightChart data={pesoChartData} />
        </div>

        {/* COLUNA DIREITA (ATALHOS E LOGS) */}
        <div className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">
          
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Target size={18} className="text-indigo-400" /> Foco de Hoje
              </h3>
              <span className="text-[10px] sm:text-xs font-bold text-slate-300 bg-black/40 px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
            
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CalendarIcon size={14} /> Compromissos
              </h4>
              {eventosDeHoje.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-xl sm:rounded-2xl border border-white/5 text-center">Nenhum evento para hoje.</p>
              ) : (
                eventosDeHoje.map(evento => (
                  <div key={evento.id} className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all hover:bg-indigo-500/20 hover:border-indigo-500/30 group">
                    <span className="text-xs sm:text-sm text-slate-200 font-bold truncate pr-2 group-hover:text-white transition-colors">{evento.title}</span>
                    {evento.time && <span className="text-[10px] sm:text-[11px] font-bold font-mono text-indigo-300 bg-indigo-950/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-inner shrink-0 tracking-wider">{evento.time.substring(0,5)}</span>}
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CheckSquare size={14} /> Inbox Pendente
              </h4>
              {tarefasPendentes.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 font-medium bg-black/20 p-4 rounded-xl sm:rounded-2xl border border-white/5 text-center">Sua mesa está limpa, senhor.</p>
              ) : (
                tarefasPendentes.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 bg-black/20 border border-white/5 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all hover:border-white/20 hover:bg-white/5 group cursor-pointer" onClick={() => toggleInboxTask(task.id, task.completed)}>
                    <input 
                      type="checkbox" 
                      checked={task.completed}
                      onChange={() => {}} 
                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer pointer-events-none shrink-0 transition-colors"
                    />
                    <span className="text-xs sm:text-sm font-medium text-slate-300 truncate group-hover:text-white transition-colors">{task.title}</span>
                  </div>
                ))
              )}
              {tarefasPendentes.length > 5 && (
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 text-center mt-2 uppercase tracking-wider bg-black/20 py-2 rounded-xl border border-white/5">
                  + {tarefasPendentes.length - 5} tarefas ocultas
                </div>
              )}
            </div>
          </div>

          <ActivityFeed atividades={ultimasAtividades} />
        </div>

      </main>
    </div>
  );
}
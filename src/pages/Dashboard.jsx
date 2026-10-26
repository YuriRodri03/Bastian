import React, { useState, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useFitnessStore } from '../store/useFitnessStore';
import { useAgendaStore } from '../store/useAgendaStore'; 
import { useInboxStore } from '../store/useInboxStore';
import { useKanbanStore } from '../store/useKanbanStore';
import { useFinanceMetrics } from '../hooks/useFinanceMetrics';
import { normalizeDateISO } from '../utils/financeUtils';
import { 
  Wallet, Dumbbell, Calendar as CalendarIcon, TrendingUp, TrendingDown, 
  ChevronLeft, ChevronRight, Calendar, Target, CheckSquare, Clock, 
  BarChart3, LayoutGrid, Sparkles, Eye, EyeOff, PiggyBank, Plus, 
  AlertCircle, CheckCircle2, Layers
} from 'lucide-react';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend 
} from 'recharts';

import StatCard from '../components/StatCard';
import PomodoroWidget from '../components/PomodoroWidget';
import WeightChart from '../components/WeightChart';
import ActivityFeed from '../components/ActivityFeed';

// Formatador compacto para os eixos do gráfico
const formatCompactCurrency = (value) => {
  const num = Number(value) || 0;
  if (num >= 1000 || num <= -1000) {
    return `R$${(num / 1000).toFixed(1).replace('.0', '')}k`;
  }
  return `R$${num}`;
};

// Tooltip Blindado com suporte ao Modo Privacidade
const CustomFinanceTooltip = ({ active, payload, label, hideValues }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-white/10 p-4 rounded-2xl backdrop-blur-xl shadow-2xl z-50">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 border-b border-white/10 pb-2">
          Dia {label}
        </p>
        {payload.map((entry, index) => {
          const valorSeguro = Number(entry.value) || 0;
          return (
            <div key={index} className="flex items-center gap-3 mb-2 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
              <span className="text-slate-300 text-xs sm:text-sm font-medium">{entry.name}:</span>
              <span className={`font-mono text-xs sm:text-sm font-bold ml-auto ${entry.name === 'Saldo Acumulado' ? 'text-indigo-300' : 'text-white'}`}>
                {hideValues 
                  ? 'R$ •••••' 
                  : valorSeguro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
  const { transactions, fetchTransactions, toggleTransactionStatus } = useFinanceStore();
  const { healthLogs, fetchHealthLogs } = useFitnessStore();
  const { agendaItems, fetchAgendaItems } = useAgendaStore();
  const { inboxTasks, fetchInboxTasks, addInboxTask, toggleInboxTask } = useInboxStore();
  const { tasks: kanbanTasks, fetchKanbanTasks } = useKanbanStore();

  const currentYear = new Date().getFullYear().toString();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  // ESTADOS DE VISÃO E INTERAÇÃO RÁPIDA
  const [isProjected, setIsProjected] = useState(false);
  const [hideValues, setHideValues] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');

  useEffect(() => {
    fetchTransactions();
    fetchHealthLogs();
    fetchAgendaItems();
    fetchInboxTasks();
    if (fetchKanbanTasks) fetchKanbanTasks();
  }, [fetchTransactions, fetchHealthLogs, fetchAgendaItems, fetchInboxTasks, fetchKanbanTasks]);

  // =========================================================================
  // 1. MOTOR FINANCEIRO UNIFICADO (Mesma regra contábil do Financeiro.jsx)
  // =========================================================================
  const {
    filteredTransactions,
    displayReceitas,
    displayDespesas,
    displayBalancoMensal,
    displaySaldoGlobal,
    displayTotalInvestido,
    aPagar,
    taxaPoupancaMes
  } = useFinanceMetrics({
    transactions,
    filterMonth,
    filterYear,
    isProjected
  });

  // =========================================================================
  // 2. NAVEGAÇÃO TEMPORAL
  // =========================================================================
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

  const saudacaoContextual = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // =========================================================================
  // 3. INTELIGÊNCIA DE AGENDA, TAREFAS, KANBAN E ALERTAS DE VENCIMENTO
  // =========================================================================
  const { 
    dataDeHojeStr, 
    eventosDeHoje, 
    tarefasPendentes, 
    tarefasAtrasadasCount,
    porcentagemProgresso, 
    proximoEvento,
    contasUrgentes,
    projetosEmAndamento
  } = useMemo(() => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const hojeISO = `${yyyy}-${mm}-${dd}`;

    // Limite de 5 dias à frente para radar de contas a pagar
    const limiteAlerta = new Date(hoje);
    limiteAlerta.setDate(limiteAlerta.getDate() + 5);
    const limiteISO = `${limiteAlerta.getFullYear()}-${String(limiteAlerta.getMonth() + 1).padStart(2, '0')}-${String(limiteAlerta.getDate()).padStart(2, '0')}`;

    const eventos = (agendaItems || [])
      .filter(item => item.date === hojeISO)
      .sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

    // Inclui tarefas de hoje + tarefas não concluídas de dias anteriores (para nada ficar esquecido)
    const pendentes = (inboxTasks || [])
      .filter(t => !t.completed && (!t.date || t.date <= hojeISO))
      .sort((a, b) => (a.date || hojeISO).localeCompare(b.date || hojeISO));

    const atrasadas = pendentes.filter(t => t.date && t.date < hojeISO).length;

    const totaisHoje = (inboxTasks || []).filter(t => !t.date || t.date === hojeISO);
    const concluidasHoje = totaisHoje.filter(t => t.completed).length;
    const progresso = totaisHoje.length === 0 ? 0 : Math.round((concluidasHoje / totaisHoje.length) * 100);
    
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const eventoSeguinte = eventos.find(e => (e.time || '24:00') >= horaAtual);

    // Contas pendentes vencidas ou que vencem nos próximos 5 dias
    const urgentes = (transactions || [])
      .filter(t => {
        if ((t.status || 'pago') !== 'pendente' || t.type !== 'despesa') return false;
        const iso = normalizeDateISO(t.date);
        return iso <= limiteISO;
      })
      .sort((a, b) => normalizeDateISO(a.date).localeCompare(normalizeDateISO(b.date)))
      .slice(0, 3);

    const emAndamento = (kanbanTasks || []).filter(k => k.status === 'in-progress').slice(0, 3);

    return { 
      dataDeHojeStr: hojeISO,
      eventosDeHoje: eventos, 
      tarefasPendentes: pendentes,
      tarefasAtrasadasCount: atrasadas,
      porcentagemProgresso: progresso,
      proximoEvento: eventoSeguinte,
      contasUrgentes: urgentes,
      projetosEmAndamento: emAndamento
    };
  }, [agendaItems, inboxTasks, transactions, kanbanTasks]);

  const handleQuickTaskSubmit = async (e) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    await addInboxTask(quickTaskTitle.trim(), dataDeHojeStr);
    setQuickTaskTitle('');
  };

  // =========================================================================
  // 4. MÉTRICAS DE SAÚDE E GRÁFICO FINANCEIRO
  // =========================================================================
  const filteredHealthLogs = useMemo(() => {
    return (healthLogs || []).filter(l => {
      const dateStr = l.date || l.created_at;
      if (!dateStr) return true;
      const cleanDate = normalizeDateISO(String(dateStr).substring(0, 10));
      const [y, m] = cleanDate.split('-');
      if (filterYear !== y) return false;
      if (filterMonth !== 'all' && filterMonth !== m) return false;
      return true;
    });
  }, [healthLogs, filterMonth, filterYear]);

  const totalTreinos = filteredHealthLogs.filter(l => l.type === 'treino').length;
  
  const ultimoPeso = useMemo(() => {
    return (healthLogs || [])
      .filter(l => l.type === 'peso')
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))[0];
  }, [healthLogs]);

  const ultimasAtividades = useMemo(() => {
    return filteredHealthLogs
      .slice()
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
      .slice(0, 5);
  }, [filteredHealthLogs]);

  // Gráfico de Fluxo Diário (Excluindo transferências de carteira para não distorcer barras)
  const financeChartData = useMemo(() => {
    const agrupado = filteredTransactions.reduce((acc, t) => {
      const rawDate = t.date || t.created_at;
      if (!rawDate) return acc;
      
      const tStatus = t.status || 'pago';
      const deveContar = isProjected ? true : tStatus === 'pago';
      if (!deveContar) return acc;

      // Ignora transferências patrimoniais (Aporte/Resgate) nas barras de Receita/Despesa operacional
      if (t.category === 'Aporte de Investimento' || t.category === 'Resgate de Investimento') {
        return acc;
      }

      const iso = normalizeDateISO(String(rawDate).substring(0, 10));
      const [year, month, day] = iso.split('-');
      const dateKey = `${day}/${month}`;
      const sortDateObj = new Date(`${year}-${month}-${day}T12:00:00`);
      
      let existing = acc.find(item => item.date === dateKey);
      if (!existing) {
        existing = { date: dateKey, Receitas: 0, Despesas: 0, rawDate: sortDateObj };
        acc.push(existing);
      }
      
      if (t.type === 'receita' || t.type === 'income') existing.Receitas += Number(t.amount || 0);
      if (t.type === 'despesa' || t.type === 'expense') existing.Despesas += Number(t.amount || 0);
      
      return acc;
    }, []);

    const sorted = agrupado.sort((a, b) => a.rawDate - b.rawDate);
    
    let saldoAcumulado = 0;
    return sorted.map(item => {
      saldoAcumulado += (item.Receitas - item.Despesas);
      return { ...item, Saldo: saldoAcumulado };
    });
  }, [filteredTransactions, isProjected]);

  const pesoChartData = useMemo(() => {
    return (healthLogs || [])
      .filter(l => l.type === 'peso')
      .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))
      .map(l => {
        const rawDate = l.date || l.created_at;
        const iso = normalizeDateISO(String(rawDate).substring(0, 10));
        const [, month, day] = iso.split('-');
        return { date: `${day}/${month}`, peso: Number(l.value || 0) };
      });
  }, [healthLogs]);

  const formatMoneyUI = (val, prefix = '') => {
    if (hideValues) return 'R$ •••••';
    return `${prefix}${Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  };

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">
      
      {/* CABEÇALHO DO CENTRO DE COMANDO */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-lg shadow-indigo-500/10">
            <LayoutGrid className="text-indigo-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {saudacaoContextual}, Yuri
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              Centro de Comando • {eventosDeHoje.length} {eventosDeHoje.length === 1 ? 'compromisso' : 'compromissos'} e {tarefasPendentes.length} {tarefasPendentes.length === 1 ? 'pendência' : 'pendências'} hoje
            </p>
          </div>
        </div>

        {/* CONTROLES DE PRIVACIDADE, PROJEÇÃO E MÊS */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setHideValues(!hideValues)}
            title={hideValues ? "Mostrar valores" : "Ocultar valores"}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all shadow-lg shrink-0"
          >
            {hideValues ? <EyeOff size={18} className="text-amber-400" /> : <Eye size={18} />}
          </button>

          <button 
            onClick={() => setIsProjected(!isProjected)}
            className={`flex-1 sm:flex-none items-center justify-center flex gap-2 px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-lg ${
              isProjected 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/30 border border-indigo-500/50' 
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <Sparkles size={16} className={isProjected ? "animate-pulse" : ""} />
            <span className="hidden sm:inline">{isProjected ? 'Projeção Ativa' : 'Visão Real'}</span>
            <span className="sm:hidden">{isProjected ? 'Projeção' : 'Real'}</span>
          </button>

          {/* NAVEGADOR TEMPORAL */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-xl flex-1 sm:flex-none justify-between">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex-1 flex justify-center relative min-w-[125px]" onClick={() => setIsPickerOpen(!isPickerOpen)}>
              <div className="flex items-center justify-center gap-2 cursor-pointer py-1 px-2 hover:text-white transition-colors group">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-200 capitalize tracking-wide truncate group-hover:text-white transition-colors">
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
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* BLOCO SUPERIOR: 4 CARDS DE MÉTRICAS SINCRONIZADOS */}
        <div className="lg:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          
          {/* 1. SALDO EM CONTA + FLUXO DO MÊS */}
          <StatCard 
            title={isProjected ? "Saldo em Conta (Proj)" : "Saldo em Conta"} 
            icon={Wallet} 
            colorClass="text-indigo-400"
            mainValue={formatMoneyUI(displaySaldoGlobal)}
            subtext={
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 mt-1 block truncate">
                Balanço do Mês: <strong className={displayBalancoMensal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {formatMoneyUI(displayBalancoMensal, displayBalancoMensal >= 0 ? '+' : '')}
                </strong>
              </span>
            }
            footerContent={
              <>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px] sm:text-xs">
                  <TrendingUp size={12} className="shrink-0"/> 
                  <span className="truncate">{formatMoneyUI(displayReceitas)}</span>
                </span>
                <span className="text-rose-400 flex items-center gap-1 font-mono text-[10px] sm:text-xs">
                  <TrendingDown size={12} className="shrink-0"/> 
                  <span className="truncate">{formatMoneyUI(displayDespesas)}</span>
                </span>
              </>
            }
          />

          {/* 2. PATRIMÔNIO INVESTIDO + TAXA DE POUPANÇA */}
          <StatCard 
            title="Total Investido" 
            icon={PiggyBank} 
            colorClass="text-emerald-400"
            mainValue={formatMoneyUI(displayTotalInvestido)}
            subtext={
              <span className="text-[10px] sm:text-xs font-semibold text-slate-400 mt-1 block truncate">
                Taxa de Aporte (Mês): <strong className="text-emerald-300">{taxaPoupancaMes}%</strong>
              </span>
            }
            footerContent={
              <span className="text-[10px] sm:text-xs text-slate-400 truncate">
                A Pagar no Mês: <strong className="font-mono text-amber-400">{formatMoneyUI(aPagar)}</strong>
              </span>
            }
          />

          {/* 3. FITNESS & COMPOSIÇÃO CORPORAL */}
          <StatCard 
            title="Treinos no Mês" 
            icon={Dumbbell} 
            colorClass="text-cyan-400"
            mainValue={<>{totalTreinos} <span className="text-xs sm:text-sm font-medium text-slate-400 ml-1">sessões</span></>}
            subtext={
              <span className="text-[10px] sm:text-xs text-slate-400 mt-1 block truncate">
                Ritmo: <strong className="text-cyan-300">{Math.min(100, Math.round((totalTreinos / 16) * 100))}% da meta (16/mês)</strong>
              </span>
            }
            footerContent={
              <span className="text-[10px] sm:text-xs text-slate-400 truncate">
                Peso atual: <strong className="font-mono text-cyan-300">{ultimoPeso ? `${ultimoPeso.value} ${ultimoPeso.unit || 'kg'}` : '--'}</strong>
              </span>
            }
          />

          {/* 4. EXECUÇÃO DIÁRIA */}
          <StatCard 
            title="Execução Diária" 
            icon={Target} 
            colorClass="text-purple-400"
            mainValue={`${porcentagemProgresso}%`}
            subtext={
              <span className="flex items-center gap-1.5 mt-1">
                <Clock size={12} className="text-purple-400 shrink-0" />
                {proximoEvento ? (
                  <span className="truncate text-slate-300 text-[10px] sm:text-xs font-medium">
                    {proximoEvento.time ? `${proximoEvento.time.substring(0,5)} • ` : ''}{proximoEvento.title}
                  </span>
                ) : (
                  <span className="text-slate-500 text-[10px] sm:text-xs truncate">Sem horários pendentes hoje</span>
                )}
              </span>
            }
            footerContent={
              <div className="w-full bg-black/40 rounded-full h-1.5 mt-1.5 border border-white/5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(99,102,241,0.6)]" 
                  style={{ width: `${porcentagemProgresso}%` }}
                />
              </div>
            }
          />
        </div>

        {/* COLUNA ESQUERDA (POMODORO + GRÁFICOS) */}
        <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6">
          
          <div className="w-full relative z-10 bg-black/20 rounded-[2.5rem] border border-white/5 p-1 shadow-inner">
            <PomodoroWidget />
          </div>

          {/* GRÁFICO COMPOSTO UNIFICADO */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400 shrink-0" /> 
                  Fluxo de Caixa Operacional
                  {isProjected && (
                    <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-md ml-1">
                      Projetado
                    </span>
                  )}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Entradas e saídas diárias vs. evolução do saldo líquido no período
                </p>
              </div>
            </div>
            
            <div className="flex flex-col h-72 sm:h-80 w-full">
              <div className="flex-1 w-full relative">
                {financeChartData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs sm:text-sm font-medium border border-dashed border-white/10 rounded-2xl">
                    Sem movimentações operacionais neste período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeChartData} margin={{ top: 10, right: 0, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      
                      <YAxis 
                        yAxisId="left" 
                        stroke="#ffffff40" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => hideValues ? '•••' : formatCompactCurrency(v)} 
                        width={45} 
                      />
                      
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="#818cf8" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => hideValues ? '•••' : formatCompactCurrency(v)} 
                        width={45} 
                      />
                      
                      <RechartsTooltip content={<CustomFinanceTooltip hideValues={hideValues} />} cursor={{fill: '#ffffff05'}} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', paddingTop: '12px' }} iconType="circle" />
                      
                      <Bar yAxisId="left" name="Receitas" dataKey="Receitas" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={18} />
                      <Bar yAxisId="left" name="Despesas" dataKey="Despesas" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={18} />
                      
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

        {/* COLUNA DIREITA (AÇÃO RÁPIDA, ALERTAS FINANCEIROS, KANBAN E FEED) */}
        <div className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">
          
          {/* CARD 1: FOCO DE HOJE + CAPTURA RÁPIDA */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Target size={18} className="text-indigo-400" /> Foco de Hoje
              </h3>
              <span className="text-[10px] sm:text-xs font-bold text-slate-300 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            </div>

            {/* RADAR DE CONTAS A VENCER (Aparece apenas se houver conta pendente próxima/vencida) */}
            {contasUrgentes.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                    <AlertCircle size={13} className="text-amber-400" /> Vencimentos Próximos
                  </span>
                  <span className="text-[10px] font-bold text-amber-400/80">{contasUrgentes.length} pendente(s)</span>
                </div>
                <div className="space-y-1.5">
                  {contasUrgentes.map(conta => (
                    <div key={conta.id} className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl border border-white/5 text-xs">
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-200 block truncate">{conta.description.split(' [')[0]}</span>
                        <span className="text-[10px] text-amber-300/80 font-mono">{conta.date.split('-').reverse().slice(0,2).join('/')}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-amber-300">
                          {formatMoneyUI(conta.amount)}
                        </span>
                        <button
                          onClick={() => toggleTransactionStatus(conta.id)}
                          title="Dar baixa agora"
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg border border-emerald-500/30 transition-colors"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* COMPROMISSOS DA AGENDA */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CalendarIcon size={13} className="text-cyan-400" /> Agenda do Dia
              </h4>
              {eventosDeHoje.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium bg-black/20 p-3.5 rounded-xl border border-white/5 text-center">
                  Nenhum compromisso com horário hoje.
                </p>
              ) : (
                eventosDeHoje.map(evento => (
                  <div key={evento.id} className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl transition-all hover:bg-indigo-500/20 group">
                    <span className="text-xs sm:text-sm text-slate-200 font-bold truncate pr-2 group-hover:text-white">
                      {evento.title}
                    </span>
                    {evento.time && (
                      <span className="text-[10px] font-bold font-mono text-indigo-300 bg-indigo-950/80 px-2 py-1 rounded-lg shrink-0">
                        {evento.time.substring(0,5)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* INBOX PENDENTE + QUICK CAPTURE */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckSquare size={13} className="text-indigo-400" /> Tarefas Pendentes
                </h4>
                {tarefasAtrasadasCount > 0 && (
                  <span className="text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md">
                    {tarefasAtrasadasCount} atrasada(s)
                  </span>
                )}
              </div>

              {/* Input Rápido para Adicionar Tarefa sem sair do Dashboard */}
              <form onSubmit={handleQuickTaskSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder="Nova tarefa rápida para hoje..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!quickTaskTitle.trim()}
                  className="p-2 bg-indigo-600/30 hover:bg-indigo-600/50 disabled:opacity-40 text-indigo-300 rounded-xl border border-indigo-500/30 transition-colors shrink-0"
                  title="Adicionar Tarefa"
                >
                  <Plus size={16} />
                </button>
              </form>

              {tarefasPendentes.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium bg-black/20 p-3.5 rounded-xl border border-white/5 text-center">
                  Sua lista de tarefas está limpa!
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {tarefasPendentes.slice(0, 6).map(task => {
                    const isOverdue = task.date && task.date < dataDeHojeStr;
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => toggleInboxTask(task.id, task.completed)}
                        className={`flex items-center justify-between gap-2.5 p-3 rounded-xl border transition-all group cursor-pointer ${
                          isOverdue 
                            ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10' 
                            : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input 
                            type="checkbox" 
                            checked={task.completed}
                            onChange={() => {}} 
                            className="w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-500 cursor-pointer pointer-events-none shrink-0"
                          />
                          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate group-hover:text-white">
                            {task.title}
                          </span>
                        </div>
                        {isOverdue && (
                          <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded shrink-0">
                            {task.date.split('-').reverse().slice(0,2).join('/')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tarefasPendentes.length > 6 && (
                <div className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-wider bg-black/20 py-1.5 rounded-xl border border-white/5">
                  + {tarefasPendentes.length - 6} tarefas na fila
                </div>
              )}
            </div>

            {/* PROJETOS EM ANDAMENTO (KANBAN) */}
            {projetosEmAndamento.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers size={13} className="text-emerald-400" /> Kanban • Em Andamento
                </h4>
                <div className="space-y-1.5">
                  {projetosEmAndamento.map(proj => (
                    <div key={proj.id} className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs text-slate-300 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></span>
                      <span className="truncate">{proj.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ActivityFeed atividades={ultimasAtividades} />
        </div>

      </main>
    </div>
  );
}
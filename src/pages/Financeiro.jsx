import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { 
  Wallet, Plus, Minus, ArrowUpRight, ArrowDownRight, 
  Tag, Trash2, Pencil, X, PieChart as PieChartIcon,
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, CheckCircle2, Filter,
  Home, Utensils, Car, Lightbulb, HeartPulse, GraduationCap, Laptop, 
  PartyPopper, CreditCard, MoreHorizontal, Briefcase, Landmark, Code, RefreshCw, Coins,
  Eye, Sparkles
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORIAS_RECEITA = ['Salário', 'Bolsa Acadêmica/CNPq', 'Freelance', 'Rendimentos/Investimentos', 'Restituição', 'Outros'];
const CATEGORIAS_DESPESA = ['Alimentação', 'Moradia', 'Transporte', 'Contas Fixas', 'Saúde', 'Educação/Pesquisa', 'Assinaturas/Software', 'Lazer', 'Cartão de Crédito', 'Outros'];

const CORES_GRAFICO = ['#818cf8', '#34d399', '#fbbf24', '#22d3ee', '#a78bfa', '#f472b6', '#fb7185', '#94a3b8', '#38bdf8', '#f87171'];

const MESES = [
  { valor: '01', nome: 'Janeiro' }, { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' }, { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' }, { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' }, { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' }, { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' }, { valor: '12', nome: 'Dezembro' }
];

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Alimentação': return <Utensils size={14} className="text-orange-400" />;
    case 'Moradia': return <Home size={14} className="text-indigo-400" />;
    case 'Transporte': return <Car size={14} className="text-sky-400" />;
    case 'Contas Fixas': return <Lightbulb size={14} className="text-yellow-400" />;
    case 'Saúde': return <HeartPulse size={14} className="text-rose-400" />;
    case 'Educação/Pesquisa': return <GraduationCap size={14} className="text-purple-400" />;
    case 'Assinaturas/Software': return <Laptop size={14} className="text-cyan-400" />;
    case 'Lazer': return <PartyPopper size={14} className="text-fuchsia-400" />;
    case 'Cartão de Crédito': return <CreditCard size={14} className="text-slate-300" />;
    
    case 'Salário': return <Briefcase size={14} className="text-emerald-400" />;
    case 'Bolsa Acadêmica/CNPq': return <Landmark size={14} className="text-blue-400" />;
    case 'Freelance': return <Code size={14} className="text-teal-400" />;
    case 'Rendimentos/Investimentos': return <TrendingUp size={14} className="text-green-400" />;
    case 'Restituição': return <RefreshCw size={14} className="text-emerald-300" />;
    
    default: return <MoreHorizontal size={14} className="text-slate-400" />;
  }
};

const formatCurrency = (value) => {
  let valueString = value.toString().replace(/\D/g, '');
  if (valueString === '') return '';
  const numericValue = parseFloat(valueString) / 100;
  return numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const unmaskCurrency = (formattedValue) => {
  const valueString = formattedValue.toString().replace(/\D/g, '');
  if (valueString === '') return 0;
  return parseFloat(valueString) / 100;
};

const getTodayFormatted = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateToBR = (dateString) => {
  if (!dateString) return '';
  if (dateString.includes('/')) return dateString; 
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-white/10 p-4 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.fill }}></div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{payload[0].name}</p>
        </div>
        <p className="text-lg font-mono font-medium text-white">
          {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>
    );
  }
  return null;
};

export default function Financeiro() {
  const { transactions, addTransaction, removeTransaction, updateTransaction, toggleTransactionStatus, fetchTransactions } = useFinanceStore();
  
  const formRef = useRef(null);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('receita');
  const [category, setCategory] = useState(CATEGORIAS_RECEITA[0]);
  const [date, setDate] = useState(getTodayFormatted());
  const [status, setStatus] = useState('pago');
  const [editingId, setEditingId] = useState(null);

  // ESTADO DO MODO PROJEÇÃO
  const [isProjected, setIsProjected] = useState(false);

  const currentYear = new Date().getFullYear().toString();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  useEffect(() => {
    if (!editingId) {
      setCategory(type === 'receita' ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0]);
    }
  }, [type, editingId]);

  const availableYears = useMemo(() => {
    const years = transactions.map(t => {
      return t.date.includes('/') ? t.date.split('/')[2] : t.date.split('-')[0];
    });
    const uniqueYears = [...new Set(years)];
    if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
    return uniqueYears.sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYear]);

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

  // CÁLCULOS SEPARADOS (PAGOS E PENDENTES)
  const { receitasPagas, despesasPagas, aPagar, aReceber } = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const tStatus = t.status || 'pago';
      const valor = Number(t.amount) || 0;
      
      if (t.type === 'receita') {
        if (tStatus === 'pago') acc.receitasPagas += valor;
        else acc.aReceber += valor;
      } else {
        if (tStatus === 'pago') acc.despesasPagas += valor;
        else acc.aPagar += valor;
      }
      
      return acc;
    }, { receitasPagas: 0, despesasPagas: 0, aPagar: 0, aReceber: 0 });
  }, [filteredTransactions]);

  // VALORES EXIBIDOS COM BASE NO MODO PROJEÇÃO
  const displayReceitas = isProjected ? receitasPagas + aReceber : receitasPagas;
  const displayDespesas = isProjected ? despesasPagas + aPagar : despesasPagas;
  const displayBalanco = displayReceitas - displayDespesas;

  const despesasPorCategoria = useMemo(() => {
    // No modo projetado, inclui as despesas pendentes no gráfico
    const despesas = filteredTransactions.filter(t => t.type === 'despesa' && (isProjected ? true : (t.status || 'pago') === 'pago'));
    const agrupado = despesas.reduce((acc, transacao) => {
      const index = acc.findIndex(item => item.name === transacao.category);
      if (index !== -1) acc[index].value += transacao.amount;
      else acc.push({ name: transacao.category, value: transacao.amount });
      return acc;
    }, []);
    return agrupado.sort((a, b) => b.value - a.value);
  }, [filteredTransactions, isProjected]);

  const handleAmountChange = (e) => setAmount(formatCurrency(e.target.value));

  const handleSubmit = (e) => {
    e.preventDefault();
    const numericAmount = unmaskCurrency(amount);
    if (!numericAmount || !description) return;
    
    const transactionData = {
      id: editingId || Date.now(),
      amount: numericAmount,
      description,
      type,
      category,
      date,
      status
    };

    if (editingId) updateTransaction(transactionData);
    else addTransaction(transactionData);

    resetForm();
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    setDescription(t.description);
    const stringAmount = t.amount.toFixed(2).replace('.', '');
    setAmount(formatCurrency(stringAmount));
    setType(t.type);
    setCategory(t.category);
    if (t.date && t.date.includes('/')) {
      const [d, m, y] = t.date.split('/');
      setDate(`${y}-${m}-${d}`);
    } else {
      setDate(t.date || getTodayFormatted());
    }
    setStatus(t.status || 'pago');
    
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setDescription('');
    setType('receita');
    setCategory(CATEGORIAS_RECEITA[0]);
    setDate(getTodayFormatted());
    setStatus('pago');
  };

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const dateA = a.date.includes('/') ? a.date.split('/').reverse().join('') : a.date;
    const dateB = b.date.includes('/') ? b.date.split('/').reverse().join('') : b.date;
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">
      
      {/* Cabeçalho com Filtros */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-lg shadow-indigo-500/10">
            <Wallet className="text-indigo-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Centro Financeiro</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Gestão de Recursos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          
          {/* BOTÃO DE MODO PROJEÇÃO */}
          <button 
            onClick={() => setIsProjected(!isProjected)}
            className={`flex-1 sm:flex-none items-center justify-center flex gap-2 px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-lg ${
              isProjected 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/30 border border-indigo-500/50' 
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            {isProjected ? <Sparkles size={16} className="animate-pulse"/> : <Eye size={16} />}
            <span>{isProjected ? 'Projeção Ativa' : 'Visão Atual'}</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-xl flex-1 sm:flex-none">
            <div className="pl-3 sm:pl-4 text-slate-400 hidden sm:block">
              <Filter size={16} />
            </div>
            <select 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-base sm:text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer py-1.5 hover:text-white transition-colors flex-1"
            >
              <option value="all" className="bg-slate-900 text-slate-200">Visão Anual</option>
              {MESES.map(m => (
                <option key={m.valor} value={m.valor} className="bg-slate-900 text-slate-200">{m.nome}</option>
              ))}
            </select>
            <div className="w-px h-5 sm:h-6 bg-white/10"></div>
            <select 
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-transparent text-base sm:text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer py-1.5 pr-2 sm:pr-4 hover:text-white transition-colors"
            >
              {availableYears.map(year => (
                <option key={year} value={year} className="bg-slate-900 text-slate-200">{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Cards de Resumo */}
      <div className="w-full max-w-7xl grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
        
        <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex justify-between items-center mb-3 sm:mb-6 relative z-10">
            <span className="text-[10px] sm:text-sm font-semibold text-slate-400 tracking-wide uppercase truncate mr-2">
              {isProjected ? 'Receitas (Projetadas)' : 'Receitas (Pagas)'}
            </span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/10 rounded-lg sm:rounded-xl shrink-0">
              <TrendingUp className="text-emerald-400 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="font-mono text-base sm:text-2xl font-bold text-emerald-400 relative z-10 truncate transition-all duration-300">
            {displayReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex justify-between items-center mb-3 sm:mb-6 relative z-10">
            <span className="text-[10px] sm:text-sm font-semibold text-slate-400 tracking-wide uppercase truncate mr-2">
              {isProjected ? 'Despesas (Projetadas)' : 'Despesas (Pagas)'}
            </span>
            <div className="p-1.5 sm:p-2.5 bg-rose-500/10 rounded-lg sm:rounded-xl shrink-0">
              <TrendingDown className="text-rose-400 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="font-mono text-base sm:text-2xl font-bold text-rose-400 relative z-10 truncate transition-all duration-300">
            {displayDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        {/* Card 3: Alterna entre A Pagar e A Receber dependendo da Projeção */}
        <div className={`bg-gradient-to-br border rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group transition-all duration-300 ${isProjected ? 'from-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/30' : 'from-amber-500/10 border-amber-500/20 hover:border-amber-500/30'}`}>
          <div className="flex justify-between items-center mb-3 sm:mb-6 relative z-10">
            <span className={`text-[10px] sm:text-sm font-semibold tracking-wide uppercase truncate mr-2 ${isProjected ? 'text-cyan-200/70' : 'text-amber-200/70'}`}>
              {isProjected ? 'A Receber' : 'A Pagar'}
            </span>
            <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${isProjected ? 'bg-cyan-500/20' : 'bg-amber-500/20'}`}>
              {isProjected ? <ArrowUpRight className="text-cyan-400 w-3 h-3 sm:w-5 sm:h-5" /> : <Clock className="text-amber-400 w-3 h-3 sm:w-5 sm:h-5" />}
            </div>
          </div>
          <div className={`font-mono text-base sm:text-2xl font-bold relative z-10 truncate transition-all duration-300 ${isProjected ? 'text-cyan-400' : 'text-amber-400'}`}>
            {(isProjected ? aReceber : aPagar).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div className={`bg-gradient-to-br border rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group transition-all duration-300 ${isProjected ? 'from-indigo-600/20 border-indigo-500/40 hover:border-indigo-500/60 shadow-indigo-500/10' : 'from-indigo-500/20 border-indigo-500/30 hover:border-indigo-500/40'}`}>
          <div className="flex justify-between items-center mb-3 sm:mb-6 relative z-10">
            <span className={`text-[10px] sm:text-sm font-bold tracking-wide uppercase truncate mr-2 ${isProjected ? 'text-white' : 'text-indigo-200/70'}`}>
              {isProjected ? 'Balanço Final' : 'Balanço Atual'}
            </span>
            <div className="p-1.5 sm:p-2.5 bg-indigo-500/20 rounded-lg sm:rounded-xl shrink-0">
              <DollarSign className="text-indigo-300 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className={`font-mono text-base sm:text-2xl font-bold relative z-10 truncate transition-all duration-300 ${displayBalanco >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {displayBalanco >= 0 ? '+' : ''}{displayBalanco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Formulário + Gráfico */}
        <div className="lg:col-span-1 flex flex-col gap-6 sticky top-20">
          
          <div ref={formRef} className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl scroll-mt-24">
            <div className="flex justify-between items-center mb-5 sm:mb-6">
              <h2 className="text-base sm:text-lg font-bold text-white">
                {editingId ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/20 transition-all flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Descrição</label>
                <input 
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all placeholder:text-slate-600"
                  placeholder="Ex: Aluguel, Supermercado..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Valor</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all font-mono placeholder:text-slate-600"
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Categoria</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all cursor-pointer"
                  >
                    {(type === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(cat => (
                      <option key={cat} value={cat} className="bg-slate-900 text-slate-200">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Data</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="pago" className="bg-slate-900 text-emerald-400">Pago</option>
                    <option value="pendente" className="bg-slate-900 text-amber-400">Pendente</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setType('receita')}
                  className={`flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all ${type === 'receita' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)]' : 'bg-black/20 border-transparent text-slate-500 hover:text-slate-300 hover:bg-black/40'}`}
                >
                  <Plus size={16} /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => setType('despesa')}
                  className={`flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all ${type === 'despesa' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 'bg-black/20 border-transparent text-slate-500 hover:text-slate-300 hover:bg-black/40'}`}
                >
                  <Minus size={16} /> Despesa
                </button>
              </div>
              
              <button 
                type="submit"
                className={`w-full mt-2 sm:mt-4 font-bold text-sm p-3.5 sm:p-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${editingId ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-500/25' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40'}`}
              >
                {editingId ? <><RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]"/> Atualizar</> : <><Plus size={16} className="sm:w-[18px] sm:h-[18px]"/> Registrar</>}
              </button>
            </form>
          </div>

          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl h-[300px] sm:h-[360px] flex flex-col hidden md:flex transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PieChartIcon className="text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Mapa de Despesas {isProjected && <span className="text-cyan-400 text-xs">(Projetado)</span>}
                </h2>
              </div>
            </div>
            
            <div className="flex-1 w-full relative">
              {despesasPorCategoria.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs sm:text-sm text-center px-4">
                  Nenhuma despesa para este período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasPorCategoria}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {despesasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={40} 
                      iconType="circle"
                      formatter={(value) => <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 ml-1">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Feed de Transações */}
        <div className="lg:col-span-2 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-4 sm:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[400px] max-h-[800px] sm:max-h-[960px]">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-bold text-white">Extrato Detalhado</h2>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-400 bg-white/5 px-2 sm:px-3 py-1 rounded-full border border-white/10">
              {sortedTransactions.length} registros
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 space-y-2.5 sm:space-y-3">
            {sortedTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                <Coins size={40} className="text-slate-600/50 sm:w-12 sm:h-12" />
                <p className="text-xs sm:text-sm">O extrato deste período está vazio.</p>
              </div>
            ) : (
              sortedTransactions.map((t) => {
                const isPendente = (t.status || 'pago') === 'pendente';
                const isReceita = t.type === 'receita';
                
                return (
                  <div key={t.id} className={`group flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-black/20 border rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-lg ${isPendente ? 'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5' : 'border-white/5 hover:border-white/10 hover:bg-white/5'}`}>
                    <div className="flex items-center gap-3 sm:gap-4">
                      
                      <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border flex items-center justify-center shadow-inner shrink-0 ${isPendente ? 'bg-amber-500/10 border-amber-500/20' : isReceita ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        {getCategoryIcon(t.category)}
                      </div>

                      <div className="overflow-hidden">
                        <div className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors truncate">
                          {t.description}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-slate-400">
                            <Calendar size={10} className="sm:w-[11px] sm:h-[11px]"/> {formatDateToBR(t.date)}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10 truncate max-w-[100px] sm:max-w-none">
                            <Tag size={9} className="shrink-0"/> <span className="truncate">{t.category}</span>
                          </span>
                          {isPendente && (
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                              A Pagar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto mt-2.5 sm:mt-0 pt-2.5 sm:pt-0 border-t border-white/5 sm:border-0">
                      <div className={`font-mono font-bold text-base sm:text-lg tracking-tight ${isPendente ? 'text-amber-400/80' : isReceita ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {isReceita ? '+' : '-'} R$ {t.amount.toFixed(2)}
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPendente && (
                          <button 
                            onClick={() => toggleTransactionStatus(t.id)}
                            title="Dar Baixa"
                            className="flex items-center justify-center p-1.5 sm:p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleEdit(t)}
                          title="Editar"
                          className="text-slate-400 hover:text-indigo-400 p-1.5 sm:p-2 rounded-lg hover:bg-indigo-500/10 transition-all"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => removeTransaction(t.id)}
                          title="Excluir"
                          className="text-slate-400 hover:text-rose-400 p-1.5 sm:p-2 rounded-lg hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
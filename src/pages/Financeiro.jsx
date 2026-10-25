import React, { useState, useEffect, useRef } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useFinanceMetrics } from '../hooks/useFinanceMetrics';
import {
  CATEGORIAS_RECEITA,
  CATEGORIAS_DESPESA,
  CORES_GRAFICO,
  MESES,
  getCategoryIcon,
  formatCurrency,
  unmaskCurrency,
  getTodayFormatted,
  normalizeDateISO,
  addMonthsToDate,
  parseFaturaDescription,
  serializeFaturaDescription
} from '../utils/financeUtils';
import { 
  Wallet, Plus, Minus, ArrowUpRight, Tag, Trash2, Pencil, X, 
  PieChart as PieChartIcon, TrendingUp, TrendingDown, Calendar, 
  Clock, CheckCircle2, Filter, CreditCard, RefreshCw, Coins, 
  Eye, EyeOff, Sparkles, PiggyBank, Landmark as Bank, Search, Repeat
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CustomTooltip = ({ active, payload, hideValues }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-white/10 p-4 rounded-2xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].payload.fill }}></div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{payload[0].name}</p>
        </div>
        <p className="text-lg font-mono font-medium text-white">
          {hideValues 
            ? 'R$ •••••' 
            : payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>
    );
  }
  return null;
};

export default function Financeiro() {
  const { transactions, addTransaction, deleteTransaction, updateTransaction, toggleTransactionStatus, fetchTransactions } = useFinanceStore();
  const formRef = useRef(null);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ESTADOS DO FORMULÁRIO
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('receita');
  const [category, setCategory] = useState(CATEGORIAS_RECEITA[0]);
  const [date, setDate] = useState(getTodayFormatted());
  const [status, setStatus] = useState('pago');
  const [installments, setInstallments] = useState(1);
  const [editingId, setEditingId] = useState(null);

  // ESTADOS DO CARRINHO DE CARTÃO DE CRÉDITO
  const [cartItems, setCartItems] = useState([]);
  const [cartItemName, setCartItemName] = useState('');
  const [cartItemValue, setCartItemValue] = useState('');
  const [faturaModal, setFaturaModal] = useState({ isOpen: false, transaction: null, items: [] });

  // ESTADOS GERAIS, PRIVACIDADE E FILTROS
  const [isProjected, setIsProjected] = useState(false);
  const [hideValues, setHideValues] = useState(false);
  const [chartType, setChartType] = useState('despesa');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const currentYear = new Date().getFullYear().toString();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  useEffect(() => {
    if (!editingId) {
      setCategory(type === 'receita' ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0]);
      setCartItems([]); 
    }
  }, [type, editingId]);

  // HOOK DE MÉTRICAS E MOTOR FINANCEIRO
  const {
    availableYears,
    sortedTransactions,
    groupedTransactions,
    displayReceitas,
    displayDespesas,
    displayBalancoMensal,
    displaySaldoGlobal,
    displayTotalInvestido,
    aPagar,
    aReceber,
    taxaPoupancaMes,
    chartData,
    chartTotalValue
  } = useFinanceMetrics({
    transactions,
    filterMonth,
    filterYear,
    isProjected,
    chartType,
    searchTerm,
    statusFilter
  });

  // HANDLERS DO FORMULÁRIO E CARRINHO
  const handleAmountChange = (e) => setAmount(formatCurrency(e.target.value));

  const handleAddCartItem = () => {
    const val = unmaskCurrency(cartItemValue);
    if (!cartItemName.trim() || !val) return;
    
    const newItems = [...cartItems, { id: Date.now(), nome: cartItemName.trim(), valor: val }];
    setCartItems(newItems);
    setCartItemName('');
    setCartItemValue('');

    const total = newItems.reduce((acc, curr) => acc + curr.valor, 0);
    setAmount(formatCurrency((total * 100).toFixed(0)));
  };

  const handleCartKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCartItem();
    }
  };

  const handleRemoveCartItem = (id) => {
    const newItems = cartItems.filter(i => i.id !== id);
    setCartItems(newItems);
    const total = newItems.reduce((acc, curr) => acc + curr.valor, 0);
    setAmount(total > 0 ? formatCurrency((total * 100).toFixed(0)) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numericAmount = unmaskCurrency(amount);
    
    let baseDescription = description.trim();
    if (category === 'Cartão de Crédito' && cartItems.length > 0 && !baseDescription) {
      baseDescription = 'Fatura Cartão de Crédito';
    }

    if (!numericAmount || !baseDescription) return;

    try {
      if (editingId) {
        await updateTransaction({
          id: editingId,
          amount: numericAmount,
          description: serializeFaturaDescription(baseDescription, category, cartItems),
          type,
          category,
          date,
          status
        });
      } else {
        const totalParc = Math.max(1, Number(installments) || 1);
        const batchPayloads = [];

        for (let i = 0; i < totalParc; i++) {
          const parcelDesc = totalParc > 1 ? `${baseDescription} (${i + 1}/${totalParc})` : baseDescription;
          batchPayloads.push({
            amount: numericAmount,
            description: serializeFaturaDescription(parcelDesc, category, cartItems),
            type,
            category,
            date: i === 0 ? date : addMonthsToDate(date, i),
            status: i === 0 ? status : 'pendente'
          });
        }

        // Envia tudo em 1 única requisição para o Supabase!
        await addTransaction(batchPayloads);
      }

      resetForm();
    } catch (err) {
      console.error("Falha ao salvar lançamento:", err);
    }
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    const { mainTitle, items } = parseFaturaDescription(t.description, t.category);
    
    setDescription(mainTitle);
    setCartItems(items);
    
    const stringAmount = Number(t.amount).toFixed(2).replace('.', '');
    setAmount(formatCurrency(stringAmount));
    setType(t.type);
    setCategory(t.category);
    setDate(normalizeDateISO(t.date));
    setStatus(t.status || 'pago');
    setInstallments(1);
    
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
    setInstallments(1);
    setCartItems([]);
    setCartItemName('');
    setCartItemValue('');
  };

  const renderMoney = (val, prefix = '') => {
    const formatted = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return (
      <span className={`transition-all duration-200 ${hideValues ? 'blur-md select-none' : ''}`}>
        {prefix}{formatted}
      </span>
    );
  };

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw]">
      
      {/* Cabeçalho */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-lg shadow-indigo-500/10">
            <Wallet className="text-indigo-400 w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Centro Financeiro</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Gestão Inteligente de Patrimônio & Fluxo</p>
          </div>
        </div>

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
            type="button"
            onClick={() => setIsProjected(!isProjected)}
            className={`flex-1 sm:flex-none items-center justify-center flex gap-2 px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-lg ${
              isProjected 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/30 border border-indigo-500/50' 
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <Sparkles size={16} className={isProjected ? "animate-pulse" : ""} />
            <span>{isProjected ? 'Projeção Ativa' : 'Visão Real'}</span>
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

      {/* 5 Cards de Resumo */}
      <div className="w-full max-w-7xl grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5 mb-6 sm:mb-8">
        
        {/* CARD DE INVESTIMENTOS */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-600/20 to-teal-500/10 border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
          <div className="flex justify-between items-center mb-2 sm:mb-4 relative z-10">
            <span className="text-[10px] sm:text-sm font-bold tracking-wide uppercase truncate mr-2 text-emerald-200/80">
              Total Investido
            </span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/20 rounded-lg sm:rounded-xl shrink-0">
              <PiggyBank className="text-emerald-300 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="font-mono text-base sm:text-2xl font-bold relative z-10 truncate text-emerald-400">
            {renderMoney(displayTotalInvestido)}
          </div>
          <div className="text-[10px] sm:text-xs font-semibold mt-1.5 sm:mt-2 text-emerald-200/70 truncate relative z-10">
            Taxa de Aporte (Mês): <span className="text-emerald-300 font-bold">{taxaPoupancaMes}%</span>
          </div>
        </div>

        {/* RECEITAS OPERACIONAIS */}
        <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex justify-between items-center mb-2 sm:mb-4 relative z-10">
            <span className="text-[10px] sm:text-sm font-semibold text-slate-400 tracking-wide uppercase truncate mr-2">
              {isProjected ? 'Receitas (Proj)' : 'Receitas'}
            </span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-500/10 rounded-lg sm:rounded-xl shrink-0">
              <TrendingUp className="text-emerald-400 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="font-mono text-base sm:text-2xl font-bold text-emerald-400 relative z-10 truncate">
            {renderMoney(displayReceitas)}
          </div>
          <div className="text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 text-slate-500 truncate relative z-10">
            Exclui resgates de carteira
          </div>
        </div>

        {/* DESPESAS OPERACIONAIS */}
        <div className="bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex justify-between items-center mb-2 sm:mb-4 relative z-10">
            <span className="text-[10px] sm:text-sm font-semibold text-slate-400 tracking-wide uppercase truncate mr-2">
              {isProjected ? 'Despesas (Proj)' : 'Despesas'}
            </span>
            <div className="p-1.5 sm:p-2.5 bg-rose-500/10 rounded-lg sm:rounded-xl shrink-0">
              <TrendingDown className="text-rose-400 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="font-mono text-base sm:text-2xl font-bold text-rose-400 relative z-10 truncate">
            {renderMoney(displayDespesas)}
          </div>
          <div className="text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 text-slate-500 truncate relative z-10">
            Exclui aportes de investimento
          </div>
        </div>

        {/* PENDÊNCIAS DO PERÍODO */}
        <div className={`bg-gradient-to-br border rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group transition-all duration-300 ${isProjected ? 'from-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/30' : 'from-amber-500/10 border-amber-500/20 hover:border-amber-500/30'}`}>
          <div className="flex justify-between items-center mb-2 sm:mb-4 relative z-10">
            <span className={`text-[10px] sm:text-sm font-semibold tracking-wide uppercase truncate mr-2 ${isProjected ? 'text-cyan-200/70' : 'text-amber-200/70'}`}>
              {isProjected ? 'A Receber' : 'A Pagar'}
            </span>
            <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${isProjected ? 'bg-cyan-500/20' : 'bg-amber-500/20'}`}>
              {isProjected ? <ArrowUpRight className="text-cyan-400 w-3 h-3 sm:w-5 sm:h-5" /> : <Clock className="text-amber-400 w-3 h-3 sm:w-5 sm:h-5" />}
            </div>
          </div>
          <div className={`font-mono text-base sm:text-2xl font-bold relative z-10 truncate ${isProjected ? 'text-cyan-400' : 'text-amber-400'}`}>
            {renderMoney(isProjected ? aReceber : aPagar)}
          </div>
          <div className="text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 text-slate-400 truncate relative z-10">
            {isProjected ? `A Pagar: R$ ${aPagar.toFixed(0)}` : `A Receber: R$ ${aReceber.toFixed(0)}`}
          </div>
        </div>

        {/* SALDO GERAL */}
        <div className={`bg-gradient-to-br border rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group transition-all duration-300 ${isProjected ? 'from-indigo-600/20 border-indigo-500/40 hover:border-indigo-500/60 shadow-indigo-500/10' : 'from-indigo-500/20 border-indigo-500/30 hover:border-indigo-500/40'}`}>
          <div className="flex justify-between items-center mb-2 sm:mb-4 relative z-10">
            <span className={`text-[10px] sm:text-sm font-bold tracking-wide uppercase truncate mr-2 ${isProjected ? 'text-white' : 'text-indigo-200/70'}`}>
              Saldo em Conta
            </span>
            <div className="p-1.5 sm:p-2.5 bg-indigo-500/20 rounded-lg sm:rounded-xl shrink-0">
              <Bank className="text-indigo-300 w-3 h-3 sm:w-5 sm:h-5" />
            </div>
          </div>
          
          <div className={`font-mono text-base sm:text-2xl font-bold relative z-10 truncate ${displaySaldoGlobal >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {renderMoney(displaySaldoGlobal)}
          </div>
          
          <div className="text-[10px] sm:text-xs font-semibold mt-1.5 sm:mt-2 text-slate-400 truncate relative z-10">
            Balanço Líquido: <span className={displayBalancoMensal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {renderMoney(displayBalancoMensal, displayBalancoMensal >= 0 ? '+' : '')}
            </span>
          </div>
        </div>

      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Coluna Esquerda: Formulário + Gráfico */}
        <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-20">
          
          <div ref={formRef} className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl scroll-mt-24">
            <div className="flex justify-between items-center mb-4 sm:mb-5">
              <h2 className="text-base sm:text-lg font-bold text-white">
                {editingId ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/20 transition-all flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-2.5 p-1 bg-black/40 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setType('receita')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    type === 'receita' 
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.15)]' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Plus size={15} /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => setType('despesa')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    type === 'despesa' 
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Minus size={15} /> Despesa
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
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

                {category === 'Cartão de Crédito' && (
                  <div className="col-span-1 sm:col-span-2 bg-black/20 p-4 rounded-xl border border-white/5 space-y-3 shadow-inner">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-indigo-400"/> Lançamentos da Fatura
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">Enter para adicionar</span>
                    </h4>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ex: Uber, Ifood..." 
                        value={cartItemName} 
                        onChange={e => setCartItemName(e.target.value)} 
                        onKeyDown={handleCartKeyDown}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-500" 
                      />
                      <input 
                        type="text" 
                        inputMode="numeric" 
                        placeholder="R$ 0,00" 
                        value={cartItemValue} 
                        onChange={e => setCartItemValue(formatCurrency(e.target.value))} 
                        onKeyDown={handleCartKeyDown}
                        className="w-28 sm:w-32 bg-white/5 border border-white/10 rounded-lg p-2.5 text-base sm:text-sm text-center font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-500" 
                      />
                      <button 
                        type="button" 
                        onClick={handleAddCartItem} 
                        className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors border border-indigo-500/20 shrink-0"
                      >
                        <Plus size={18}/>
                      </button>
                    </div>

                    {cartItems.length > 0 && (
                      <div className="space-y-1.5 pt-2 max-h-32 overflow-y-auto custom-scrollbar border-t border-white/5">
                        {cartItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-xs bg-white/5 px-3 py-2 rounded-lg text-slate-300 border border-white/5">
                            <span className="font-semibold truncate pr-2">{item.nome}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono text-cyan-400 font-bold tracking-wider">R$ {item.valor.toFixed(2)}</span>
                              <button type="button" onClick={() => handleRemoveCartItem(item.id)} className="text-slate-500 hover:text-rose-400 transition-colors">
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    {category.includes('Investimento') ? 'Nome do Ativo (ex: Tesouro Selic)' : 'Descrição'}
                  </label>
                  <input 
                    type="text"
                    required={category.includes('Investimento')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all placeholder:text-slate-600"
                    placeholder={
                      category === 'Cartão de Crédito' ? "Ex: Fatura Nubank (Opcional se usar carrinho)" : 
                      category.includes('Investimento') ? "Ex: CDB Banco Inter" : 
                      "Ex: Aluguel, Supermercado..."
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Valor Total</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={handleAmountChange}
                    readOnly={category === 'Cartão de Crédito' && cartItems.length > 0}
                    className={`w-full bg-black/40 border rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all font-mono placeholder:text-slate-600 ${category === 'Cartão de Crédito' && cartItems.length > 0 ? 'border-indigo-500/30 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 'border-white/10'}`}
                    placeholder="R$ 0,00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="pago" className="bg-slate-900 text-emerald-400">Pago / Recebido</option>
                    <option value="pendente" className="bg-slate-900 text-amber-400">Pendente</option>
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

                {!editingId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Repeat size={12} className="text-indigo-400" /> Repetir (Meses)
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    >
                      <option value={1} className="bg-slate-900">Única (1x)</option>
                      {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map(n => (
                        <option key={n} value={n} className="bg-slate-900">{n}x Mensais</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <button 
                type="submit"
                className={`w-full mt-2 font-bold text-sm p-3.5 sm:p-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  editingId 
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-500/25' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40'
                }`}
              >
                {editingId ? <><RefreshCw size={16} /> Atualizar Registro</> : <><Plus size={16} /> Registrar Lançamento</>}
              </button>
            </form>
          </div>

          {/* ÁREA DO GRÁFICO */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl h-[450px] flex flex-col transition-all">
            
            <div className="flex flex-col gap-3 mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <PieChartIcon className="text-slate-400 w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {chartType === 'despesa' ? 'Mapa de Despesas' : chartType === 'receita' ? 'Mapa de Receitas' : 'Sua Carteira'}
                  {isProjected && <span className="text-cyan-400 text-xs ml-1">(Projetado)</span>}
                </h2>
              </div>
              
              <div className="flex bg-black/40 rounded-lg p-1 border border-white/10 w-full">
                <button 
                  onClick={() => setChartType('despesa')}
                  className={`flex-1 whitespace-nowrap px-2 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chartType === 'despesa' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'}`}
                >
                  Despesas
                </button>
                <button 
                  onClick={() => setChartType('receita')}
                  className={`flex-1 whitespace-nowrap px-2 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chartType === 'receita' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'}`}
                >
                  Receitas
                </button>
                <button 
                  onClick={() => setChartType('investimento')}
                  className={`flex-1 whitespace-nowrap px-2 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chartType === 'investimento' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-white'}`}
                >
                  Carteira
                </button>
              </div>
            </div>
            
            <div className="flex-1 w-full relative">
              {chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs sm:text-sm text-center px-4">
                  Sem dados operacionais para {chartType} neste {chartType === 'investimento' ? 'histórico' : 'período'}.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="38%"
                      innerRadius={66}
                      outerRadius={86}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                      ))}
                    </Pie>

                    <text x="50%" y="33%" textAnchor="middle" dominantBaseline="central" className="fill-slate-400 text-[10px] uppercase font-bold tracking-widest">
                      Total
                    </text>
                    <text x="50%" y="41%" textAnchor="middle" dominantBaseline="central" className="fill-white text-xs sm:text-sm font-mono font-bold">
                      {hideValues 
                        ? 'R$ •••••' 
                        : chartTotalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </text>

                    <Tooltip content={<CustomTooltip hideValues={hideValues} />} cursor={{fill: 'transparent'}} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={76} 
                      iconType="circle"
                      wrapperStyle={{ paddingTop: '10px' }}
                      formatter={(value) => <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 ml-1">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Feed de Transações Agrupado + Busca */}
        <div className="lg:col-span-2 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-4 sm:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[450px] max-h-[850px] sm:max-h-[1040px]">
          
          <div className="flex flex-col gap-3.5 mb-5 border-b border-white/10 pb-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base sm:text-lg font-bold text-white">Extrato Detalhado</h2>
              <div className="text-[10px] sm:text-xs font-semibold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                {sortedTransactions.length} {sortedTransactions.length === 1 ? 'registro' : 'registros'}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por descrição ou categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'pendente', label: 'Pendentes' },
                  { id: 'pago', label: 'Pagos' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      statusFilter === tab.id 
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 space-y-5">
            {groupedTransactions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Coins size={40} className="text-slate-600/50 sm:w-12 sm:h-12" />
                <p className="text-xs sm:text-sm">Nenhuma transação encontrada para os filtros atuais.</p>
              </div>
            ) : (
              groupedTransactions.map(([dateLabel, dayTransactions]) => (
                <div key={dateLabel} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <Calendar size={12} className="text-indigo-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {dateLabel}
                    </span>
                    <div className="flex-1 h-px bg-white/5"></div>
                  </div>

                  {dayTransactions.map((t) => {
                    const isPendente = (t.status || 'pago') === 'pendente';
                    const isReceita = t.type === 'receita';
                    const isConfirmingDelete = confirmDeleteId === t.id;
                    const { isFaturaCartao, mainTitle, items: cartaoItens } = parseFaturaDescription(t.description, t.category);
                    
                    return (
                      <div key={t.id} className={`group flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-black/20 border rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-lg ${isPendente ? 'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5' : 'border-white/5 hover:border-white/10 hover:bg-white/5'}`}>
                        
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border flex items-center justify-center shadow-inner shrink-0 ${isPendente ? 'bg-amber-500/10 border-amber-500/20' : isReceita ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                            {getCategoryIcon(t.category)}
                          </div>

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors truncate">
                              {mainTitle}
                            </div>
                            
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10 truncate max-w-[140px] sm:max-w-none">
                                <Tag size={9} className="shrink-0"/> <span className="truncate">{t.category}</span>
                              </span>
                              {isPendente && (
                                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  {isReceita ? 'A Receber' : 'A Pagar'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-0 shrink-0">
                          <div className={`font-mono font-bold text-base sm:text-lg tracking-tight ${isPendente ? 'text-amber-400/80' : isReceita ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {renderMoney(Number(t.amount), isReceita ? '+ ' : '- ')}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {isFaturaCartao && (
                              <button 
                                onClick={() => setFaturaModal({ isOpen: true, transaction: t, items: cartaoItens })}
                                className="flex items-center gap-1 p-1.5 sm:p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20"
                                title="Ver Fatura"
                              >
                                <Eye size={14}/>
                                <span className="hidden sm:inline">Fatura</span>
                              </button>
                            )}

                            {isPendente && (
                              <button 
                                onClick={() => toggleTransactionStatus(t.id)}
                                title="Dar Baixa"
                                className="flex items-center justify-center p-1.5 sm:p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all border border-emerald-500/20"
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
                              onClick={() => {
                                if (isConfirmingDelete) {
                                  deleteTransaction(t.id);
                                  setConfirmDeleteId(null);
                                } else {
                                  setConfirmDeleteId(t.id);
                                  setTimeout(() => setConfirmDeleteId(prev => prev === t.id ? null : prev), 3000);
                                }
                              }}
                              title={isConfirmingDelete ? "Clique novamente para excluir" : "Excluir"}
                              className={`p-1.5 sm:p-2 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold ${
                                isConfirmingDelete 
                                  ? 'bg-rose-500 text-white px-2.5 animate-pulse shadow-lg shadow-rose-500/30' 
                                  : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                              }`}
                            >
                              <Trash2 size={16} />
                              {isConfirmingDelete && <span>Confirmar?</span>}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>

      {/* MODAL DE DETALHES DA FATURA */}
      {faturaModal.isOpen && faturaModal.transaction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4 shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <CreditCard className="text-indigo-400" size={20} />
                  Detalhes da Fatura
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                  {parseFaturaDescription(faturaModal.transaction.description, faturaModal.transaction.category).mainTitle}
                </p>
              </div>
              <button onClick={() => setFaturaModal({ isOpen: false, transaction: null, items: [] })} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {faturaModal.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-3.5 rounded-xl">
                  <span className="text-sm font-semibold text-slate-200">{item.nome}</span>
                  <span className="text-sm font-mono font-bold text-cyan-400">
                    {renderMoney(Number(item.valor))}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 flex justify-between items-center shrink-0">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Consolidado</span>
              <span className="text-xl sm:text-2xl font-mono font-bold text-white">
                {renderMoney(Number(faturaModal.transaction.amount))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
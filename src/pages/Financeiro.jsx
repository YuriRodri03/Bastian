import React, { useState, useEffect, useMemo } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { 
  Wallet, Plus, Minus, ArrowUpRight, ArrowDownRight, 
  Tag, Trash2, Pencil, X, PieChart as PieChartIcon,
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, CheckCircle2, Filter
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORIAS_RECEITA = ['Salário', 'Bolsa Acadêmica/CNPq', 'Freelance', 'Rendimentos', 'Outros'];
const CATEGORIAS_DESPESA = ['Alimentação', 'Moradia', 'Transporte', 'Contas', 'Saúde', 'Educação/Pesquisa', 'Lazer', 'Outros'];
const CORES_GRAFICO = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f43f5e', '#64748b'];

const MESES = [
  { valor: '01', nome: 'Janeiro' }, { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' }, { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' }, { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' }, { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' }, { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' }, { valor: '12', nome: 'Dezembro' }
];

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
      <div className="bg-slate-900/90 border border-white/10 p-3 rounded-xl backdrop-blur-md shadow-xl">
        <p className="text-sm font-medium text-slate-200 mb-1">{payload[0].name}</p>
        <p className="text-sm font-mono text-rose-400">
          {payload[0].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>
    );
  }
  return null;
};

export default function Financeiro() {
  const { transactions, addTransaction, removeTransaction, updateTransaction, toggleTransactionStatus, balance, fetchTransactions } = useFinanceStore();

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Estados do Formulário
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('receita');
  const [category, setCategory] = useState(CATEGORIAS_RECEITA[0]);
  const [date, setDate] = useState(getTodayFormatted());
  const [status, setStatus] = useState('pago');
  const [editingId, setEditingId] = useState(null);

  // Estados dos Filtros (Iniciam com o mês e ano atuais)
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);

  useEffect(() => {
    if (!editingId) {
      setCategory(type === 'receita' ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0]);
    }
  }, [type, editingId]);

  // Identifica todos os anos que têm transações para montar o filtro de Ano
  const availableYears = useMemo(() => {
    const years = transactions.map(t => {
      return t.date.includes('/') ? t.date.split('/')[2] : t.date.split('-')[0];
    });
    const uniqueYears = [...new Set(years)];
    if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
    return uniqueYears.sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYear]);

  // Filtra as transações baseadas no Mês e Ano selecionados
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return true;
      
      let y, m;
      if (t.date.includes('/')) {
        const parts = t.date.split('/');
        y = parts[2];
        m = parts[1];
      } else {
        const parts = t.date.split('-');
        y = parts[0];
        m = parts[1];
      }

      if (filterYear !== y) return false;
      if (filterMonth !== 'all' && filterMonth !== m) return false;
      
      return true;
    });
  }, [transactions, filterMonth, filterYear]);

  // Cálculos Inteligentes limitados APENAS ao período filtrado
  const { totalReceitas, totalDespesas, aPagar, saldoPeriodo } = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const tStatus = t.status || 'pago';
      
      if (t.type === 'receita' && tStatus === 'pago') {
        acc.totalReceitas += t.amount;
        acc.saldoPeriodo += t.amount;
      }
      if (t.type === 'despesa' && tStatus === 'pago') {
        acc.totalDespesas += t.amount;
        acc.saldoPeriodo -= t.amount;
      }
      if (t.type === 'despesa' && tStatus === 'pendente') {
        acc.aPagar += t.amount;
      }
      return acc;
    }, { totalReceitas: 0, totalDespesas: 0, aPagar: 0, saldoPeriodo: 0 });
  }, [filteredTransactions]);

  // Gráfico reflete apenas o período filtrado
  const despesasPorCategoria = useMemo(() => {
    const despesas = filteredTransactions.filter(t => t.type === 'despesa' && (t.status || 'pago') === 'pago');
    const agrupado = despesas.reduce((acc, transacao) => {
      const index = acc.findIndex(item => item.name === transacao.category);
      if (index !== -1) acc[index].value += transacao.amount;
      else acc.push({ name: transacao.category, value: transacao.amount });
      return acc;
    }, []);
    return agrupado.sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

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
    <div className="min-h-screen p-8 font-sans flex flex-col items-center">
      
      {/* Cabeçalho com Filtros */}
      <div className="w-full max-w-6xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
            <Wallet className="text-slate-300 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-wide">Visão Geral</h1>
            <p className="text-sm text-slate-400">Planejamento e Controle Financeiro</p>
          </div>
        </div>

        {/* Filtro de Período */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-lg">
          <div className="pl-3 text-slate-400">
            <Filter size={16} />
          </div>
          <select 
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none cursor-pointer py-1.5"
          >
            <option value="all" className="bg-slate-900 text-slate-200">Visão Anual</option>
            {MESES.map(m => (
              <option key={m.valor} value={m.valor} className="bg-slate-900 text-slate-200">{m.nome}</option>
            ))}
          </select>
          <div className="w-px h-5 bg-white/10"></div>
          <select 
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none cursor-pointer py-1.5 pr-2"
          >
            {availableYears.map(year => (
              <option key={year} value={year} className="bg-slate-900 text-slate-200">{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Cards de Resumo */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4 relative z-10">
            <span className="text-sm font-medium text-slate-400">Receitas Recebidas</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="text-emerald-400 w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl font-semibold text-emerald-400 relative z-10">
            {totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4 relative z-10">
            <span className="text-sm font-medium text-slate-400">Despesas Pagas</span>
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <TrendingDown className="text-rose-400 w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl font-semibold text-rose-400 relative z-10">
            {totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Clock className="w-16 h-16 text-amber-400" />
          </div>
          <div className="flex justify-between items-center mb-4 relative z-10">
            <span className="text-sm font-medium text-slate-300">Contas a Pagar</span>
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Clock className="text-amber-400 w-4 h-4" />
            </div>
          </div>
          <div className="font-mono text-xl font-semibold text-amber-400 relative z-10">
            {aPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-center mb-4 relative z-10">
            <span className="text-sm font-medium text-indigo-200">Balanço do Período</span>
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <DollarSign className="text-indigo-300 w-4 h-4" />
            </div>
          </div>
          <div className={`font-mono text-xl font-semibold relative z-10 ${saldoPeriodo >= 0 ? 'text-indigo-100' : 'text-rose-400'}`}>
            {saldoPeriodo >= 0 ? '+' : ''}{saldoPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Formulário + Gráfico */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-xl h-fit">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-sm font-semibold text-slate-300">
                {editingId ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Descrição</label>
                <input 
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Ex: Aluguel, Internet..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Valor</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono"
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Categoria</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    {(type === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(cat => (
                      <option key={cat} value={cat} className="bg-slate-900 text-slate-200">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Data</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
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
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-medium transition-all ${type === 'receita' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-transparent text-slate-400'}`}
                >
                  <Plus size={16} /> Receita
                </button>
                <button
                  type="button"
                  onClick={() => setType('despesa')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-sm font-medium transition-all ${type === 'despesa' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-white/5 border-transparent text-slate-400'}`}
                >
                  <Minus size={16} /> Despesa
                </button>
              </div>
              
              <button 
                type="submit"
                className={`w-full mt-2 font-medium text-sm p-3 rounded-xl shadow-lg transition-all ${editingId ? 'bg-amber-600/90 hover:bg-amber-500 text-white shadow-amber-500/25' : 'bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-indigo-500/25'}`}
              >
                {editingId ? 'Atualizar Transação' : 'Registrar'}
              </button>
            </form>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-xl h-[340px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="text-slate-400 w-4 h-4" />
              <h2 className="text-sm font-semibold text-slate-300">Despesas no Período</h2>
            </div>
            
            <div className="flex-1 w-full relative">
              {despesasPorCategoria.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm text-center px-4">
                  Nenhuma despesa paga no período.
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
                    >
                      {despesasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Log de Transações com Botão de Baixa Rápida */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-xl flex flex-col h-[820px]">
          <h2 className="text-sm font-semibold text-slate-300 mb-5">Lançamentos</h2>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-2">
            {sortedTransactions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Nenhuma transação encontrada neste período.
              </div>
            ) : (
              sortedTransactions.map((t) => {
                const isPendente = (t.status || 'pago') === 'pendente';
                
                return (
                  <div key={t.id} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-white/5 border rounded-xl transition-colors gap-4 ${isPendente ? 'border-amber-500/20 hover:bg-amber-500/5' : 'border-white/5 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-4">
                      
                      <button 
                        onClick={() => toggleTransactionStatus(t.id)}
                        title={isPendente ? "Marcar como Pago" : "Marcar como Pendente"}
                        className={`p-2 rounded-lg shrink-0 transition-all ${isPendente ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : t.type === 'receita' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}
                      >
                        {isPendente ? <Clock size={18} /> : t.type === 'receita' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                      </button>

                      <div>
                        <div className="text-sm font-medium text-slate-200">{t.description}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar size={12} /> {formatDateToBR(t.date)}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
                            <Tag size={10} /> {t.category}
                          </span>
                          {isPendente && (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              A Pagar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                      <div className={`font-mono font-medium ${isPendente ? 'text-amber-400/80' : t.type === 'receita' ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {t.type === 'receita' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* Botão de Dar Baixa Rápida em Pendências */}
                        {isPendente && (
                          <button 
                            onClick={() => toggleTransactionStatus(t.id)}
                            title="Dar Baixa (Marcar como Pago)"
                            className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-xs font-medium transition-all"
                          >
                            <CheckCircle2 size={14} /> Pagar
                          </button>
                        )}

                        <button 
                          onClick={() => handleEdit(t)}
                          title="Editar"
                          className="text-slate-400 hover:text-amber-400 p-2 rounded-lg hover:bg-amber-500/10 transition-all"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => removeTransaction(t.id)}
                          title="Excluir"
                          className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition-all"
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
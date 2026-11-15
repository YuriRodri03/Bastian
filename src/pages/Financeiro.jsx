// src/pages/Financeiro.jsx
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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const toBRL = (v) => BRL.format(Number(v) || 0);

const HIDE_KEY = 'financeiro:hideValues';
const CARD_CATEGORY = 'Cartão de Crédito';

// Soma em centavos para evitar erros de ponto flutuante (0.1 + 0.2)
const sumCents = (items) => items.reduce((acc, i) => acc + Math.round((Number(i.valor) || 0) * 100), 0);

const labelCls = 'block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide';
const inputCls =
  'w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all';

/* ------------------------------------------------------------------ */
/* Componentes pequenos                                                */
/* ------------------------------------------------------------------ */

const Money = ({ value, prefix = '', hide }) => (
  <span className={`transition-all duration-200 ${hide ? 'blur-md select-none' : ''}`}>
    {prefix}{toBRL(value)}
  </span>
);

const CustomTooltip = ({ active, payload, hideValues }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  return (
    <div className="bg-slate-900/95 border border-white/10 p-4 rounded-2xl backdrop-blur-xl shadow-2xl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.payload?.fill ?? item.color }}></div>
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{item.name}</p>
      </div>
      <p className="text-lg font-mono font-medium text-white">
        {hideValues ? 'R$ •••••' : toBRL(item.value)}
      </p>
    </div>
  );
};

const SummaryCard = ({
  className = '', title, titleClass = '', icon, iconBg, value, valueClass = '', footer, footerClass = 'text-slate-500'
}) => (
  <div className={`bg-gradient-to-br border rounded-2xl sm:rounded-3xl p-3 sm:p-6 backdrop-blur-xl shadow-lg relative overflow-hidden group transition-all duration-300 ${className}`}>
    <div className="flex justify-between items-center mb-2 sm:mb-4 relative z-10">
      <span className={`text-[10px] sm:text-sm tracking-wide uppercase truncate mr-2 ${titleClass}`}>{title}</span>
      <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
    </div>
    <div className={`font-mono text-base sm:text-2xl font-bold relative z-10 truncate ${valueClass}`}>{value}</div>
    <div className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 truncate relative z-10 ${footerClass}`}>{footer}</div>
  </div>
);

const FaturaModal = ({ transaction, items, hideValues, onClose }) => {
  // Fecha com Esc e trava o scroll da página enquanto o modal estiver aberto
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const { mainTitle } = parseFaturaDescription(transaction.description, transaction.category);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da fatura"
    >
      <div
        className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4 shrink-0">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="text-indigo-400" size={20} />
              Detalhes da Fatura
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">{mainTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">Esta fatura não tem itens detalhados.</p>
          )}
          {items.map((item, idx) => (
            <div key={item.id ?? idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-3.5 rounded-xl">
              <span className="text-sm font-semibold text-slate-200">{item.nome}</span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                <Money value={item.valor} hide={hideValues} />
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex justify-between items-center shrink-0">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Consolidado</span>
          <span className="text-xl sm:text-2xl font-mono font-bold text-white">
            <Money value={transaction.amount} hide={hideValues} />
          </span>
        </div>
      </div>
    </div>
  );
};

const TransactionRow = ({ t, hideValues, isConfirmingDelete, onEdit, onToggle, onDelete, onOpenFatura }) => {
  const isPendente = (t.status || 'pago') === 'pendente';
  const isReceita = t.type === 'receita';
  const isRendimento = t.category === 'Rendimento de Investimento';
  const { isFaturaCartao, mainTitle, items } = parseFaturaDescription(t.description, t.category);

  return (
    <div className={`group flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-black/20 border rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-lg ${isPendente ? 'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5' : 'border-white/5 hover:border-white/10 hover:bg-white/5'}`}>
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border flex items-center justify-center shadow-inner shrink-0 ${isPendente ? 'bg-amber-500/10 border-amber-500/20' : isReceita ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
          {getCategoryIcon(t.category)}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors truncate">{mainTitle}</div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10 truncate max-w-[160px] sm:max-w-none">
              <Tag size={9} className="shrink-0" /> <span className="truncate">{t.category}</span>
            </span>
            {isRendimento && (
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Direto na Carteira
              </span>
            )}
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
          <Money value={t.amount} prefix={isReceita ? '+ ' : '- '} hide={hideValues} />
        </div>

        <div className="flex items-center gap-1">
          {isFaturaCartao && (
            <button
              type="button"
              onClick={() => onOpenFatura(t, items)}
              className="flex items-center gap-1 p-1.5 sm:p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest border border-indigo-500/20"
              title="Ver Fatura"
              aria-label="Ver fatura"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">Fatura</span>
            </button>
          )}

          {isPendente && (
            <button
              type="button"
              onClick={() => onToggle(t.id)}
              title="Dar Baixa"
              aria-label="Dar baixa"
              className="flex items-center justify-center p-1.5 sm:p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all border border-emerald-500/20"
            >
              <CheckCircle2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(t)}
            title="Editar"
            aria-label="Editar"
            className="text-slate-400 hover:text-indigo-400 p-1.5 sm:p-2 rounded-lg hover:bg-indigo-500/10 transition-all"
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(t.id)}
            title={isConfirmingDelete ? 'Clique novamente para excluir' : 'Excluir'}
            aria-label={isConfirmingDelete ? 'Confirmar exclusão' : 'Excluir'}
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
};

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Financeiro() {
  const { transactions, addTransaction, deleteTransaction, updateTransaction, toggleTransactionStatus, fetchTransactions, isLoading, error: storeError } = useFinanceStore();
  const formRef = useRef(null);
  const cartIdRef = useRef(0);
  const confirmTimerRef = useRef(null);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => () => clearTimeout(confirmTimerRef.current), []);

  // ESTADOS DO FORMULÁRIO
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('receita');
  const [category, setCategory] = useState(CATEGORIAS_RECEITA[0]);
  const [date, setDate] = useState(getTodayFormatted());
  const [status, setStatus] = useState('pago');
  const [installments, setInstallments] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // CARRINHO DE CARTÃO DE CRÉDITO
  const [cartItems, setCartItems] = useState([]);
  const [cartItemName, setCartItemName] = useState('');
  const [cartItemValue, setCartItemValue] = useState('');
  const [faturaModal, setFaturaModal] = useState(null); // { transaction, items } | null

  // ESTADOS GERAIS, PRIVACIDADE E FILTROS
  const [isProjected, setIsProjected] = useState(false);
  const [hideValues, setHideValues] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
  });
  const [chartType, setChartType] = useState('despesa');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [filterMonth, setFilterMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()));

  useEffect(() => {
    try { localStorage.setItem(HIDE_KEY, hideValues ? '1' : '0'); } catch { /* storage indisponível */ }
  }, [hideValues]);

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

  const isCardCategory = category === CARD_CATEGORY;
  const isInvestmentCategory = category.includes('Investimento');
  const amountLocked = isCardCategory && cartItems.length > 0;

  /* ----------------------------- Handlers ----------------------------- */

  const syncAmountWithCart = (items) => {
    const cents = sumCents(items);
    setAmount(cents > 0 ? formatCurrency(String(cents)) : '');
  };

  // Troca de tipo; atalhos de investimento passam a categoria pré-definida
  const handleSelectType = (newType, presetCategory = null) => {
    setType(newType);
    setCategory(presetCategory ?? (newType === 'receita' ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0]));
    setCartItems([]);
    setFormError('');
  };

  // Sair de "Cartão de Crédito" descarta o carrinho para não vazar itens antigos
  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    if (newCategory !== CARD_CATEGORY) setCartItems([]);
  };

  const handleAmountChange = (e) => {
    setAmount(formatCurrency(e.target.value));
    setFormError('');
  };

  const handleAddCartItem = () => {
    const val = unmaskCurrency(cartItemValue);
    if (!cartItemName.trim() || !val) return;

    const newItems = [...cartItems, { id: `c${Date.now()}-${cartIdRef.current++}`, nome: cartItemName.trim(), valor: val }];
    setCartItems(newItems);
    setCartItemName('');
    setCartItemValue('');
    syncAmountWithCart(newItems);
  };

  const handleCartKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCartItem();
    }
  };

  const handleRemoveCartItem = (id) => {
    const newItems = cartItems.filter((i) => i.id !== id);
    setCartItems(newItems);
    syncAmountWithCart(newItems);
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
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    const numericAmount = unmaskCurrency(amount);
    let baseDescription = description.trim();
    if (isCardCategory && cartItems.length > 0 && !baseDescription) {
      baseDescription = 'Fatura Cartão de Crédito';
    }

    if (!numericAmount) return setFormError('Informe um valor maior que zero.');
    if (!baseDescription) return setFormError(isInvestmentCategory ? 'Informe o nome do ativo.' : 'Informe uma descrição.');

    // Consistência absoluta entre tipo e categoria de investimento
    const finalType =
      category === 'Rendimento de Investimento' || category === 'Resgate de Investimento'
        ? 'receita'
        : category === 'Aporte de Investimento'
          ? 'despesa'
          : type;

    // Só salva itens de fatura quando a categoria realmente é cartão
    const itemsToSave = isCardCategory ? cartItems : [];

    setIsSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateTransaction({
          id: editingId,
          amount: numericAmount,
          description: serializeFaturaDescription(baseDescription, category, itemsToSave),
          type: finalType,
          category,
          date,
          status
        });
      } else {
        const totalParc = Math.max(1, Number(installments) || 1);
        const batchPayloads = Array.from({ length: totalParc }, (_, i) => ({
          amount: numericAmount,
          description: serializeFaturaDescription(
            totalParc > 1 ? `${baseDescription} (${i + 1}/${totalParc})` : baseDescription,
            category,
            itemsToSave
          ),
          type: finalType,
          category,
          date: i === 0 ? date : addMonthsToDate(date, i),
          status: i === 0 ? status : 'pendente'
        }));

        await addTransaction(batchPayloads);
      }
      resetForm();
    } catch (err) {
      console.error('Falha ao salvar lançamento:', err);
      setFormError('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    const { mainTitle, items } = parseFaturaDescription(t.description, t.category);

    setDescription(mainTitle);
    // Garante id em todos os itens: sem id, remover um item apagaria todos
    setCartItems((items || []).map((it, idx) => ({ ...it, id: it.id ?? `e${t.id}-${idx}` })));

    setAmount(formatCurrency(String(Math.round(Number(t.amount) * 100))));
    setType(t.type);
    setCategory(t.category);
    setDate(normalizeDateISO(t.date));
    setStatus(t.status || 'pago');
    setInstallments(1);
    setFormError('');

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Ações do extrato (excluir / dar baixa) lançam erro no store; sem este catch viravam rejeição não tratada
  const runAction = async (fn) => {
    setActionError('');
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setActionError('Não foi possível concluir a ação. Tente novamente.');
    }
  };

  const handleDeleteClick = (id) => {
    clearTimeout(confirmTimerRef.current);
    if (confirmDeleteId === id) {
      runAction(() => deleteTransaction(id));
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(id);
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
  };

  const closeFatura = React.useCallback(() => setFaturaModal(null), []);

  /* ------------------------------ Render ------------------------------ */

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
            onClick={() => setHideValues((v) => !v)}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            aria-pressed={hideValues}
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all shadow-lg shrink-0"
          >
            {hideValues ? <EyeOff size={18} className="text-amber-400" /> : <Eye size={18} />}
          </button>

          <button
            type="button"
            onClick={() => setIsProjected((v) => !v)}
            aria-pressed={isProjected}
            className={`flex-1 sm:flex-none items-center justify-center flex gap-2 px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-lg ${
              isProjected
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/30 border border-indigo-500/50'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <Sparkles size={16} className={isProjected ? 'animate-pulse' : ''} />
            <span>{isProjected ? 'Projeção Ativa' : 'Visão Real'}</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-xl flex-1 sm:flex-none">
            <div className="pl-3 sm:pl-4 text-slate-400 hidden sm:block">
              <Filter size={16} />
            </div>
            <select
              aria-label="Mês"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-base sm:text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer py-1.5 hover:text-white transition-colors flex-1"
            >
              <option value="all" className="bg-slate-900 text-slate-200">Ano Inteiro</option>
              {MESES.map((m) => (
                <option key={m.valor} value={m.valor} className="bg-slate-900 text-slate-200">{m.nome}</option>
              ))}
            </select>
            <div className="w-px h-5 sm:h-6 bg-white/10"></div>
            <select
              aria-label="Ano"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-transparent text-base sm:text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer py-1.5 pr-2 sm:pr-4 hover:text-white transition-colors"
            >
              <option value="all" className="bg-slate-900 text-indigo-300 font-bold">Todo Histórico</option>
              {availableYears.map((year) => (
                <option key={year} value={year} className="bg-slate-900 text-slate-200">{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 5 Cards de Resumo */}
      <div className="w-full max-w-7xl grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5 mb-6 sm:mb-8">
        <SummaryCard
          className="col-span-2 lg:col-span-1 from-emerald-600/20 to-teal-500/10 border-emerald-500/30 hover:border-emerald-500/50"
          title="Total Investido"
          titleClass="font-bold text-emerald-200/80"
          icon={<PiggyBank className="text-emerald-300 w-3 h-3 sm:w-5 sm:h-5" />}
          iconBg="bg-emerald-500/20"
          value={<Money value={displayTotalInvestido} hide={hideValues} />}
          valueClass="text-emerald-400"
          footer={<>Aporte + Rend. (Mês): <span className="text-emerald-300 font-bold">{taxaPoupancaMes}%</span></>}
          footerClass="font-semibold text-emerald-200/70"
        />

        <SummaryCard
          className="from-white/10 to-transparent border-white/10 hover:border-white/20"
          title={isProjected ? 'Receitas (Proj)' : 'Receitas'}
          titleClass="font-semibold text-slate-400"
          icon={<TrendingUp className="text-emerald-400 w-3 h-3 sm:w-5 sm:h-5" />}
          iconBg="bg-emerald-500/10"
          value={<Money value={displayReceitas} hide={hideValues} />}
          valueClass="text-emerald-400"
          footer="Exclui resgates de carteira"
          footerClass="font-medium text-slate-500"
        />

        <SummaryCard
          className="from-white/10 to-transparent border-white/10 hover:border-white/20"
          title={isProjected ? 'Despesas (Proj)' : 'Despesas'}
          titleClass="font-semibold text-slate-400"
          icon={<TrendingDown className="text-rose-400 w-3 h-3 sm:w-5 sm:h-5" />}
          iconBg="bg-rose-500/10"
          value={<Money value={displayDespesas} hide={hideValues} />}
          valueClass="text-rose-400"
          footer="Exclui aportes de investimento"
          footerClass="font-medium text-slate-500"
        />

        <SummaryCard
          className={isProjected ? 'from-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/30' : 'from-amber-500/10 border-amber-500/20 hover:border-amber-500/30'}
          title={isProjected ? 'A Receber' : 'A Pagar'}
          titleClass={`font-semibold ${isProjected ? 'text-cyan-200/70' : 'text-amber-200/70'}`}
          icon={isProjected
            ? <ArrowUpRight className="text-cyan-400 w-3 h-3 sm:w-5 sm:h-5" />
            : <Clock className="text-amber-400 w-3 h-3 sm:w-5 sm:h-5" />}
          iconBg={isProjected ? 'bg-cyan-500/20' : 'bg-amber-500/20'}
          value={<Money value={isProjected ? aReceber : aPagar} hide={hideValues} />}
          valueClass={isProjected ? 'text-cyan-400' : 'text-amber-400'}
          footer={<>{isProjected ? 'A Pagar: ' : 'A Receber: '}<Money value={isProjected ? aPagar : aReceber} hide={hideValues} /></>}
          footerClass="font-medium text-slate-400"
        />

        <SummaryCard
          className={isProjected ? 'from-indigo-600/20 border-indigo-500/40 hover:border-indigo-500/60 shadow-indigo-500/10' : 'from-indigo-500/20 border-indigo-500/30 hover:border-indigo-500/40'}
          title="Saldo em Conta"
          titleClass={`font-bold ${isProjected ? 'text-white' : 'text-indigo-200/70'}`}
          icon={<Bank className="text-indigo-300 w-3 h-3 sm:w-5 sm:h-5" />}
          iconBg="bg-indigo-500/20"
          value={<Money value={displaySaldoGlobal} hide={hideValues} />}
          valueClass={displaySaldoGlobal >= 0 ? 'text-white' : 'text-rose-400'}
          footer={<>
            Balanço Líquido:{' '}
            <span className={displayBalancoMensal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              <Money value={displayBalancoMensal} prefix={displayBalancoMensal >= 0 ? '+' : ''} hide={hideValues} />
            </span>
          </>}
          footerClass="font-semibold text-slate-400"
        />
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Coluna Esquerda: Formulário + Gráfico (sem sticky: a coluna é mais alta que a tela e o fim ficava inacessível) */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          <div ref={formRef} className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl shadow-2xl scroll-mt-24">
            <div className="flex justify-between items-center mb-4 sm:mb-5">
              <h2 className="text-base sm:text-lg font-bold text-white">
                {editingId ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/20 transition-all flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Seletor Receita vs Despesa */}
              <div className="grid grid-cols-2 gap-2.5 p-1 bg-black/40 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => handleSelectType('receita')}
                  aria-pressed={type === 'receita'}
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
                  onClick={() => handleSelectType('despesa')}
                  aria-pressed={type === 'despesa'}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    type === 'despesa'
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Minus size={15} /> Despesa
                </button>
              </div>

              {/* Atalhos de investimento */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectType('despesa', 'Aporte de Investimento')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    category === 'Aporte de Investimento'
                      ? 'bg-indigo-500/25 border-indigo-500/50 text-indigo-200 shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Tira do Saldo em Conta e soma no Total Investido"
                >
                  <PiggyBank size={13} className="text-indigo-400 shrink-0" /> Novo Aporte
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectType('receita', 'Rendimento de Investimento')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    category === 'Rendimento de Investimento'
                      ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-200 shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Soma direto no Total Investido sem alterar o Saldo da Conta Corrente"
                >
                  <TrendingUp size={13} className="text-emerald-400 shrink-0" /> Rendimento Direto
                </button>
              </div>

              {category === 'Rendimento de Investimento' && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-2.5 text-[11px] text-emerald-300 font-medium leading-relaxed">
                  ✨ <strong>Direto na Carteira:</strong> Este rendimento será somado diretamente ao seu <strong>Total Investido</strong> (e ao ativo informado abaixo), sem precisar lançar um novo aporte depois.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="fin-categoria" className={labelCls}>Categoria</label>
                  <select
                    id="fin-categoria"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {(type === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900 text-slate-200">{cat}</option>
                    ))}
                  </select>
                </div>

                {isCardCategory && (
                  <div className="col-span-1 sm:col-span-2 bg-black/20 p-4 rounded-xl border border-white/5 space-y-3 shadow-inner">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={14} className="text-indigo-400" /> Lançamentos da Fatura
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">Enter para adicionar</span>
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        aria-label="Nome do item"
                        placeholder="Ex: Uber, Ifood..."
                        value={cartItemName}
                        onChange={(e) => setCartItemName(e.target.value)}
                        onKeyDown={handleCartKeyDown}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-base sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-500"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Valor do item"
                        placeholder="R$ 0,00"
                        value={cartItemValue}
                        onChange={(e) => setCartItemValue(formatCurrency(e.target.value))}
                        onKeyDown={handleCartKeyDown}
                        className="w-28 sm:w-32 bg-white/5 border border-white/10 rounded-lg p-2.5 text-base sm:text-sm text-center font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCartItem}
                        aria-label="Adicionar item"
                        className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors border border-indigo-500/20 shrink-0"
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    {cartItems.length > 0 && (
                      <div className="space-y-1.5 pt-2 max-h-32 overflow-y-auto custom-scrollbar border-t border-white/5">
                        {cartItems.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-xs bg-white/5 px-3 py-2 rounded-lg text-slate-300 border border-white/5">
                            <span className="font-semibold truncate pr-2">{item.nome}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono text-cyan-400 font-bold tracking-wider">{toBRL(item.valor)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCartItem(item.id)}
                                aria-label={`Remover ${item.nome}`}
                                className="text-slate-500 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label htmlFor="fin-descricao" className={labelCls}>
                    {isInvestmentCategory ? 'Nome do Ativo (ex: CDB Banco Inter / Tesouro Selic)' : 'Descrição'}
                  </label>
                  <input
                    id="fin-descricao"
                    type="text"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setFormError(''); }}
                    className={`${inputCls} placeholder:text-slate-600`}
                    placeholder={
                      isCardCategory ? 'Ex: Fatura Nubank (Opcional se usar carrinho)' :
                      isInvestmentCategory ? 'Use o mesmo nome do ativo da carteira (ex: Reserva CDB)' :
                      'Ex: Aluguel, Supermercado...'
                    }
                  />
                </div>

                <div>
                  <label htmlFor="fin-valor" className={labelCls}>
                    {installments > 1 ? 'Valor (por mês)' : 'Valor'}
                  </label>
                  <input
                    id="fin-valor"
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={handleAmountChange}
                    readOnly={amountLocked}
                    className={`${inputCls} font-mono placeholder:text-slate-600 ${amountLocked ? 'border-indigo-500/30 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : ''}`}
                    placeholder="R$ 0,00"
                  />
                </div>

                <div>
                  <label htmlFor="fin-status" className={labelCls}>Status</label>
                  <select
                    id="fin-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="pago" className="bg-slate-900 text-emerald-400">Pago / Recebido</option>
                    <option value="pendente" className="bg-slate-900 text-amber-400">Pendente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fin-data" className={labelCls}>Data</label>
                  <input
                    id="fin-data"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`}
                  />
                </div>

                {!editingId && (
                  <div>
                    <label htmlFor="fin-repetir" className={`${labelCls} flex items-center gap-1`}>
                      <Repeat size={12} className="text-indigo-400" /> Repetir (Meses)
                    </label>
                    <select
                      id="fin-repetir"
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className={`${inputCls} cursor-pointer`}
                    >
                      <option value={1} className="bg-slate-900">Única (1x)</option>
                      {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24, 36, 48, 60].map((n) => (
                        <option key={n} value={n} className="bg-slate-900">{n}x Mensais</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!editingId && installments > 1 && (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Serão criados {installments} lançamentos, um por mês, cada um com o valor acima. Os seguintes ficam como pendentes.
                </p>
              )}

              {formError && (
                <div role="alert" className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full mt-2 font-bold text-sm p-3.5 sm:p-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                  editingId
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-500/25'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40'
                }`}
              >
                {isSaving
                  ? <><RefreshCw size={16} className="animate-spin" /> Salvando...</>
                  : editingId
                    ? <><RefreshCw size={16} /> Atualizar Registro</>
                    : <><Plus size={16} /> Registrar Lançamento</>}
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
                {[
                  { id: 'despesa', label: 'Despesas', active: 'bg-rose-500/20 text-rose-300' },
                  { id: 'receita', label: 'Receitas', active: 'bg-emerald-500/20 text-emerald-300' },
                  { id: 'investimento', label: 'Carteira', active: 'bg-indigo-500/20 text-indigo-300' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChartType(tab.id)}
                    aria-pressed={chartType === tab.id}
                    className={`flex-1 whitespace-nowrap px-2 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-md transition-all ${chartType === tab.id ? tab.active : 'text-slate-400 hover:text-white'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full relative">
              {chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs sm:text-sm text-center px-4">
                  Sem dados operacionais para {chartType} neste {chartType === 'investimento' ? 'histórico' : 'período'}.
                </div>
              ) : (
                <>
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
                          <Cell key={`cell-${entry.name ?? index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip hideValues={hideValues} />} cursor={{ fill: 'transparent' }} />
                      <Legend
                        verticalAlign="bottom"
                        height={76}
                        iconType="circle"
                        wrapperStyle={{ paddingTop: '10px' }}
                        formatter={(value) => <span className="text-[10px] sm:text-[11px] font-medium text-slate-300 ml-1">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Total no centro: HTML sobreposto, mais confiável que <text> solto dentro do PieChart */}
                  <div
                    className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
                    style={{ top: '38%', transform: 'translateY(-50%)' }}
                  >
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Total</span>
                    <span className="text-white text-xs sm:text-sm font-mono font-bold">
                      {hideValues ? 'R$ •••••' : toBRL(chartTotalValue)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Extrato */}
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
                  aria-label="Buscar transações"
                  placeholder="Buscar por descrição ou categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-base sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Limpar busca"
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
                    aria-pressed={statusFilter === tab.id}
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

          {(actionError || storeError) && (
            <div role="alert" className="mb-4 flex items-start justify-between gap-3 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              <span>{actionError || storeError}</span>
              {storeError && !actionError && (
                <button type="button" onClick={fetchTransactions} className="shrink-0 underline hover:text-rose-200">
                  Tentar de novo
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 space-y-5">
            {groupedTransactions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Coins size={40} className="text-slate-600/50 sm:w-12 sm:h-12" />
                <p className="text-xs sm:text-sm">{isLoading ? 'Carregando lançamentos...' : 'Nenhuma transação encontrada para os filtros atuais.'}</p>
              </div>
            ) : (
              groupedTransactions.map(([dateLabel, dayTransactions]) => (
                <div key={dateLabel} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <Calendar size={12} className="text-indigo-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{dateLabel}</span>
                    <div className="flex-1 h-px bg-white/5"></div>
                  </div>

                  {dayTransactions.map((t) => (
                    <TransactionRow
                      key={t.id}
                      t={t}
                      hideValues={hideValues}
                      isConfirmingDelete={confirmDeleteId === t.id}
                      onEdit={handleEdit}
                      onToggle={(id) => runAction(() => toggleTransactionStatus(id))}
                      onDelete={handleDeleteClick}
                      onOpenFatura={(transaction, items) => setFaturaModal({ transaction, items })}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {faturaModal && (
        <FaturaModal
          transaction={faturaModal.transaction}
          items={faturaModal.items}
          hideValues={hideValues}
          onClose={closeFatura}
        />
      )}
    </div>
  );
}

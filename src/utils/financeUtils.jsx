import React from 'react';
import { 
  Home, ShoppingCart, Utensils, Car, Lightbulb, HeartPulse, 
  GraduationCap, Laptop, PartyPopper, Shirt, CreditCard, 
  Landmark, Heart, Wrench, Gift, ArrowUpFromLine, Briefcase, 
  Code, TrendingUp, ArrowDownToLine, RefreshCw, Tag, MoreHorizontal 
} from 'lucide-react';

export const CATEGORIAS_RECEITA = [
  'Salário', 'Freelance', 'Rendimentos/Dividendos', 'Resgate de Investimento',
  'Bolsa/Auxílio', 'Cashback', 'Vendas', 'Mesada/Doação', 'Outros'
];

export const CATEGORIAS_DESPESA = [
  'Moradia', 'Mercado', 'Alimentação Fora', 'Transporte', 
  'Contas Fixas', 'Saúde', 'Educação', 'Assinaturas', 
  'Lazer', 'Cuidados Pessoais', 'Cartão de Crédito', 
  'Aporte de Investimento', 'Impostos/Taxas', 'Pets', 'Manutenção', 'Presentes', 'Outros'
];

export const CORES_GRAFICO = [
  '#818cf8', '#34d399', '#fbbf24', '#22d3ee', '#a78bfa', 
  '#f472b6', '#fb7185', '#94a3b8', '#38bdf8', '#f87171'
];

export const MESES = [
  { valor: '01', nome: 'Janeiro' }, { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' }, { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' }, { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' }, { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' }, { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' }, { valor: '12', nome: 'Dezembro' }
];

export const getCategoryIcon = (category) => {
  switch (category) {
    case 'Moradia': return <Home size={14} className="text-indigo-400" />;
    case 'Mercado': return <ShoppingCart size={14} className="text-orange-400" />;
    case 'Alimentação Fora': return <Utensils size={14} className="text-amber-400" />;
    case 'Transporte': return <Car size={14} className="text-sky-400" />;
    case 'Contas Fixas': return <Lightbulb size={14} className="text-yellow-400" />;
    case 'Saúde': return <HeartPulse size={14} className="text-rose-400" />;
    case 'Educação': return <GraduationCap size={14} className="text-purple-400" />;
    case 'Assinaturas': return <Laptop size={14} className="text-cyan-400" />;
    case 'Lazer': return <PartyPopper size={14} className="text-fuchsia-400" />;
    case 'Cuidados Pessoais': return <Shirt size={14} className="text-pink-400" />;
    case 'Cartão de Crédito': return <CreditCard size={14} className="text-slate-300" />;
    case 'Impostos/Taxas': return <Landmark size={14} className="text-slate-400" />;
    case 'Pets': return <Heart size={14} className="text-red-400" />;
    case 'Manutenção': return <Wrench size={14} className="text-slate-400" />;
    case 'Presentes': return <Gift size={14} className="text-rose-300" />;
    case 'Aporte de Investimento': return <ArrowUpFromLine size={14} className="text-emerald-400" />;
    
    case 'Salário': return <Briefcase size={14} className="text-emerald-400" />;
    case 'Bolsa/Auxílio': return <GraduationCap size={14} className="text-blue-400" />;
    case 'Freelance': return <Code size={14} className="text-teal-400" />;
    case 'Rendimentos/Dividendos': return <TrendingUp size={14} className="text-green-400" />;
    case 'Resgate de Investimento': return <ArrowDownToLine size={14} className="text-amber-400" />;
    case 'Cashback': return <RefreshCw size={14} className="text-emerald-300" />;
    case 'Vendas': return <Tag size={14} className="text-indigo-300" />;
    case 'Mesada/Doação': return <Gift size={14} className="text-purple-300" />;
    
    default: return <MoreHorizontal size={14} className="text-slate-400" />;
  }
};

// Formatadores Monetários
export const formatCurrency = (value) => {
  if (value === null || value === undefined) return '';
  const valueString = value.toString().replace(/\D/g, '');
  if (valueString === '') return '';
  const numericValue = parseFloat(valueString) / 100;
  return numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const unmaskCurrency = (formattedValue) => {
  if (!formattedValue) return 0;
  const valueString = formattedValue.toString().replace(/\D/g, '');
  if (valueString === '') return 0;
  return parseFloat(valueString) / 100;
};

// Manipuladores de Data
export const getTodayFormatted = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeDateISO = (dateString) => {
  if (!dateString) return getTodayFormatted();
  if (dateString.includes('/')) {
    const [d, m, y] = dateString.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateString;
};

export const formatDateToBR = (dateString) => {
  if (!dateString) return '';
  if (dateString.includes('/')) return dateString; 
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

export const addMonthsToDate = (isoDate, monthsToAdd) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const targetDate = new Date(y, m - 1 + monthsToAdd, d);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helpers de Fatura do Cartão de Crédito (Serialização / Deserialização)
export const parseFaturaDescription = (description = '', category = '') => {
  const isFaturaCartao = category === 'Cartão de Crédito' && description.includes('[');
  if (!isFaturaCartao) {
    return { isFaturaCartao: false, mainTitle: description, items: [] };
  }

  const mainTitle = description.split(' [')[0];
  const rawItems = description.match(/\[(.*?)\|([0-9.]+)\]/g) || [];
  const items = rawItems.map((str, idx) => {
    const clean = str.replace('[', '').replace(']', '');
    const [nome, valor] = clean.split('|');
    return { id: Date.now() + idx, nome, valor: Number(valor) };
  });

  return { isFaturaCartao: true, mainTitle, items };
};

export const serializeFaturaDescription = (baseDescription, category, cartItems = []) => {
  if (category === 'Cartão de Crédito' && cartItems.length > 0) {
    const strItems = cartItems.map(i => `[${i.nome}|${i.valor}]`).join(' ');
    return `${baseDescription} ${strItems}`;
  }
  return baseDescription;
};
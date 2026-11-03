// src/utils/financeUtils.jsx
import React from 'react';
import {
  Briefcase, GraduationCap, Laptop, PiggyBank, TrendingUp, PlusCircle,
  Home, ShoppingCart, Utensils, Car, FileText, HeartPulse, BookOpen,
  Tv, Smile, CreditCard, Landmark, Tag
} from 'lucide-react';

export const CATEGORIAS_RECEITA = [
  'Bolsa/Auxílio',
  'Salário',
  'Freelance',
  'Rendimento de Investimento', // <- NOVO: Soma direto na Carteira Investida sem passar pela Conta Corrente!
  'Resgate de Investimento',
  'Outros'
];

export const CATEGORIAS_DESPESA = [
  'Moradia',
  'Mercado',
  'Alimentação Fora',
  'Transporte',
  'Contas Fixas',
  'Saúde',
  'Educação',
  'Assinaturas',
  'Lazer',
  'Cartão de Crédito',
  'Aporte de Investimento',
  'Outros'
];

export const CORES_GRAFICO = [
  '#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#3b82f6', '#eab308'
];

export const MESES = [
  { valor: '01', nome: 'Janeiro' },
  { valor: '02', nome: 'Fevereiro' },
  { valor: '03', nome: 'Março' },
  { valor: '04', nome: 'Abril' },
  { valor: '05', nome: 'Maio' },
  { valor: '06', nome: 'Junho' },
  { valor: '07', nome: 'Julho' },
  { valor: '08', nome: 'Agosto' },
  { valor: '09', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' }
];

export const getCategoryIcon = (category) => {
  switch (category) {
    case 'Salário': return <Briefcase size={18} className="text-emerald-400" />;
    case 'Bolsa/Auxílio': return <GraduationCap size={18} className="text-cyan-400" />;
    case 'Freelance': return <Laptop size={18} className="text-indigo-400" />;
    case 'Rendimento de Investimento': return <TrendingUp size={18} className="text-emerald-400" />;
    case 'Resgate de Investimento': return <Landmark size={18} className="text-teal-400" />;
    case 'Aporte de Investimento': return <PiggyBank size={18} className="text-emerald-400" />;
    case 'Moradia': return <Home size={18} className="text-indigo-400" />;
    case 'Mercado': return <ShoppingCart size={18} className="text-amber-400" />;
    case 'Alimentação Fora': return <Utensils size={18} className="text-orange-400" />;
    case 'Transporte': return <Car size={18} className="text-blue-400" />;
    case 'Contas Fixas': return <FileText size={18} className="text-slate-300" />;
    case 'Saúde': return <HeartPulse size={18} className="text-rose-400" />;
    case 'Educação': return <BookOpen size={18} className="text-purple-400" />;
    case 'Assinaturas': return <Tv size={18} className="text-fuchsia-400" />;
    case 'Lazer': return <Smile size={18} className="text-pink-400" />;
    case 'Cartão de Crédito': return <CreditCard size={18} className="text-indigo-400" />;
    default: return <Tag size={18} className="text-slate-400" />;
  }
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const numberValue = parseInt(digits, 10) / 100;
  return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const unmaskCurrency = (formattedValue) => {
  if (typeof formattedValue === 'number') return formattedValue;
  if (!formattedValue) return 0;
  const digits = String(formattedValue).replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

export const getTodayFormatted = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeDateISO = (dateStr) => {
  if (!dateStr) return getTodayFormatted();
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr.substring(0, 10);
};

export const addMonthsToDate = (isoDateStr, monthsToAdd) => {
  const clean = normalizeDateISO(isoDateStr);
  const [year, month, day] = clean.split('-').map(Number);
  const d = new Date(year, month - 1 + monthsToAdd, day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const parseFaturaDescription = (description = '', category = '') => {
  const raw = String(description || '');
  const markerIndex = raw.indexOf(' [ITENS:');
  if (markerIndex !== -1 && raw.endsWith(']')) {
    const mainTitle = raw.substring(0, markerIndex).trim();
    const jsonPart = raw.substring(markerIndex + 8, raw.length - 1);
    try {
      const items = JSON.parse(jsonPart);
      return { isFaturaCartao: true, mainTitle, items: Array.isArray(items) ? items : [] };
    } catch {
      return { isFaturaCartao: category === 'Cartão de Crédito', mainTitle: raw, items: [] };
    }
  }
  return { isFaturaCartao: false, mainTitle: raw, items: [] };
};

export const serializeFaturaDescription = (baseDescription, category, cartItems = []) => {
  const cleanDesc = String(baseDescription || '').split(' [ITENS:')[0].trim();
  if (category === 'Cartão de Crédito' && Array.isArray(cartItems) && cartItems.length > 0) {
    return `${cleanDesc} [ITENS:${JSON.stringify(cartItems)}]`;
  }
  return cleanDesc;
};
// src/utils/financeUtils.jsx
import React from 'react';
import {
  Briefcase, GraduationCap, Laptop, PiggyBank, TrendingUp,
  Home, ShoppingCart, Utensils, Car, FileText, HeartPulse, BookOpen,
  Tv, Smile, CreditCard, Landmark, Tag
} from 'lucide-react';

export const CATEGORIAS_RECEITA = [
  'Bolsa/Auxílio',
  'Salário',
  'Freelance',
  'Rendimento de Investimento',
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

export const formatDateToBR = (dateStr) => {
  if (!dateStr) return '';
  const iso = normalizeDateISO(dateStr);
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return dateStr;
  return `${dd}/${mm}/${yyyy}`;
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

// Reconhece TODOS os formatos de fatura:
// 1) "Fatura [{\"id\":1,\"nome\":\"Uber\",\"valor\":20}]" (JSON array direto)
// 2) "Fatura [ITENS:[{\"id\":1,...}]]"
// 3) "Fatura [Uber: R$ 20,00 | Ifood: R$ 35,00]" (Texto legado entre colchetes)
export const parseFaturaDescription = (description = '', category = '') => {
  const raw = String(description || '').trim();

  // Caso 1: Formato com tag [ITENS:...]
  const itensMarker = raw.indexOf(' [ITENS:');
  if (itensMarker !== -1 && raw.endsWith(']')) {
    const mainTitle = raw.substring(0, itensMarker).trim();
    const jsonPart = raw.substring(itensMarker + 8, raw.length - 1);
    try {
      const items = JSON.parse(jsonPart);
      if (Array.isArray(items)) {
        return { isFaturaCartao: items.length > 0, mainTitle, items };
      }
    } catch {}
  }

  // Caso 2: Formato com JSON Array direto "Titulo [{\"id\":...}]"
  const jsonArrayMarker = raw.indexOf(' [{');
  if (jsonArrayMarker !== -1) {
    const mainTitle = raw.substring(0, jsonArrayMarker).trim();
    const jsonPart = raw.substring(jsonArrayMarker + 1).trim();
    try {
      const items = JSON.parse(jsonPart);
      if (Array.isArray(items)) {
        return { isFaturaCartao: items.length > 0, mainTitle, items };
      }
    } catch {}
  }

  // Caso 3: Formato texto entre colchetes "Fatura [Item 1: R$ 10 | Item 2: R$ 20]"
  const bracketStart = raw.indexOf(' [');
  if (bracketStart !== -1 && raw.endsWith(']')) {
    const mainTitle = raw.substring(0, bracketStart).trim();
    const insideBrackets = raw.substring(bracketStart + 2, raw.length - 1).trim();

    // Tenta parsear caso seja um array JSON válido
    if (insideBrackets.startsWith('{') || insideBrackets.startsWith('[')) {
      try {
        const parsed = JSON.parse(insideBrackets.startsWith('[') ? insideBrackets : `[${insideBrackets}]`);
        if (Array.isArray(parsed)) {
          return { isFaturaCartao: parsed.length > 0, mainTitle, items: parsed };
        }
      } catch {}
    }

    // Se for string separada por "|" ou "," (ex: "Uber: R$ 15,00 | Ifood: R$ 40,00")
    const textParts = insideBrackets.split(/\s*\|\s*|\s*;\s*/).filter(Boolean);
    if (textParts.length > 0) {
      const parsedItems = textParts.map((part, idx) => {
        const [nomePart, valPart] = part.split(':');
        if (valPart !== undefined) {
          const cleanVal = parseFloat(valPart.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
          return { id: idx + 1, nome: nomePart.trim(), valor: cleanVal };
        }
        return { id: idx + 1, nome: part.trim(), valor: 0 };
      });
      return { isFaturaCartao: true, mainTitle, items: parsedItems };
    }
  }

  return {
    isFaturaCartao: false,
    mainTitle: raw,
    items: []
  };
};

// Salva no formato limpo e retrocompatível "Titulo [{\"id\":...,\"nome\":...,\"valor\":...}]"
export const serializeFaturaDescription = (baseDescription, category, cartItems = []) => {
  const { mainTitle } = parseFaturaDescription(baseDescription, category);
  const cleanDesc = mainTitle || 'Fatura Cartão de Crédito';
  if (category === 'Cartão de Crédito' && Array.isArray(cartItems) && cartItems.length > 0) {
    return `${cleanDesc} ${JSON.stringify(cartItems)}`;
  }
  return cleanDesc;
};
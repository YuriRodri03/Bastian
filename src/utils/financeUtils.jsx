// src/utils/financeUtils.jsx
import React from 'react';
import {
  Briefcase, GraduationCap, Laptop, PiggyBank, TrendingUp,
  Home, ShoppingCart, Utensils, Car, FileText, HeartPulse, BookOpen,
  Tv, Smile, CreditCard, Landmark, Tag
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

// Nomes especiais usados na lógica (evita strings repetidas em vários arquivos)
export const CATEGORIA_CARTAO = 'Cartão de Crédito';
export const CATEGORIA_APORTE = 'Aporte de Investimento';
export const CATEGORIA_RENDIMENTO = 'Rendimento de Investimento';
export const CATEGORIA_RESGATE = 'Resgate de Investimento';

export const CATEGORIAS_RECEITA = [
  'Bolsa/Auxílio',
  'Salário',
  'Freelance',
  CATEGORIA_RENDIMENTO,
  CATEGORIA_RESGATE,
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
  CATEGORIA_CARTAO,
  CATEGORIA_APORTE,
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

/* ------------------------------------------------------------------ */
/* Ícones                                                              */
/* ------------------------------------------------------------------ */

// Classes escritas por extenso para o Tailwind detectá-las
const CATEGORY_ICONS = {
  'Salário': [Briefcase, 'text-emerald-400'],
  'Bolsa/Auxílio': [GraduationCap, 'text-cyan-400'],
  'Freelance': [Laptop, 'text-indigo-400'],
  [CATEGORIA_RENDIMENTO]: [TrendingUp, 'text-emerald-400'],
  [CATEGORIA_RESGATE]: [Landmark, 'text-teal-400'],
  [CATEGORIA_APORTE]: [PiggyBank, 'text-emerald-400'],
  'Moradia': [Home, 'text-indigo-400'],
  'Mercado': [ShoppingCart, 'text-amber-400'],
  'Alimentação Fora': [Utensils, 'text-orange-400'],
  'Transporte': [Car, 'text-blue-400'],
  'Contas Fixas': [FileText, 'text-slate-300'],
  'Saúde': [HeartPulse, 'text-rose-400'],
  'Educação': [BookOpen, 'text-purple-400'],
  'Assinaturas': [Tv, 'text-fuchsia-400'],
  'Lazer': [Smile, 'text-pink-400'],
  [CATEGORIA_CARTAO]: [CreditCard, 'text-indigo-400']
};

export const getCategoryIcon = (category) => {
  const [Icon, color] = CATEGORY_ICONS[category] || [Tag, 'text-slate-400'];
  return <Icon size={18} className={color} />;
};

/* ------------------------------------------------------------------ */
/* Moeda                                                               */
/* ------------------------------------------------------------------ */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// 12 dígitos = até R$ 9.999.999.999,99. Acima disso o parseInt perderia precisão.
const MAX_DIGITS = 12;
const onlyDigits = (value) => String(value).replace(/\D/g, '').slice(0, MAX_DIGITS);

// Máscara de digitação: "1234" -> "R$ 12,34"
export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const digits = onlyDigits(value);
  if (!digits) return '';
  return BRL.format(parseInt(digits, 10) / 100);
};

// Só deve receber texto vindo da máscara acima (ou um número já pronto)
export const unmaskCurrency = (formattedValue) => {
  if (typeof formattedValue === 'number') return formattedValue;
  if (!formattedValue) return 0;
  const digits = onlyDigits(formattedValue);
  return digits ? parseInt(digits, 10) / 100 : 0;
};

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, '0');
const toLocalISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Data local (não usa toISOString, que é UTC e vira "amanhã" à noite no Brasil)
export const getTodayFormatted = () => toLocalISO(new Date());

export const normalizeDateISO = (dateStr) => {
  if (!dateStr) return getTodayFormatted();
  if (dateStr instanceof Date) {
    return Number.isNaN(dateStr.getTime()) ? getTodayFormatted() : toLocalISO(dateStr);
  }
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    if (d && m && y) return `${y.slice(0, 4)}-${pad2(m)}-${pad2(d)}`;
  }
  return str.substring(0, 10);
};

export const formatDateToBR = (dateStr) => {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = normalizeDateISO(dateStr).split('-');
  if (!yyyy || !mm || !dd) return String(dateStr);
  return `${dd}/${mm}/${yyyy}`;
};

// Soma meses mantendo o dia, limitado ao último dia do mês de destino.
// Antes: 31/01 + 1 mês virava 03/03 (Fev 31 "transborda"), pulando fevereiro.
export const addMonthsToDate = (isoDateStr, monthsToAdd) => {
  const clean = normalizeDateISO(isoDateStr);
  const [year, month, day] = clean.split('-').map(Number);
  if ([year, month, day].some(Number.isNaN)) return clean;

  const target = new Date(year, month - 1 + monthsToAdd, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toLocalISO(target);
};

/* ------------------------------------------------------------------ */
/* Descrição de fatura                                                 */
/* ------------------------------------------------------------------ */

// Garante que todo item tenha id, nome (string) e valor (número)
const normalizeItems = (list) =>
  list
    .filter((it) => it && typeof it === 'object')
    .map((it, idx) => ({
      ...it,
      id: it.id ?? idx + 1,
      nome: String(it.nome ?? '').trim(),
      valor: Number(it.valor) || 0
    }));

const tryParseItems = (text) => {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? normalizeItems(parsed) : null;
  } catch {
    return null;
  }
};

// Reconhece os formatos de fatura:
// 1) "Fatura [ITENS:[{...}]]"
// 2) "Fatura [{...}]"  (formato atual, JSON direto)
// 3) "Fatura [Uber: R$ 20,00 | Ifood: R$ 35,00]"  (legado; SÓ para a categoria Cartão de Crédito,
//    senão uma descrição comum como "Aluguel [apto 12]" viraria uma fatura)
export const parseFaturaDescription = (description = '', category = '') => {
  const raw = String(description ?? '').trim();
  const found = (mainTitle, items) => ({ isFaturaCartao: items.length > 0, mainTitle, items });

  const itensMarker = raw.indexOf(' [ITENS:');
  if (itensMarker !== -1 && raw.endsWith(']')) {
    const items = tryParseItems(raw.slice(itensMarker + 8, -1));
    if (items) return found(raw.slice(0, itensMarker).trim(), items);
  }

  const jsonMarker = raw.indexOf(' [{');
  if (jsonMarker !== -1 && raw.endsWith(']')) {
    const items = tryParseItems(raw.slice(jsonMarker + 1));
    if (items) return found(raw.slice(0, jsonMarker).trim(), items);
  }

  if (category === CATEGORIA_CARTAO) {
    const bracketStart = raw.indexOf(' [');
    if (bracketStart !== -1 && raw.endsWith(']')) {
      const inside = raw.slice(bracketStart + 2, -1).trim();
      // JSON quebrado não vira item falso: mostra o texto original
      const looksLikeJson = /^(ITENS:|[{[])/.test(inside);
      const parts = looksLikeJson ? [] : inside.split(/\s*[|;]\s*/).filter(Boolean);

      if (parts.length > 0) {
        const items = parts.map((part, idx) => {
          const sep = part.lastIndexOf(':'); // nomes podem conter ":"
          if (sep === -1) return { id: idx + 1, nome: part.trim(), valor: 0 };
          const valor = parseFloat(part.slice(sep + 1).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
          return { id: idx + 1, nome: part.slice(0, sep).trim(), valor };
        });
        return found(raw.slice(0, bracketStart).trim(), items);
      }
    }
  }

  return { isFaturaCartao: false, mainTitle: raw, items: [] };
};

// Salva no formato "Titulo [{"id":...,"nome":...,"valor":...}]"
export const serializeFaturaDescription = (baseDescription, category, cartItems = []) => {
  // Sem categoria: só remove um sufixo JSON já existente, sem interpretar "[texto]" digitado pelo usuário
  const { mainTitle } = parseFaturaDescription(baseDescription);
  const isCard = category === CATEGORIA_CARTAO;
  // O título padrão de fatura só vale para cartão (antes qualquer categoria vazia virava "Fatura...")
  const cleanDesc = mainTitle || (isCard ? 'Fatura Cartão de Crédito' : '');

  if (isCard && Array.isArray(cartItems) && cartItems.length > 0) {
    const items = cartItems.map(({ id, nome, valor }) => ({ id, nome, valor }));
    return `${cleanDesc} ${JSON.stringify(items)}`;
  }
  return cleanDesc;
};

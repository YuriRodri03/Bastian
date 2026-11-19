// src/store/storeHelpers.js
// Funções repetidas nos stores da Agenda, Inbox e Kanban, reunidas em um lugar só.
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

// ID do usuário sem ida à rede quando já está no AuthStore
export const resolveUserId = async () => {
  const cachedId = useAuthStore.getState()?.user?.id;
  if (cachedId) return cachedId;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

// Compara ids de tipos diferentes (número no banco, texto no drag & drop)
export const sameId = (a, b) => String(a) === String(b);

// Data local de hoje em AAAA-MM-DD (toISOString usaria UTC e viraria "amanhã" à noite no Brasil)
export const getLocalTodayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const isISODate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

// O Supabase devolve no máximo 1000 linhas por requisição. Sem paginar, o excedente some em silêncio.
// buildQuery recebe a consulta e aplica filtros/ordem. Inclua sempre um desempate (ex.: .order('id')).
export const fetchAllRows = async (table, buildQuery, pageSize = 1000) => {
  const rows = [];
  let from = 0;
  let total = Infinity;

  while (from < total) {
    let query = supabase.from(table).select('*', { count: 'exact' });
    if (buildQuery) query = buildQuery(query);

    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;

    total = count ?? 0;
    if (!data || data.length === 0) break;

    rows.push(...data);
    from += data.length; // avança pelo que veio de fato (o servidor pode limitar abaixo de pageSize)
  }
  return rows;
};
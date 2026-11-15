// src/store/useFinanceStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 1000; // limite padrão de linhas por requisição no Supabase
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Saldo em Conta e Total Investido (mesma regra do useFinanceMetrics: se mudar aqui, mude lá)
export const calculateStoreTotals = (transactions = []) => {
  const totals = transactions.reduce(
    (acc, t) => {
      if ((t.status || 'pago') !== 'pago') return acc;

      const val = Number(t.amount) || 0;
      const isAporte = t.category === 'Aporte de Investimento';
      const isRendimento = t.category === 'Rendimento de Investimento';
      const isResgate = t.category === 'Resgate de Investimento';

      // Rendimentos reinvestidos ficam direto na carteira, não entram na conta
      if (t.type === 'receita' && !isRendimento) acc.balance += val;
      if (t.type === 'despesa') acc.balance -= val;

      if (isAporte || isRendimento) acc.investedBalance += val;
      if (isResgate) acc.investedBalance -= val;

      return acc;
    },
    { balance: 0, investedBalance: 0 }
  );
  return { balance: round2(totals.balance), investedBalance: round2(totals.investedBalance) };
};

// Estado completo derivado de uma lista (transações + totais sempre juntos)
const withTotals = (transactions) => ({ transactions, ...calculateStoreTotals(transactions) });

const sameId = (a, b) => String(a) === String(b);

// Busca TODAS as linhas. Sem isso o Supabase corta em 1000 e os saldos ficam errados em silêncio
// (fácil de atingir com lançamentos repetidos em até 60 meses).
const fetchAllTransactions = async () => {
  const rows = [];
  let from = 0;
  let total = Infinity;

  while (from < total) {
    const { data, error, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .order('id', { ascending: false }) // desempate: paginação precisa de ordem estável
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    total = count ?? 0;
    if (!data || data.length === 0) break;

    rows.push(...data);
    from += data.length; // avança pelo que veio de fato (o servidor pode limitar abaixo de PAGE_SIZE)
  }
  return rows;
};

// Evita duas trocas de status simultâneas na mesma transação (duplo clique)
const togglesInFlight = new Set();

export const useFinanceStore = create((set, get) => ({
  transactions: [],
  balance: 0,
  investedBalance: 0,
  isLoading: false,
  error: null,

  // 1. Busca inicial
  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await fetchAllTransactions();
      set(withTotals(rows));
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      set({ error: 'Não foi possível carregar seus lançamentos.' });
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. Criar (1 objeto ou Array de parcelas em lote; o insert em array é atômico)
  addTransaction: async (transactionInput) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Usuário não autenticado:', userError);
      throw new Error('Usuário não autenticado');
    }

    const itemsArray = Array.isArray(transactionInput) ? transactionInput : [transactionInput];

    const payloads = itemsArray.map((item) => {
      const { id, ...dataToInsert } = item;
      return {
        ...dataToInsert,
        amount: Number(dataToInsert.amount) || 0,
        user_id: user.id
      };
    });

    const { data, error } = await supabase.from('transactions').insert(payloads).select();

    if (error) {
      console.error('[Supabase] Erro detalhado ao adicionar:', error.message, error.details, error.hint);
      throw error; // repassado para quem chamou (Financeiro / BarraComandoIA)
    }

    const insertedItems = data || [];
    set((state) => withTotals([...insertedItems, ...state.transactions]));

    return insertedItems.length === 1 ? insertedItems[0] : insertedItems;
  },

  // 3. Atualizar
  updateTransaction: async (updatedTransaction) => {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        amount: Number(updatedTransaction.amount) || 0,
        description: updatedTransaction.description,
        type: updatedTransaction.type,
        category: updatedTransaction.category,
        date: updatedTransaction.date,
        status: updatedTransaction.status
      })
      .eq('id', updatedTransaction.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar:', error);
      throw error;
    }

    set((state) => withTotals(state.transactions.map((t) => (sameId(t.id, data.id) ? data : t))));
  },

  // 4. Deletar
  deleteTransaction: async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error('Erro ao remover:', error);
      throw error;
    }

    set((state) => withTotals(state.transactions.filter((t) => !sameId(t.id, id))));
  },

  // 5. Alternar status rápido (pago <-> pendente)
  toggleTransactionStatus: async (id) => {
    const key = String(id);
    if (togglesInFlight.has(key)) return;

    const transaction = get().transactions.find((t) => sameId(t.id, id));
    if (!transaction) return;

    const newStatus = (transaction.status || 'pago') === 'pago' ? 'pendente' : 'pago';

    togglesInFlight.add(key);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', transaction.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao mudar status:', error);
        throw error;
      }

      set((state) => withTotals(state.transactions.map((t) => (sameId(t.id, transaction.id) ? data : t))));
    } finally {
      togglesInFlight.delete(key);
    }
  },

  // 6. Limpa tudo (chame no logout: o store é global e guardaria os dados do usuário anterior)
  reset: () => set({ transactions: [], balance: 0, investedBalance: 0, isLoading: false, error: null })
}));

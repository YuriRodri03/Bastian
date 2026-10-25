import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Utilitário para calcular Saldo em Conta e Total Investido de forma 100% sincronizada
const calculateStoreTotals = (transactions = []) => {
  return transactions.reduce(
    (acc, t) => {
      const isRealized = (t.status || 'pago') === 'pago';
      if (isRealized) {
        const val = Number(t.amount) || 0;
        if (t.type === 'receita') acc.balance += val;
        if (t.type === 'despesa') acc.balance -= val;

        if (t.category === 'Aporte de Investimento') acc.investedBalance += val;
        if (t.category === 'Resgate de Investimento') acc.investedBalance -= val;
      }
      return acc;
    },
    { balance: 0, investedBalance: 0 }
  );
};

export const useFinanceStore = create((set, get) => ({
  transactions: [],
  balance: 0,
  investedBalance: 0,
  isLoading: false,

  // 1. Busca inicial
  fetchTransactions: async () => {
    set({ isLoading: true });

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar dados:', error);
    } else {
      const safeData = data || [];
      const { balance, investedBalance } = calculateStoreTotals(safeData);
      set({
        transactions: safeData,
        balance,
        investedBalance
      });
    }

    set({ isLoading: false });
  },

  // 2. Criar (Suporta tanto 1 objeto quanto um Array de parcelas em lote!)
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

    const { data, error } = await supabase
      .from('transactions')
      .insert(payloads)
      .select();

    if (error) {
      console.error('[Supabase] Erro detalhado ao adicionar:', error.message, error.details, error.hint);
      throw error; // Repassado para o Bastian / BarraComandoIA
    }

    const insertedItems = data || [];
    const currentTransactions = get().transactions;
    const newTransactions = [...insertedItems, ...currentTransactions];
    const { balance, investedBalance } = calculateStoreTotals(newTransactions);

    set({
      transactions: newTransactions,
      balance,
      investedBalance
    });

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

    const currentTransactions = get().transactions;
    const newTransactions = currentTransactions.map((t) =>
      t.id === data.id ? data : t
    );
    const { balance, investedBalance } = calculateStoreTotals(newTransactions);

    set({
      transactions: newTransactions,
      balance,
      investedBalance
    });
  },

  // 4. Deletar (Sincronizado com a BarraComandoIA)
  deleteTransaction: async (id) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover:', error);
      throw error;
    }

    const currentTransactions = get().transactions;
    const newTransactions = currentTransactions.filter((t) => t.id !== id);
    const { balance, investedBalance } = calculateStoreTotals(newTransactions);

    set({
      transactions: newTransactions,
      balance,
      investedBalance
    });
  },

  // 5. Alternar Status Rápido
  toggleTransactionStatus: async (id) => {
    const transaction = get().transactions.find((t) => t.id === id);
    if (!transaction) return;

    const currentStatus = transaction.status || 'pago';
    const newStatus = currentStatus === 'pago' ? 'pendente' : 'pago';

    const { data, error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao mudar status:', error);
      throw error;
    }

    const currentTransactions = get().transactions;
    const newTransactions = currentTransactions.map((t) =>
      t.id === id ? data : t
    );
    const { balance, investedBalance } = calculateStoreTotals(newTransactions);

    set({
      transactions: newTransactions,
      balance,
      investedBalance
    });
  }
}));
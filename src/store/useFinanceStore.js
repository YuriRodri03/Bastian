import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Função utilitária para garantir que o saldo esteja sempre 100% sincronizado com a lista
const calculateBalance = (transactions) => {
  return transactions.reduce((acc, t) => {
    const isRealized = (t.status || 'pago') === 'pago';
    if (isRealized) {
      return t.type === 'receita' ? acc + t.amount : acc - t.amount;
    }
    return acc;
  }, 0);
};

export const useFinanceStore = create((set, get) => ({
  transactions: [],
  balance: 0,
  isLoading: false,

  // 1. Busca inicial
  fetchTransactions: async () => {
    set({ isLoading: true });
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error("Erro ao buscar dados:", error);
    } else {
      set({ 
        transactions: data, 
        balance: calculateBalance(data) 
      });
    }
    
    set({ isLoading: false });
  },

  // 2. Criar
  addTransaction: async (transactionData) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Usuário não autenticado:", userError);
      throw new Error("Usuário não autenticado"); // Alerta de falha repassado
    }

    const { id, ...dataToInsert } = transactionData;
    const payload = {
      ...dataToInsert,
      user_id: user.id
    };
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("[Supabase] Erro detalhado ao adicionar:", error.message, error.details, error.hint);
      throw error; // Alerta crítico repassado para o Bastian
    }

    const currentTransactions = get().transactions;
    const newTransactions = [data, ...currentTransactions];
    
    set({ 
      transactions: newTransactions, 
      balance: calculateBalance(newTransactions) 
    });
  },

  // 3. Atualizar
  updateTransaction: async (updatedTransaction) => {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        amount: updatedTransaction.amount,
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
      console.error("Erro ao atualizar:", error);
      throw error; // Alerta crítico
    }

    const currentTransactions = get().transactions;
    const newTransactions = currentTransactions.map(t => 
      t.id === data.id ? data : t
    );

    set({ 
      transactions: newTransactions, 
      balance: calculateBalance(newTransactions) 
    });
  },

  // 4. Deletar (Renomeado para sincronizar com a BarraComandoIA)
  deleteTransaction: async (id) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Erro ao remover:", error);
      throw error; // Alerta crítico
    }

    const currentTransactions = get().transactions;
    const newTransactions = currentTransactions.filter(t => t.id !== id);

    set({ 
      transactions: newTransactions, 
      balance: calculateBalance(newTransactions) 
    });
  },

  // 5. Alternar Status Rápido
  toggleTransactionStatus: async (id) => {
    const transaction = get().transactions.find(t => t.id === id);
    if (!transaction) return;

    const newStatus = transaction.status === 'pago' ? 'pendente' : 'pago';

    const { data, error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error("Erro ao mudar status:", error);
      throw error; // Alerta crítico
    }

    const currentTransactions = get().transactions;
    const newTransactions = currentTransactions.map(t => 
      t.id === id ? data : t
    );

    set({ 
      transactions: newTransactions, 
      balance: calculateBalance(newTransactions) 
    });
  }
}));
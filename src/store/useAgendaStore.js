import { create } from 'zustand';
import { supabase } from '../lib/supabase'; 
import { useAuthStore } from './useAuthStore';

export const useAgendaStore = create((set, get) => ({
  agendaItems: [],
  projects: [],
  isLoading: false,
  error: null,

  // 1. BUSCAR ITENS DA AGENDA
  fetchAgendaItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('agenda_items')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) throw error;
      set({ agendaItems: data });
    } catch (error) {
      set({ error: error.message });
      console.error('Erro ao buscar agenda:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. ADICIONAR NOVO ITEM NA AGENDA (Evento, Tarefa, etc)
  addAgendaItem: async (item) => {
    set({ isLoading: true, error: null });
    
    const userId = useAuthStore.getState().user?.id;
    
    if (!userId) {
      set({ error: 'Usuário não autenticado', isLoading: false });
      throw new Error('Usuário não autenticado'); // Repassa o erro
    }

    try {
      const { data, error } = await supabase
        .from('agenda_items')
        .insert([{ ...item, user_id: userId }])
        .select();

      if (error) throw error;
      
      set((state) => ({ agendaItems: [...state.agendaItems, data[0]] }));
      return data[0];
    } catch (error) {
      set({ error: error.message });
      console.error('[Supabase] Erro Crítico ao adicionar item na Agenda:', error);
      throw error; // O SEGREDO ESTÁ AQUI: Isso faz o Bastian saber que falhou!
    } finally {
      set({ isLoading: false });
    }
  },

  // 3. ATUALIZAR ITEM EXISTENTE (Editar)
  updateAgendaItem: async (id, updatedItem) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('agenda_items')
        .update(updatedItem)
        .eq('id', id)
        .select();

      if (error) throw error;

      set((state) => ({
        agendaItems: state.agendaItems.map((item) =>
          item.id === id ? { ...item, ...data[0] } : item
        ),
      }));
    } catch (error) {
      set({ error: error.message });
      console.error('Erro ao atualizar item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 4. DELETAR ITEM DA AGENDA (Excluir)
  deleteAgendaItem: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('agenda_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        agendaItems: state.agendaItems.filter((item) => item.id !== id),
      }));
    } catch (error) {
      set({ error: error.message });
      console.error('Erro ao deletar item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 5. MARCAR COMO CONCLUÍDO/PENDENTE
  toggleItemCompletion: async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('agenda_items')
        .update({ is_completed: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        agendaItems: state.agendaItems.map((item) =>
          item.id === id ? { ...item, is_completed: !currentStatus } : item
        ),
      }));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  }
}));
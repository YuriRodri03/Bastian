import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

// Mantém a lista sempre ordenada por Data e Horário no estado local
const sortAgendaItems = (items = []) => {
  return [...items].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
};

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
      set({ agendaItems: sortAgendaItems(data || []) });
    } catch (error) {
      set({ error: error.message });
      console.error('Erro ao buscar agenda:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. ADICIONAR NOVO ITEM (Aceita 1 objeto OU um Array para eventos recorrentes em lote!)
  addAgendaItem: async (itemInput) => {
    set({ isLoading: true, error: null });

    let userId = useAuthStore.getState().user?.id;
    if (!userId) {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id;
    }

    if (!userId) {
      set({ error: 'Usuário não autenticado', isLoading: false });
      throw new Error('Usuário não autenticado');
    }

    const itemsArray = Array.isArray(itemInput) ? itemInput : [itemInput];

    const payloads = itemsArray.map((item) => {
      const { id, ...rest } = item;
      return {
        ...rest,
        title: (rest.title || '').trim(),
        time: rest.time && rest.time.trim() !== '' ? rest.time : null, // Evita erro de tipo TIME no Postgres
        category: rest.category || 'evento',
        user_id: userId
      };
    });

    try {
      const { data, error } = await supabase
        .from('agenda_items')
        .insert(payloads)
        .select();

      if (error) throw error;

      const inserted = data || [];
      set((state) => ({
        agendaItems: sortAgendaItems([...state.agendaItems, ...inserted])
      }));

      return Array.isArray(itemInput) ? inserted : inserted[0];
    } catch (error) {
      set({ error: error.message });
      console.error('[Supabase] Erro Crítico ao adicionar item na Agenda:', error);
      throw error; // Repassa o erro para o Bastian / BarraComandoIA
    } finally {
      set({ isLoading: false });
    }
  },

  // 3. ATUALIZAR ITEM EXISTENTE (Editar)
  updateAgendaItem: async (id, updatedItem) => {
    set({ isLoading: true, error: null });

    const payload = {
      ...updatedItem,
      title: updatedItem.title ? updatedItem.title.trim() : undefined,
      time: updatedItem.time && updatedItem.time.trim() !== '' ? updatedItem.time : null
    };

    try {
      const { data, error } = await supabase
        .from('agenda_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        agendaItems: sortAgendaItems(
          state.agendaItems.map((item) => (item.id === id ? { ...item, ...data } : item))
        )
      }));

      return data;
    } catch (error) {
      set({ error: error.message });
      console.error('Erro ao atualizar item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 4. DELETAR ITEM DA AGENDA (Suporta 1 ID ou um Array de IDs)
  deleteAgendaItem: async (idOrIds) => {
    set({ isLoading: true, error: null });
    const idsArray = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    try {
      const { error } = await supabase
        .from('agenda_items')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      set((state) => ({
        agendaItems: state.agendaItems.filter((item) => !idsArray.includes(item.id))
      }));
    } catch (error) {
      set({ error: error.message });
      console.error('Erro ao deletar item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 5. MARCAR COMO CONCLUÍDO / PENDENTE
  toggleItemCompletion: async (id, currentStatus) => {
    const targetItem = get().agendaItems.find((i) => i.id === id);
    const resolvedStatus = currentStatus !== undefined ? currentStatus : Boolean(targetItem?.is_completed);
    const nextStatus = !resolvedStatus;

    try {
      const { data, error } = await supabase
        .from('agenda_items')
        .update({ is_completed: nextStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        agendaItems: state.agendaItems.map((item) =>
          item.id === id ? { ...item, ...(data || { is_completed: nextStatus }) } : item
        )
      }));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      throw error;
    }
  }
}));
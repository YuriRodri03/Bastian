import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

// Garante a data local correta (evita o bug do UTC após as 21h no Brasil)
const getLocalTodayISO = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Mantém tarefas pendentes no topo e concluídas na base (ordenadas pelas mais recentes)
const sortInboxTasks = (tasks = []) => {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.completed) !== Boolean(b.completed)) {
      return a.completed ? 1 : -1;
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
};

// Helper rápido para recuperar o ID do usuário sem requisição extra se já estiver no AuthStore
const resolveUserId = async () => {
  const cachedId = useAuthStore.getState()?.user?.id;
  if (cachedId) return cachedId;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

export const useInboxStore = create((set, get) => ({
  inboxTasks: [],
  isLoading: false,
  error: null,

  // 1. Buscar tarefas do usuário
  fetchInboxTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveUserId();
      if (!userId) {
        set({ isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('inbox_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ inboxTasks: sortInboxTasks(data || []) });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar inbox_tasks:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. Adicionar tarefa (Aceita (title, dateString) OU um Array de tarefas em lote)
  addInboxTask: async (titleOrArray, dateString = null) => {
    set({ error: null });

    const userId = await resolveUserId();
    if (!userId) {
      const err = new Error('Usuário não autenticado');
      set({ error: err.message });
      throw err;
    }

    const defaultDate = dateString || getLocalTodayISO();
    let payloads = [];

    if (Array.isArray(titleOrArray)) {
      payloads = titleOrArray
        .map((item) => {
          const title = typeof item === 'string' ? item.trim() : (item.title || '').trim();
          const date = (typeof item === 'object' && item.date) ? item.date : defaultDate;
          return title ? { title, date, completed: false, user_id: userId } : null;
        })
        .filter(Boolean);
    } else {
      const cleanTitle = (titleOrArray || '').trim();
      if (!cleanTitle) return;
      payloads = [{ title: cleanTitle, date: defaultDate, completed: false, user_id: userId }];
    }

    if (payloads.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('inbox_tasks')
        .insert(payloads)
        .select();

      if (error) throw error;

      const inserted = data || [];
      set((state) => ({
        inboxTasks: sortInboxTasks([...inserted, ...state.inboxTasks])
      }));

      return Array.isArray(titleOrArray) ? inserted : inserted[0];
    } catch (error) {
      console.error('[Supabase] Erro ao adicionar tarefa no Inbox:', error);
      set({ error: error.message });
      throw error; // Repassa falha para o Bastian / BarraComandoIA
    }
  },

  // 3. Alternar status Concluído/Pendente (Otimista + Rollback em caso de falha)
  toggleInboxTask: async (taskId, currentCompleted) => {
    const previousTasks = get().inboxTasks;
    const targetTask = previousTasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const newStatus = currentCompleted !== undefined ? !currentCompleted : !targetTask.completed;

    // Atualização otimista imediata + reordenação (concluídas descem)
    set((state) => ({
      inboxTasks: sortInboxTasks(
        state.inboxTasks.map((task) =>
          task.id === taskId ? { ...task, completed: newStatus } : task
        )
      )
    }));

    try {
      const { error } = await supabase
        .from('inbox_tasks')
        .update({ completed: newStatus })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao alternar status da tarefa (revertendo):', error);
      // Rollback para o estado anterior
      set({ inboxTasks: previousTasks, error: error.message });
      throw error;
    }
  },

  // 4. Editar título ou data de uma tarefa existente
  updateInboxTask: async (taskId, updates) => {
    const previousTasks = get().inboxTasks;

    const cleanUpdates = { ...updates };
    if (cleanUpdates.title !== undefined) {
      cleanUpdates.title = cleanUpdates.title.trim();
    }

    set((state) => ({
      inboxTasks: sortInboxTasks(
        state.inboxTasks.map((t) => (t.id === taskId ? { ...t, ...cleanUpdates } : t))
      )
    }));

    try {
      const { data, error } = await supabase
        .from('inbox_tasks')
        .update(cleanUpdates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao atualizar tarefa do Inbox:', error);
      set({ inboxTasks: previousTasks, error: error.message });
      throw error;
    }
  },

  // 5. Excluir tarefa (Otimista + Rollback + Suporte a múltiplos IDs)
  deleteInboxTask: async (idOrIds) => {
    const previousTasks = get().inboxTasks;
    const idsArray = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    set((state) => ({
      inboxTasks: state.inboxTasks.filter((t) => !idsArray.includes(t.id))
    }));

    try {
      const { error } = await supabase
        .from('inbox_tasks')
        .delete()
        .in('id', idsArray);

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao excluir tarefa do Inbox (revertendo):', error);
      set({ inboxTasks: previousTasks, error: error.message });
      throw error;
    }
  },

  // 6. Limpar todas as tarefas concluídas de uma data (ou geral)
  clearCompletedTasks: async (dateString = null) => {
    const previousTasks = get().inboxTasks;
    const completedIds = previousTasks
      .filter((t) => t.completed && (!dateString || t.date === dateString))
      .map((t) => t.id);

    if (completedIds.length === 0) return;

    set((state) => ({
      inboxTasks: state.inboxTasks.filter((t) => !completedIds.includes(t.id))
    }));

    try {
      const { error } = await supabase
        .from('inbox_tasks')
        .delete()
        .in('id', completedIds);

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao limpar tarefas concluídas:', error);
      set({ inboxTasks: previousTasks, error: error.message });
      throw error;
    }
  }
}));
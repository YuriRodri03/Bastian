import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

// Helper para recuperar o ID do usuário rapidamente sem requisição extra de rede
const resolveUserId = async () => {
  const cachedId = useAuthStore.getState()?.user?.id;
  if (cachedId) return cachedId;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

export const useKanbanStore = create((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  // 1. Buscar todos os cartões do Kanban
  fetchKanbanTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveUserId();
      if (!userId) {
        set({ isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('kanban_tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      set({ tasks: data || [] });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar kanban_tasks:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. Adicionar cartão (Aceita 1 título OU um Array de cartões em lote)
  addTask: async (titleOrArray, status = 'backlog') => {
    set({ error: null });

    const userId = await resolveUserId();
    if (!userId) {
      const err = new Error('Usuário não autenticado');
      set({ error: err.message });
      throw err;
    }

    let payloads = [];

    if (Array.isArray(titleOrArray)) {
      payloads = titleOrArray
        .map((item) => {
          const title = typeof item === 'string' ? item.trim() : (item.title || '').trim();
          const colStatus = (typeof item === 'object' && item.status) ? item.status : status;
          return title ? { title, status: colStatus, user_id: userId } : null;
        })
        .filter(Boolean);
    } else {
      const cleanTitle = (titleOrArray || '').trim();
      if (!cleanTitle) return;
      payloads = [{ title: cleanTitle, status, user_id: userId }];
    }

    if (payloads.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('kanban_tasks')
        .insert(payloads)
        .select();

      if (error) throw error;

      const inserted = data || [];
      set((state) => ({
        tasks: [...state.tasks, ...inserted]
      }));

      return Array.isArray(titleOrArray) ? inserted : inserted[0];
    } catch (error) {
      console.error('[Supabase] Erro ao adicionar cartão no Kanban:', error);
      set({ error: error.message });
      throw error; // Repassa o erro para o Bastian / BarraComandoIA
    }
  },

  // 3. Mover cartão de coluna (Blindado contra String vs Number do Drag & Drop + Rollback)
  moveTask: async (taskId, newStatus) => {
    const previousTasks = get().tasks;
    const targetTask = previousTasks.find((t) => String(t.id) === String(taskId));
    
    // Se não encontrou ou já está na mesma coluna, ignora
    if (!targetTask || targetTask.status === newStatus) return;

    // Atualização otimista imediata na UI
    set((state) => ({
      tasks: state.tasks.map((task) =>
        String(task.id) === String(taskId) ? { ...task, status: newStatus } : task
      )
    }));

    try {
      const { error } = await supabase
        .from('kanban_tasks')
        .update({ status: newStatus })
        .eq('id', targetTask.id); // Usa o ID com o tipo exato original do banco

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao mover cartão no Kanban (revertendo):', error);
      set({ tasks: previousTasks, error: error.message });
      throw error;
    }
  },

  // 4. Editar título ou status de um cartão
  updateTask: async (taskId, updates) => {
    const previousTasks = get().tasks;
    const targetTask = previousTasks.find((t) => String(t.id) === String(taskId));
    if (!targetTask) return;

    const cleanUpdates = { ...updates };
    if (cleanUpdates.title !== undefined) {
      cleanUpdates.title = cleanUpdates.title.trim();
    }

    set((state) => ({
      tasks: state.tasks.map((task) =>
        String(task.id) === String(taskId) ? { ...task, ...cleanUpdates } : task
      )
    }));

    try {
      const { data, error } = await supabase
        .from('kanban_tasks')
        .update(cleanUpdates)
        .eq('id', targetTask.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao atualizar cartão do Kanban:', error);
      set({ tasks: previousTasks, error: error.message });
      throw error;
    }
  },

  // 5. Excluir cartão (Otimista + Rollback + Suporte a múltiplos IDs)
  deleteTask: async (idOrIds) => {
    const previousTasks = get().tasks;
    const rawArray = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const stringIds = rawArray.map(String);

    set((state) => ({
      tasks: state.tasks.filter((t) => !stringIds.includes(String(t.id)))
    }));

    try {
      const { error } = await supabase
        .from('kanban_tasks')
        .delete()
        .in('id', rawArray);

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao excluir cartão do Kanban (revertendo):', error);
      set({ tasks: previousTasks, error: error.message });
      throw error;
    }
  },

  // 6. Limpar todos os cartões da coluna "Concluído" (done)
  clearDoneTasks: async () => {
    const previousTasks = get().tasks;
    const doneIds = previousTasks.filter((t) => t.status === 'done').map((t) => t.id);

    if (doneIds.length === 0) return;

    set((state) => ({
      tasks: state.tasks.filter((t) => t.status !== 'done')
    }));

    try {
      const { error } = await supabase
        .from('kanban_tasks')
        .delete()
        .in('id', doneIds);

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao limpar cartões concluídos:', error);
      set({ tasks: previousTasks, error: error.message });
      throw error;
    }
  }
}));
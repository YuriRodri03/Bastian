import { create } from 'zustand';
import { supabase } from '../lib/supabase'; // Ajuste o caminho se necessário

export const useKanbanStore = create((set, get) => ({
  tasks: [],
  isLoading: false,

  fetchKanbanTasks: async () => {
    set({ isLoading: true });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('kanban_tasks')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: true });

    if (!error && data) set({ tasks: data });
    set({ isLoading: false });
  },

  addTask: async (title, status = 'backlog') => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('kanban_tasks')
      .insert([{ title, status, user_id: userData.user.id }])
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ tasks: [...state.tasks, data] }));
    }
  },

  moveTask: async (taskId, newStatus) => {
    // Atualização otimista: muda na tela instantaneamente
    set((state) => ({
      tasks: state.tasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    }));

    // Salva no banco de dados em segundo plano
    await supabase
      .from('kanban_tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
  },
  
  deleteTask: async (taskId) => {
    set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) }));
    await supabase.from('kanban_tasks').delete().eq('id', taskId);
  }
}));
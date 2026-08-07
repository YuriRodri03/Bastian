import { create } from 'zustand';
import { supabase } from '../lib/supabase'; // Ajuste o caminho se necessário

export const useInboxStore = create((set) => ({
  inboxTasks: [],
  isLoading: false,

  fetchInboxTasks: async () => {
    set({ isLoading: true });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('inbox_tasks')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false }); // As mais novas primeiro

    if (!error && data) set({ inboxTasks: data });
    set({ isLoading: false });
  },

  // MODIFICADO: Agora recebe a string de data enviada pelo seu calendário
  addInboxTask: async (title, dateString = null) => {
    if (!title.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    
    // NOVO: Captura a data selecionada ou usa o dia de hoje por padrão
    const taskDate = dateString || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('inbox_tasks')
      // NOVO: Salva a coluna 'date' no Supabase
      .insert([{ title, user_id: userData.user.id, date: taskDate }])
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ inboxTasks: [data, ...state.inboxTasks] }));
    }
  },

  toggleInboxTask: async (taskId, currentCompleted) => {
    const newStatus = !currentCompleted;
    
    // Atualização otimista
    set((state) => ({
      inboxTasks: state.inboxTasks.map(task => 
        task.id === taskId ? { ...task, completed: newStatus } : task
      )
    }));

    await supabase
      .from('inbox_tasks')
      .update({ completed: newStatus })
      .eq('id', taskId);
  },

  deleteInboxTask: async (taskId) => {
    set((state) => ({ inboxTasks: state.inboxTasks.filter(t => t.id !== taskId) }));
    await supabase.from('inbox_tasks').delete().eq('id', taskId);
  }
}));
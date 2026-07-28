import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const useFitnessStore = create((set, get) => ({
  healthLogs: [],
  isLoading: false,

  fetchHealthLogs: async () => {
    set({ isLoading: true });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) set({ healthLogs: data });
    set({ isLoading: false });
  },

  addHealthLog: async (type, title, value = null) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('health_logs')
      .insert([{ type, title, value, user_id: userData.user.id }])
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ healthLogs: [data, ...state.healthLogs] }));
      toast.success('Registro salvo!');
    } else {
      toast.error('Erro ao salvar registro.');
    }
  },

  deleteHealthLog: async (logId) => {
    const previousLogs = get().healthLogs;
    set((state) => ({ healthLogs: state.healthLogs.filter(l => l.id !== logId) }));
    
    const { error } = await supabase.from('health_logs').delete().eq('id', logId);
    if (error) {
      set({ healthLogs: previousLogs });
      toast.error('Erro ao deletar registro.');
    }
  }
}));    
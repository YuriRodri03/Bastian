import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export const useFitnessStore = create((set, get) => ({
  healthLogs: [],
  isLoading: false,

  fetchHealthLogs: async () => {
    set({ isLoading: true });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      set({ isLoading: false });
      return;
    }

    const { data, error } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ healthLogs: data });
    }
    set({ isLoading: false });
  },

  // CORREÇÃO AQUI: Adicionados o parâmetro 'unit' na função e no insert
  addHealthLog: async (type, title, value = null, unit = null) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data, error } = await supabase
      .from('health_logs')
      .insert([{ 
        type, 
        title, 
        value, 
        unit, // <- Agora o banco vai gravar 'kg', 'cm', 'min', etc.
        user_id: userData.user.id 
      }])
      .select()
      .single();

    if (!error && data) {
      set((state) => ({ healthLogs: [data, ...state.healthLogs] }));
      // Se não quiser que este toast do Zustand apareça duplicado com o toast
      // do Treino.jsx, você pode remover a linha abaixo futuramente.
      toast.success('Registro salvo no banco!');
    } else {
      console.error("Supabase Insert Error:", error);
      toast.error('Erro ao salvar registro no banco de dados.');
    }
  },

  deleteHealthLog: async (logId) => {
    if (!logId) return;

    const previousLogs = get().healthLogs;
    
    // Atualização otimista: remove instantaneamente da tela
    set((state) => ({ 
      healthLogs: state.healthLogs.filter(l => l.id !== logId) 
    }));
    
    const { error } = await supabase
      .from('health_logs')
      .delete()
      .eq('id', logId);

    if (error) {
      console.error("Supabase Delete Error:", error);
      // Desfaz a exclusão na tela se der erro de permissão no Supabase
      set({ healthLogs: previousLogs });
      toast.error('Erro de permissão no banco ao deletar.');
    }
  }
}));
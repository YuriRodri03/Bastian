import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

// Recupera o ID do usuário em memória ou faz fallback para a sessão do Supabase
const resolveUserId = async () => {
  const cachedId = useAuthStore.getState()?.user?.id;
  if (cachedId) return cachedId;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

// Define a unidade padrão caso não seja informada (ex: chamadas rápidas por voz)
const resolveDefaultUnit = (type, unit) => {
  if (unit) return unit;
  if (type === 'peso') return 'kg';
  if (type === 'medida') return 'cm';
  if (type === 'treino') return 'min';
  return null;
};

export const useFitnessStore = create((set, get) => ({
  healthLogs: [],
  isLoading: false,
  error: null,

  // 1. Buscar histórico de treinos, pesos e medidas
  fetchHealthLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveUserId();
      if (!userId) {
        set({ isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('health_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ healthLogs: data || [] });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar health_logs:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. Adicionar registro (Treino, Peso ou Medida)
  addHealthLog: async (type, title, value = null, unit = null) => {
    set({ error: null });

    const userId = await resolveUserId();
    if (!userId) {
      const err = new Error('Usuário não autenticado');
      set({ error: err.message });
      throw err;
    }

    const numericValue =
      value !== null && value !== undefined && value !== ''
        ? Number(String(value).replace(',', '.'))
        : null;

    const payload = {
      type: (type || 'treino').toLowerCase().trim(),
      title: (title || 'Registro').trim(),
      value: !isNaN(numericValue) ? numericValue : null,
      unit: resolveDefaultUnit(type, unit),
      user_id: userId
    };

    try {
      const { data, error } = await supabase
        .from('health_logs')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        healthLogs: [data, ...state.healthLogs]
      }));

      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao salvar health_log:', error);
      set({ error: error.message });
      throw error; // Repassa o erro para a BarraComandoIA ou Treino.jsx
    }
  },

  // 3. Atualizar um registro existente
  updateHealthLog: async (logId, updates) => {
    const previousLogs = get().healthLogs;
    const targetLog = previousLogs.find((l) => String(l.id) === String(logId));
    if (!targetLog) return;

    set((state) => ({
      healthLogs: state.healthLogs.map((l) =>
        String(l.id) === String(logId) ? { ...l, ...updates } : l
      )
    }));

    try {
      const { data, error } = await supabase
        .from('health_logs')
        .update(updates)
        .eq('id', targetLog.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao atualizar health_log (revertendo):', error);
      set({ healthLogs: previousLogs, error: error.message });
      throw error;
    }
  },

  // 4. Deletar registro (Otimista + Rollback em caso de falha)
  deleteHealthLog: async (logId) => {
    if (!logId) return;

    const previousLogs = get().healthLogs;
    const targetLog = previousLogs.find((l) => String(l.id) === String(logId));
    const idToDelete = targetLog ? targetLog.id : logId;

    // Atualização otimista: remove instantaneamente da tela
    set((state) => ({
      healthLogs: state.healthLogs.filter((l) => String(l.id) !== String(logId))
    }));

    try {
      const { error } = await supabase
        .from('health_logs')
        .delete()
        .eq('id', idToDelete);

      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao deletar health_log (revertendo):', error);
      set({ healthLogs: previousLogs, error: error.message });
      throw error;
    }
  }
}));
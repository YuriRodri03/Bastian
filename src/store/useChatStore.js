import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

export const useChatStore = create((set, get) => ({
  mensagensRecentes: [],

  fetchMemoria: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('bastian_memory')
      .select('texto')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5); // Lembra das últimas 5 interações

    if (data) {
      set({ mensagensRecentes: data.map(d => d.texto).reverse() });
    }
  },

  adicionarMemoria: async (texto) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    // Atualiza a interface instantaneamente
    set(state => ({
      mensagensRecentes: [...state.mensagensRecentes, texto].slice(-5)
    }));

    // Salva na nuvem silenciosamente
    await supabase.from('bastian_memory').insert([{ user_id: userId, texto }]);
  }
}));
// src/store/useInboxStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { resolveUserId, fetchAllRows, isISODate, getLocalTodayISO, sameId } from './storeHelpers';

// Pendentes no topo, concluídas na base; dentro de cada grupo, as mais recentes primeiro
const sortInboxTasks = (tasks = []) =>
  [...tasks].sort((a, b) => {
    if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

// Devolve ao estado só as tarefas que saíram, sem duplicar e sem desfazer outras alterações
// (restaurar a lista inteira, como antes, apagava mudanças feitas enquanto a requisição estava pendente)
const restaurarTarefas = (state, removidas) => [
  ...state.inboxTasks,
  ...removidas.filter((r) => !state.inboxTasks.some((t) => sameId(t.id, r.id)))
];

export const useInboxStore = create((set, get) => ({
  inboxTasks: [],
  isLoading: false,
  error: null,

  // 1. Buscar tarefas do usuário (todas as páginas)
  fetchInboxTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveUserId();
      if (!userId) return;

      const rows = await fetchAllRows('inbox_tasks', (q) =>
        q.eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
      );
      set({ inboxTasks: sortInboxTasks(rows) });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar inbox_tasks:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. Adicionar (title + data OU um Array de tarefas em lote)
  addInboxTask: async (titleOrArray, dateString = null) => {
    set({ error: null });

    try {
      const userId = await resolveUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const defaultDate = dateString || getLocalTodayISO();
      const lista = Array.isArray(titleOrArray) ? titleOrArray : [titleOrArray];

      const payloads = lista
        .map((item) => {
          const title = (typeof item === 'string' ? item : item?.title || '').trim();
          const date = (typeof item === 'object' && item?.date) || defaultDate;
          if (!title) return null;
          if (!isISODate(date)) throw new Error('Data inválida: use o formato AAAA-MM-DD.');
          return { title, date, completed: false, user_id: userId };
        })
        .filter(Boolean);

      if (payloads.length === 0) return Array.isArray(titleOrArray) ? [] : undefined;

      const { data, error } = await supabase.from('inbox_tasks').insert(payloads).select();
      if (error) throw error;

      const inserted = data || [];
      set((state) => ({ inboxTasks: sortInboxTasks([...inserted, ...state.inboxTasks]) }));

      return Array.isArray(titleOrArray) ? inserted : inserted[0];
    } catch (error) {
      console.error('[Supabase] Erro ao adicionar tarefa no Inbox:', error);
      set({ error: error.message });
      throw error; // repassa para a tela / BarraComandoIA
    }
  },

  // 3. Alternar concluída/pendente. currentCompleted é o estado ATUAL; o novo é o inverso.
  // Otimista; se falhar, reverte só esta tarefa.
  toggleInboxTask: async (taskId, currentCompleted) => {
    const alvo = get().inboxTasks.find((t) => sameId(t.id, taskId));
    if (!alvo) throw new Error('Tarefa não encontrada.');

    const anterior = Boolean(alvo.completed);
    const novoStatus = currentCompleted !== undefined ? !currentCompleted : !anterior;

    set((state) => ({
      inboxTasks: sortInboxTasks(
        state.inboxTasks.map((t) => (sameId(t.id, alvo.id) ? { ...t, completed: novoStatus } : t))
      ),
      error: null
    }));

    try {
      const { error } = await supabase.from('inbox_tasks').update({ completed: novoStatus }).eq('id', alvo.id);
      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao alternar status da tarefa (revertendo):', error);
      set((state) => ({
        inboxTasks: sortInboxTasks(
          state.inboxTasks.map((t) => (sameId(t.id, alvo.id) ? { ...t, completed: anterior } : t))
        ),
        error: error.message
      }));
      throw error;
    }
  },

  // 4. Editar título e/ou data (só os campos enviados). Otimista; reverte só esta tarefa.
  updateInboxTask: async (taskId, updates = {}) => {
    const original = get().inboxTasks.find((t) => sameId(t.id, taskId));
    if (!original) throw new Error('Tarefa não encontrada.');

    const campos = {};
    if (updates.title !== undefined) {
      const title = String(updates.title).trim();
      if (!title) throw new Error('O título da tarefa não pode ficar vazio.');
      campos.title = title;
    }
    if (updates.date !== undefined) {
      if (!isISODate(updates.date)) throw new Error('Data inválida: use o formato AAAA-MM-DD.');
      campos.date = updates.date;
    }
    if (updates.completed !== undefined) campos.completed = Boolean(updates.completed);
    if (Object.keys(campos).length === 0) return original;

    set((state) => ({
      inboxTasks: sortInboxTasks(state.inboxTasks.map((t) => (sameId(t.id, original.id) ? { ...t, ...campos } : t))),
      error: null
    }));

    try {
      const { data, error } = await supabase
        .from('inbox_tasks')
        .update(campos)
        .eq('id', original.id)
        .select()
        .single();
      if (error) throw error;

      set((state) => ({
        inboxTasks: sortInboxTasks(state.inboxTasks.map((t) => (sameId(t.id, original.id) ? { ...t, ...data } : t)))
      }));
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao atualizar tarefa do Inbox (revertendo):', error);
      set((state) => ({
        inboxTasks: sortInboxTasks(state.inboxTasks.map((t) => (sameId(t.id, original.id) ? original : t))),
        error: error.message
      }));
      throw error;
    }
  },

  // 5. Excluir (1 id ou Array). Otimista; reverte se falhar ou se nada foi apagado.
  deleteInboxTask: async (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const idsStr = ids.map(String);
    const removidas = get().inboxTasks.filter((t) => idsStr.includes(String(t.id)));

    set((state) => ({
      inboxTasks: state.inboxTasks.filter((t) => !idsStr.includes(String(t.id))),
      error: null
    }));

    try {
      // .select('id') mostra o que foi apagado de fato: vazio = id errado ou sem permissão
      const { data, error } = await supabase.from('inbox_tasks').delete().in('id', ids).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Tarefa não encontrada.');
    } catch (error) {
      console.error('[Supabase] Erro ao excluir tarefa do Inbox (revertendo):', error);
      set((state) => ({ inboxTasks: sortInboxTasks(restaurarTarefas(state, removidas)), error: error.message }));
      throw error;
    }
  },

  // 6. Limpar concluídas (de uma data ou todas)
  clearCompletedTasks: async (dateString = null) => {
    const removidas = get().inboxTasks.filter((t) => t.completed && (!dateString || t.date === dateString));
    if (removidas.length === 0) return;

    const ids = removidas.map((t) => t.id);
    const idsStr = ids.map(String);

    set((state) => ({
      inboxTasks: state.inboxTasks.filter((t) => !idsStr.includes(String(t.id))),
      error: null
    }));

    try {
      const { error } = await supabase.from('inbox_tasks').delete().in('id', ids);
      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao limpar tarefas concluídas (revertendo):', error);
      set((state) => ({ inboxTasks: sortInboxTasks(restaurarTarefas(state, removidas)), error: error.message }));
      throw error;
    }
  },

  // 7. Limpa tudo (chame no logout)
  reset: () => set({ inboxTasks: [], isLoading: false, error: null })
}));
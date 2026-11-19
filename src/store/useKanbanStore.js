// src/store/useKanbanStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { resolveUserId, fetchAllRows, sameId } from './storeHelpers';

export const KANBAN_STATUSES = ['backlog', 'in-progress', 'done'];

const validarStatus = (status) => {
  if (!KANBAN_STATUSES.includes(status)) {
    throw new Error(`Status inválido "${status}". Use: ${KANBAN_STATUSES.join(', ')}.`);
  }
  return status;
};

// Devolve só os cartões que saíram, sem duplicar e sem desfazer outras alterações
// (restaurar a lista inteira, como antes, apagava mudanças feitas enquanto a requisição estava pendente)
const restaurarCartoes = (state, removidos) => [
  ...state.tasks,
  ...removidos.filter((r) => !state.tasks.some((t) => sameId(t.id, r.id)))
];

const porCriacao = (tasks) =>
  [...tasks].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

export const useKanbanStore = create((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  // 1. Buscar todos os cartões (todas as páginas)
  fetchKanbanTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveUserId();
      if (!userId) return;

      const rows = await fetchAllRows('kanban_tasks', (q) =>
        q.eq('user_id', userId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      );
      set({ tasks: rows });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar kanban_tasks:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // 2. Adicionar (1 título OU um Array de cartões em lote)
  addTask: async (titleOrArray, status = 'backlog') => {
    set({ error: null });

    try {
      const userId = await resolveUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const lista = Array.isArray(titleOrArray) ? titleOrArray : [titleOrArray];
      const payloads = lista
        .map((item) => {
          const title = (typeof item === 'string' ? item : item?.title || '').trim();
          const colStatus = (typeof item === 'object' && item?.status) || status;
          if (!title) return null;
          return { title, status: validarStatus(colStatus), user_id: userId };
        })
        .filter(Boolean);

      if (payloads.length === 0) return Array.isArray(titleOrArray) ? [] : undefined;

      const { data, error } = await supabase.from('kanban_tasks').insert(payloads).select();
      if (error) throw error;

      const inserted = data || [];
      set((state) => ({ tasks: porCriacao([...state.tasks, ...inserted]) }));

      return Array.isArray(titleOrArray) ? inserted : inserted[0];
    } catch (error) {
      console.error('[Supabase] Erro ao adicionar cartão no Kanban:', error);
      set({ error: error.message });
      throw error; // repassa para a tela / BarraComandoIA
    }
  },

  // 3. Mover de coluna. Aceita id como texto ou número (drag & drop devolve texto). Otimista; reverte só este cartão.
  moveTask: async (taskId, newStatus) => {
    const alvo = get().tasks.find((t) => sameId(t.id, taskId));
    if (!alvo) throw new Error('Cartão não encontrado.');

    validarStatus(newStatus);
    if (alvo.status === newStatus) return; // já está na coluna

    const anterior = alvo.status;

    set((state) => ({
      tasks: state.tasks.map((t) => (sameId(t.id, alvo.id) ? { ...t, status: newStatus } : t)),
      error: null
    }));

    try {
      // usa o id com o tipo original do banco
      const { error } = await supabase.from('kanban_tasks').update({ status: newStatus }).eq('id', alvo.id);
      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao mover cartão no Kanban (revertendo):', error);
      set((state) => ({
        tasks: state.tasks.map((t) => (sameId(t.id, alvo.id) ? { ...t, status: anterior } : t)),
        error: error.message
      }));
      throw error;
    }
  },

  // 4. Editar título e/ou status (só os campos enviados). Otimista; reverte só este cartão.
  updateTask: async (taskId, updates = {}) => {
    const original = get().tasks.find((t) => sameId(t.id, taskId));
    if (!original) throw new Error('Cartão não encontrado.');

    const campos = {};
    if (updates.title !== undefined) {
      const title = String(updates.title).trim();
      if (!title) throw new Error('O título do cartão não pode ficar vazio.');
      campos.title = title;
    }
    if (updates.status !== undefined) campos.status = validarStatus(updates.status);
    if (Object.keys(campos).length === 0) return original;

    set((state) => ({
      tasks: state.tasks.map((t) => (sameId(t.id, original.id) ? { ...t, ...campos } : t)),
      error: null
    }));

    try {
      const { data, error } = await supabase
        .from('kanban_tasks')
        .update(campos)
        .eq('id', original.id)
        .select()
        .single();
      if (error) throw error;

      set((state) => ({ tasks: state.tasks.map((t) => (sameId(t.id, original.id) ? { ...t, ...data } : t)) }));
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao atualizar cartão do Kanban (revertendo):', error);
      set((state) => ({
        tasks: state.tasks.map((t) => (sameId(t.id, original.id) ? original : t)),
        error: error.message
      }));
      throw error;
    }
  },

  // 5. Excluir (1 id ou Array). Otimista; reverte se falhar ou se nada foi apagado.
  deleteTask: async (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const idsStr = ids.map(String);
    const removidos = get().tasks.filter((t) => idsStr.includes(String(t.id)));

    set((state) => ({
      tasks: state.tasks.filter((t) => !idsStr.includes(String(t.id))),
      error: null
    }));

    try {
      // .select('id') mostra o que foi apagado de fato: vazio = id errado ou sem permissão
      const { data, error } = await supabase.from('kanban_tasks').delete().in('id', ids).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Cartão não encontrado.');
    } catch (error) {
      console.error('[Supabase] Erro ao excluir cartão do Kanban (revertendo):', error);
      set((state) => ({ tasks: porCriacao(restaurarCartoes(state, removidos)), error: error.message }));
      throw error;
    }
  },

  // 6. Limpar a coluna "Concluído"
  clearDoneTasks: async () => {
    const removidos = get().tasks.filter((t) => t.status === 'done');
    if (removidos.length === 0) return;

    const ids = removidos.map((t) => t.id);
    const idsStr = ids.map(String);

    set((state) => ({
      tasks: state.tasks.filter((t) => !idsStr.includes(String(t.id))),
      error: null
    }));

    try {
      const { error } = await supabase.from('kanban_tasks').delete().in('id', ids);
      if (error) throw error;
    } catch (error) {
      console.error('[Supabase] Erro ao limpar cartões concluídos (revertendo):', error);
      set((state) => ({ tasks: porCriacao(restaurarCartoes(state, removidos)), error: error.message }));
      throw error;
    }
  },

  // 7. Limpa tudo (chame no logout)
  reset: () => set({ tasks: [], isLoading: false, error: null })
}));
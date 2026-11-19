// src/store/useAgendaStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { resolveUserId, fetchAllRows, isISODate, sameId } from './storeHelpers';

// Mantém a lista sempre ordenada por data e horário
const sortAgendaItems = (items = []) =>
  [...items].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

// "" vira null (a coluna é do tipo TIME no Postgres)
const normalizarTime = (t) => (typeof t === 'string' && t.trim() !== '' ? t.trim() : null);

// Monta o registro de um INSERT, validando o essencial
const montarItem = (item, userId) => {
  // id, user_id e created_at nunca vêm do cliente
  const { id, user_id, created_at, ...rest } = item;
  const title = String(rest.title ?? '').trim();
  if (!title) throw new Error('O título do compromisso é obrigatório.');
  if (!isISODate(rest.date)) throw new Error('Data inválida: use o formato AAAA-MM-DD.');

  return {
    ...rest,
    title,
    time: normalizarTime(rest.time),
    category: rest.category || 'evento',
    user_id: userId
  };
};

// Monta o UPDATE só com os campos enviados.
// Antes, um update parcial como { title } zerava o horário (time virava null) do compromisso.
const montarAtualizacao = (u) => {
  const out = {};
  if (u.title !== undefined) {
    const title = String(u.title).trim();
    if (!title) throw new Error('O título do compromisso não pode ficar vazio.');
    out.title = title;
  }
  if (u.date !== undefined) {
    if (!isISODate(u.date)) throw new Error('Data inválida: use o formato AAAA-MM-DD.');
    out.date = u.date;
  }
  if (u.time !== undefined) out.time = normalizarTime(u.time);
  if (u.category !== undefined) out.category = u.category || 'evento';
  if (u.is_completed !== undefined) out.is_completed = Boolean(u.is_completed);
  return out;
};

export const useAgendaStore = create((set, get) => {
  // Contador de operações em andamento: com duas ao mesmo tempo, a primeira a terminar
  // não desliga o isLoading da outra
  const begin = () => set((s) => ({ pending: s.pending + 1, isLoading: true, error: null }));
  const end = () =>
    set((s) => {
      const pending = Math.max(0, s.pending - 1);
      return { pending, isLoading: pending > 0 };
    });

  return {
    agendaItems: [],
    projects: [], // mantido por compatibilidade (não usado nesta tela)
    isLoading: false,
    pending: 0,
    error: null,

    // 1. BUSCAR ITENS DA AGENDA (todas as páginas, filtrando pelo usuário)
    fetchAgendaItems: async () => {
      begin();
      try {
        const userId = await resolveUserId();
        if (!userId) return;

        const rows = await fetchAllRows('agenda_items', (q) =>
          q.eq('user_id', userId)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .order('id', { ascending: true })
        );
        set({ agendaItems: sortAgendaItems(rows) });
      } catch (error) {
        set({ error: error.message });
        console.error('Erro ao buscar agenda:', error);
      } finally {
        end();
      }
    },

    // 2. ADICIONAR (1 objeto OU um Array, para eventos recorrentes em lote)
    addAgendaItem: async (itemInput) => {
      const lista = Array.isArray(itemInput) ? itemInput : [itemInput];
      if (lista.length === 0) return []; // insert([]) daria erro

      begin();
      try {
        const userId = await resolveUserId();
        if (!userId) throw new Error('Usuário não autenticado');

        const payloads = lista.map((item) => montarItem(item, userId));
        const { data, error } = await supabase.from('agenda_items').insert(payloads).select();
        if (error) throw error;

        const inserted = data || [];
        set((state) => ({ agendaItems: sortAgendaItems([...state.agendaItems, ...inserted]) }));

        return Array.isArray(itemInput) ? inserted : inserted[0];
      } catch (error) {
        set({ error: error.message });
        console.error('[Supabase] Erro ao adicionar item na Agenda:', error);
        throw error; // repassa para a tela / BarraComandoIA
      } finally {
        end();
      }
    },

    // 3. ATUALIZAR (só os campos enviados)
    updateAgendaItem: async (id, updatedItem) => {
      begin();
      try {
        const campos = montarAtualizacao(updatedItem || {});
        if (Object.keys(campos).length === 0) {
          return get().agendaItems.find((i) => sameId(i.id, id)) ?? null;
        }

        const { data, error } = await supabase
          .from('agenda_items')
          .update(campos)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;

        set((state) => ({
          agendaItems: sortAgendaItems(
            state.agendaItems.map((item) => (sameId(item.id, id) ? { ...item, ...data } : item))
          )
        }));
        return data;
      } catch (error) {
        set({ error: error.message });
        console.error('Erro ao atualizar item:', error);
        throw error;
      } finally {
        end();
      }
    },

    // 4. DELETAR (1 id ou Array). Otimista, com reversão se falhar.
    deleteAgendaItem: async (idOrIds) => {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      const idsStr = ids.map(String);
      const removidos = get().agendaItems.filter((i) => idsStr.includes(String(i.id)));

      set((state) => ({
        agendaItems: state.agendaItems.filter((i) => !idsStr.includes(String(i.id))),
        error: null
      }));

      try {
        // .select('id') devolve o que foi apagado: se vier vazio, nada foi removido (id errado ou sem permissão)
        const { data, error } = await supabase.from('agenda_items').delete().in('id', ids).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Compromisso não encontrado.');
      } catch (error) {
        console.error('Erro ao deletar item (revertendo):', error);
        set((state) => ({
          // devolve só o que foi tirado, sem duplicar nem desfazer outras alterações
          agendaItems: sortAgendaItems([
            ...state.agendaItems,
            ...removidos.filter((r) => !state.agendaItems.some((i) => sameId(i.id, r.id)))
          ]),
          error: error.message
        }));
        throw error;
      }
    },

    // 5. CONCLUIR / REABRIR. currentStatus é o estado ATUAL (quem chama passa o que está vendo);
    // o novo valor é o inverso. Sem ele, usa o valor guardado. Otimista, com reversão.
    toggleItemCompletion: async (id, currentStatus) => {
      const alvo = get().agendaItems.find((i) => sameId(i.id, id));
      if (!alvo) throw new Error('Compromisso não encontrado.');

      const anterior = Boolean(alvo.is_completed);
      const atual = currentStatus !== undefined ? Boolean(currentStatus) : anterior;
      const proximo = !atual;

      set((state) => ({
        agendaItems: state.agendaItems.map((i) => (sameId(i.id, alvo.id) ? { ...i, is_completed: proximo } : i)),
        error: null
      }));

      try {
        const { data, error } = await supabase
          .from('agenda_items')
          .update({ is_completed: proximo })
          .eq('id', alvo.id)
          .select()
          .single();
        if (error) throw error;

        set((state) => ({
          agendaItems: state.agendaItems.map((i) => (sameId(i.id, alvo.id) ? { ...i, ...data } : i))
        }));
      } catch (error) {
        console.error('Erro ao atualizar status (revertendo):', error);
        set((state) => ({
          agendaItems: state.agendaItems.map((i) => (sameId(i.id, alvo.id) ? { ...i, is_completed: anterior } : i)),
          error: error.message
        }));
        throw error;
      }
    },

    // 6. Limpa tudo (chame no logout: o store é global e guardaria os dados do usuário anterior)
    reset: () => set({ agendaItems: [], isLoading: false, pending: 0, error: null })
  };
});
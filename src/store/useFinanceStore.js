// src/store/useFitnessStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './useAuthStore';

const FICHAS_STORAGE_KEY = 'centro_comando_fichas';

const DEFAULT_FICHAS = [
  {
    id: '1',
    title: 'Treino A - Empurrar (Peito, Ombro e Tríceps)',
    exercicios: [
      { id: '1-1', nome: 'Flexão de Braços / Supino c/ Halteres', series: '4x', reps: '10-12', carga: '10kg' },
      { id: '1-2', nome: 'Desenvolvimento Militar c/ Halteres', series: '4x', reps: '10-12', carga: '10kg' },
      { id: '1-3', nome: 'Elevação Lateral', series: '3x', reps: '12-15', carga: '10kg' },
      { id: '1-4', nome: 'Tríceps Francês / Mergulho no Banco', series: '3x', reps: '12-15', carga: '10kg' }
    ]
  },
  {
    id: '2',
    title: 'Treino B - Puxar & Core (Costas, Bíceps e Abdômen)',
    exercicios: [
      { id: '2-1', nome: 'Remada Curvada Unilateral (Serrote)', series: '4x', reps: '10-12', carga: '10kg' },
      { id: '2-2', nome: 'Rosca Direta / Martelo c/ Halteres', series: '4x', reps: '10-12', carga: '10kg' },
      { id: '2-3', nome: 'Rosca Concentrada', series: '3x', reps: '12', carga: '10kg' },
      { id: '2-4', nome: 'Pular Corda (Cardio HIIT)', series: '5x', reps: '1 min', carga: 'Peso Corp.' }
    ]
  },
  {
    id: '3',
    title: 'Treino C - Inferiores Completo (Pernas e Glúteos)',
    exercicios: [
      { id: '3-1', nome: 'Agachamento Livre / Búlgaro c/ Halteres', series: '4x', reps: '10-12', carga: '20kg' },
      { id: '3-2', nome: 'Elevação Pélvica (Hip Thrust)', series: '4x', reps: '12-15', carga: '20kg' },
      { id: '3-3', nome: 'Stiff c/ Halteres', series: '3x', reps: '12', carga: '20kg' },
      { id: '3-4', nome: 'Panturrilha em Pé Unilateral', series: '4x', reps: '15-20', carga: '10kg' }
    ]
  }
];

const loadInitialFichas = () => {
  try {
    const saved = localStorage.getItem(FICHAS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Erro ao ler fichas do localStorage:', e);
  }
  return DEFAULT_FICHAS;
};

const saveFichasToStorage = (fichas) => {
  try {
    localStorage.setItem(FICHAS_STORAGE_KEY, JSON.stringify(fichas));
  } catch (e) {
    console.error('Erro ao salvar fichas no localStorage:', e);
  }
};

const resolveUserId = async () => {
  const cachedId = useAuthStore.getState()?.user?.id;
  if (cachedId) return cachedId;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

const resolveDefaultUnit = (type, unit) => {
  if (unit) return unit;
  if (type === 'peso') return 'kg';
  if (type === 'medida') return 'cm';
  if (type === 'treino') return 'min';
  if (type === 'sono') return 'h';
  if (type === 'humor') return '/5';
  return null;
};

export const useFitnessStore = create((set, get) => ({
  healthLogs: [],
  fichasTreino: loadInitialFichas(),
  fichaSyncRowId: null, // Guarda o ID da linha de sincronização no Supabase
  isLoading: false,
  error: null,

  // =========================================================================
  // SINCRONIZADOR EM NUVEM DAS FICHAS (Via Supabase health_logs)
  // =========================================================================
  syncFichasWithCloud: async (novasFichas) => {
    saveFichasToStorage(novasFichas);
    set({ fichasTreino: novasFichas });

    try {
      const userId = await resolveUserId();
      if (!userId) return;

      const jsonString = JSON.stringify(novasFichas);
      let syncId = get().fichaSyncRowId;

      // Verifica se já existe uma linha 'ficha_sync' no banco para este usuário
      if (!syncId) {
        const { data: existing } = await supabase
          .from('health_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'ficha_sync')
          .order('created_at', { ascending: false })
          .limit(1);

        if (existing && existing.length > 0) {
          syncId = existing[0].id;
          set({ fichaSyncRowId: syncId });
        }
      }

      if (syncId) {
        const { error } = await supabase
          .from('health_logs')
          .update({ title: jsonString, value: novasFichas.length })
          .eq('id', syncId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('health_logs')
          .insert([{
            type: 'ficha_sync',
            title: jsonString,
            value: novasFichas.length,
            unit: 'fichas',
            user_id: userId
          }])
          .select()
          .single();

        if (!error && data) {
          set({ fichaSyncRowId: data.id });
        }
      }
    } catch (err) {
      console.error('[Supabase] Erro ao sincronizar fichas na nuvem:', err);
    }
  },

  // =========================================================================
  // MÓDULO 1: GESTÃO DE FICHAS DE TREINO (Sincronizado Celular + Tablet + PC)
  // =========================================================================
  setFichasTreino: (novasFichas) => {
    get().syncFichasWithCloud(novasFichas);
  },

  addFichaTreino: (title, exercicios = []) => {
    const cleanTitle = (title || 'Nova Ficha de Treino').trim();
    const formattedExercicios = (Array.isArray(exercicios) ? exercicios : []).map((ex, idx) => ({
      id: ex.id || `${Date.now()}-${idx}`,
      nome: (ex.nome || ex.name || ex.exercicio || `Exercício ${idx + 1}`).trim(),
      series: String(ex.series || ex.sets || '4x').trim(),
      reps: String(ex.reps || ex.repeticoes || '10-12').trim(),
      carga: String(ex.carga || ex.weight || ex.peso || '10kg').trim()
    }));

    const novaFicha = {
      id: Date.now().toString(),
      title: cleanTitle,
      exercicios: formattedExercicios
    };

    const atualizadas = [...get().fichasTreino, novaFicha];
    get().syncFichasWithCloud(atualizadas);
    return novaFicha;
  },

  updateFichaTreino: (idOrTitle, novosDados) => {
    const fichasAtuais = get().fichasTreino;
    const alvoStr = String(idOrTitle || '').toLowerCase().trim();

    const targetFicha =
      fichasAtuais.find((f) => String(f.id) === String(idOrTitle)) ||
      fichasAtuais.find((f) => f.title.toLowerCase().includes(alvoStr));

    if (!targetFicha) return null;

    const formattedExercicios = novosDados.exercicios
      ? novosDados.exercicios.map((ex, idx) => ({
          id: ex.id || `${Date.now()}-${idx}`,
          nome: (ex.nome || ex.name || ex.exercicio || `Exercício ${idx + 1}`).trim(),
          series: String(ex.series || ex.sets || '4x').trim(),
          reps: String(ex.reps || ex.repeticoes || '10-12').trim(),
          carga: String(ex.carga || ex.weight || ex.peso || '10kg').trim()
        }))
      : targetFicha.exercicios;

    const fichaAtualizada = {
      ...targetFicha,
      title: novosDados.title ? novosDados.title.trim() : targetFicha.title,
      exercicios: formattedExercicios
    };

    const atualizadas = fichasAtuais.map((f) =>
      f.id === targetFicha.id ? fichaAtualizada : f
    );

    get().syncFichasWithCloud(atualizadas);
    return fichaAtualizada;
  },

  deleteFichaTreino: (idOrTitle) => {
    const fichasAtuais = get().fichasTreino;
    const alvoStr = String(idOrTitle || '').toLowerCase().trim();

    const targetFicha =
      fichasAtuais.find((f) => String(f.id) === String(idOrTitle)) ||
      fichasAtuais.find((f) => f.title.toLowerCase().includes(alvoStr));

    if (!targetFicha) return false;

    const atualizadas = fichasAtuais.filter((f) => f.id !== targetFicha.id);
    get().syncFichasWithCloud(atualizadas);
    return true;
  },

  concluirFichaTreino: async (idOrTitle, duracaoMin = 50) => {
    const fichasAtuais = get().fichasTreino;
    const alvoStr = String(idOrTitle || '').toLowerCase().trim();

    const ficha =
      fichasAtuais.find((f) => String(f.id) === String(idOrTitle)) ||
      fichasAtuais.find((f) => f.title.toLowerCase().includes(alvoStr));

    if (!ficha) {
      return await get().addHealthLog('treino', String(idOrTitle || 'Treino Concluído'), duracaoMin, 'min');
    }

    const resumoExercicios = (ficha.exercicios || [])
      .map((e) => `${e.nome} (${e.series} ${e.reps} - ${e.carga})`)
      .join(' • ');

    return await get().addHealthLog(
      'treino',
      `${ficha.title}: ${resumoExercicios}`,
      Number(duracaoMin) || 50,
      'min'
    );
  },

  // =========================================================================
  // MÓDULO 2: HISTÓRICO NO SUPABASE (Separa as fichas da lista de logs!)
  // =========================================================================
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

      const allRows = data || [];
      
      // 1. Procura o registro especial de sincronização de fichas na nuvem
      const syncRow = allRows.find((r) => r.type === 'ficha_sync');
      if (syncRow && syncRow.title) {
        try {
          const cloudFichas = JSON.parse(syncRow.title);
          if (Array.isArray(cloudFichas)) {
            saveFichasToStorage(cloudFichas);
            set({ fichasTreino: cloudFichas, fichaSyncRowId: syncRow.id });
          }
        } catch (parseErr) {
          console.warn('Falha ao ler JSON de fichas da nuvem:', parseErr);
        }
      } else {
        // Se ainda não existe na nuvem, sobe as fichas locais atuais deste dispositivo!
        const currentLocalFichas = get().fichasTreino;
        if (currentLocalFichas && currentLocalFichas.length > 0) {
          get().syncFichasWithCloud(currentLocalFichas);
        }
      }

      // 2. Filtra 'ficha_sync' para que nunca apareça como item no histórico de atividades
      const visibleLogs = allRows.filter((r) => r.type !== 'ficha_sync');
      set({ healthLogs: visibleLogs });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar health_logs:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

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

    const cleanType = (type || 'treino').toLowerCase().trim();
    const payload = {
      type: cleanType,
      title: (title || 'Registro').trim(),
      value: !isNaN(numericValue) ? numericValue : null,
      unit: resolveDefaultUnit(cleanType, unit),
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
      throw error;
    }
  },

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
      console.error('[Supabase] Erro ao atualizar health_log:', error);
      set({ healthLogs: previousLogs, error: error.message });
      throw error;
    }
  },

  deleteHealthLog: async (logId) => {
    if (!logId) return;

    const previousLogs = get().healthLogs;
    const targetLog = previousLogs.find((l) => String(l.id) === String(logId));
    const idToDelete = targetLog ? targetLog.id : logId;

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
      console.error('[Supabase] Erro ao deletar health_log:', error);
      set({ healthLogs: previousLogs, error: error.message });
      throw error;
    }
  }
}));
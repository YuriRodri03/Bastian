// src/store/useFitnessStore.js
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { resolveUserId, fetchAllRows, sameId } from './storeHelpers';

const FICHAS_STORAGE_KEY = 'centro_comando_fichas';
const FICHAS_OWNER_KEY = 'centro_comando_fichas_owner'; // de qual conta são as fichas guardadas neste aparelho
const FICHAS_DIRTY_KEY = 'centro_comando_fichas_dirty'; // há alterações locais ainda não enviadas à nuvem

// Tipos de registro que a tela sabe exibir. 'ficha_sync' é reservado ao sincronizador de fichas.
const LOG_TYPES = ['treino', 'peso', 'medida', 'sono', 'humor'];

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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    console.error('Erro ao gravar no localStorage:', e);
  }
};

// As fichas padrão só entram quando NÃO há nada salvo. Antes, uma lista salva vazia também caía nas
// padrão: quem apagava todas as fichas as via voltar ao recarregar a página.
const loadInitialFichas = () => {
  const saved = readStorage(FICHAS_STORAGE_KEY);
  if (saved !== null) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error('Erro ao ler fichas do localStorage:', e);
    }
  }
  return DEFAULT_FICHAS;
};

// Ids únicos (Date.now() sozinho repetia quando duas fichas eram criadas no mesmo milissegundo)
let idCounter = 0;
const newId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const normalizarExercicios = (lista) =>
  (Array.isArray(lista) ? lista : []).map((ex, idx) => ({
    id: ex.id || newId(),
    nome: String(ex.nome || ex.name || ex.exercicio || `Exercício ${idx + 1}`).trim(),
    series: String(ex.series || ex.sets || '4x').trim(),
    reps: String(ex.reps || ex.repeticoes || '10-12').trim(),
    carga: String(ex.carga || ex.weight || ex.peso || '10kg').trim()
  }));

// Acha UMA ficha por id ou título. Nunca "chuta":
// - texto vazio não casa com nada (antes, '' casava com a primeira ficha e um delete sem argumento a apagava);
// - mais de uma candidata lança erro, para quem chamou perguntar qual (antes pegava a primeira);
// - nenhuma candidata devolve null.
const resolverFicha = (fichas, idOuTitulo) => {
  const alvo = norm(idOuTitulo);
  if (!alvo) return null;

  const porId = fichas.find((f) => sameId(f.id, idOuTitulo));
  if (porId) return porId;

  const exatas = fichas.filter((f) => norm(f.title) === alvo);
  if (exatas.length === 1) return exatas[0];

  const candidatas = exatas.length > 1 ? exatas : fichas.filter((f) => norm(f.title).includes(alvo));
  if (candidatas.length === 1) return candidatas[0];
  if (candidatas.length === 0) return null;

  const opcoes = candidatas.slice(0, 5).map((f) => `${f.title} (id ${f.id})`).join('; ');
  throw new Error(`Encontrei ${candidatas.length} fichas parecidas: ${opcoes}. Especifique qual (use o id).`);
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

// Valida o valor numérico por tipo: evita que um número mal entendido pela IA vire peso 0 ou sono de 90 horas
const validarRegistro = (type, value) => {
  if (!LOG_TYPES.includes(type)) {
    throw new Error(`Tipo de registro inválido: "${type}". Use: ${LOG_TYPES.join(', ')}.`);
  }
  const exigeValor = ['peso', 'medida', 'sono', 'humor'].includes(type);
  if (value === null) {
    if (exigeValor) throw new Error(`O registro de "${type}" precisa de um valor numérico.`);
    return;
  }
  if (type === 'sono' && !(value > 0 && value <= 24)) throw new Error('Horas de sono inválidas (use entre 0 e 24).');
  if (type === 'humor' && !(value >= 1 && value <= 5)) throw new Error('A nota de humor deve ficar entre 1 e 5.');
  if (['peso', 'medida', 'treino'].includes(type) && !(value > 0)) throw new Error('O valor precisa ser maior que zero.');
};

/* ------------------------------------------------------------------ */
/* Sincronização das fichas com a nuvem                                */
/* ------------------------------------------------------------------ */

// As fichas ficam em UMA linha especial de health_logs (type = 'ficha_sync', JSON no campo title).
// Os envios entram numa fila: antes eram disparados em paralelo e, sem o id da linha ainda,
// duas edições seguidas criavam duas linhas 'ficha_sync'.
let syncChain = Promise.resolve();
let syncVersion = 0;

const enviarFichas = async (fichas, get, set) => {
  const userId = await resolveUserId();
  if (!userId) throw new Error('Usuário não autenticado');
  writeStorage(FICHAS_OWNER_KEY, userId);

  const json = JSON.stringify(fichas);
  let syncId = get().fichaSyncRowId;

  if (!syncId) {
    const { data, error } = await supabase
      .from('health_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'ficha_sync')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      syncId = data[0].id;
      set({ fichaSyncRowId: syncId });
    }
  }

  if (syncId) {
    const { data, error } = await supabase
      .from('health_logs')
      .update({ title: json, value: fichas.length })
      .eq('id', syncId)
      .select('id');
    if (error) throw error;

    if (!data || data.length === 0) {
      // a linha foi apagada em outro lugar: recomeça e recria
      set({ fichaSyncRowId: null });
      return enviarFichas(fichas, get, set);
    }
  } else {
    const { data, error } = await supabase
      .from('health_logs')
      .insert([{ type: 'ficha_sync', title: json, value: fichas.length, unit: 'fichas', user_id: userId }])
      .select('id')
      .single();
    if (error) throw error;
    set({ fichaSyncRowId: data.id });
  }
  return undefined;
};

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useFitnessStore = create((set, get) => ({
  healthLogs: [],
  fichasTreino: loadInitialFichas(),
  fichaSyncRowId: null, // id da linha de sincronização no Supabase
  syncStatus: 'idle', // 'idle' | 'syncing' | 'ok' | 'error'
  isLoading: false,
  error: null,

  // =========================================================================
  // FICHAS DE TREINO (salvas no aparelho e sincronizadas entre celular, tablet e PC)
  // =========================================================================

  // Atualiza na hora (tela e aparelho) e envia à nuvem em segundo plano. Devolve a promessa do envio:
  // antes, uma falha de rede só ia para o console e a tela dizia "salvo com sucesso" mesmo assim.
  syncFichasWithCloud: (novasFichas) => {
    writeStorage(FICHAS_STORAGE_KEY, JSON.stringify(novasFichas));
    writeStorage(FICHAS_DIRTY_KEY, '1');
    set({ fichasTreino: novasFichas, syncStatus: 'syncing' });

    const versao = ++syncVersion;
    syncChain = syncChain.then(async () => {
      if (versao !== syncVersion) return; // já existe uma versão mais nova na fila: ela fará o envio
      try {
        await enviarFichas(novasFichas, get, set);
        if (versao === syncVersion) {
          writeStorage(FICHAS_DIRTY_KEY, null);
          set({ syncStatus: 'ok' });
        }
      } catch (err) {
        console.error('[Supabase] Erro ao sincronizar fichas na nuvem:', err);
        if (versao === syncVersion) set({ syncStatus: 'error' }); // continua "suja": será reenviada
      }
    });
    return syncChain;
  },

  setFichasTreino: (novasFichas) => get().syncFichasWithCloud(novasFichas),

  addFichaTreino: (title, exercicios = []) => {
    const novaFicha = {
      id: newId(),
      title: String(title || 'Nova Ficha de Treino').trim() || 'Nova Ficha de Treino',
      exercicios: normalizarExercicios(exercicios)
    };
    get().syncFichasWithCloud([...get().fichasTreino, novaFicha]);
    return novaFicha; // devolvida na hora (quem chama usa o resultado sem esperar a nuvem)
  },

  // Devolve a ficha atualizada, ou null se não existir. Lança erro se o texto casar com mais de uma.
  updateFichaTreino: (idOrTitle, novosDados = {}) => {
    const fichasAtuais = get().fichasTreino;
    const alvo = resolverFicha(fichasAtuais, idOrTitle);
    if (!alvo) return null;

    const novoTitulo = novosDados.title ? String(novosDados.title).trim() : '';
    const fichaAtualizada = {
      ...alvo,
      title: novoTitulo || alvo.title,
      exercicios: Array.isArray(novosDados.exercicios) ? normalizarExercicios(novosDados.exercicios) : alvo.exercicios
    };

    get().syncFichasWithCloud(fichasAtuais.map((f) => (sameId(f.id, alvo.id) ? fichaAtualizada : f)));
    return fichaAtualizada;
  },

  // Devolve true se apagou, false se não encontrou. Lança erro se o texto casar com mais de uma.
  deleteFichaTreino: (idOrTitle) => {
    const fichasAtuais = get().fichasTreino;
    const alvo = resolverFicha(fichasAtuais, idOrTitle);
    if (!alvo) return false;

    get().syncFichasWithCloud(fichasAtuais.filter((f) => !sameId(f.id, alvo.id)));
    return true;
  },

  concluirFichaTreino: async (idOrTitle, duracaoMin = 50) => {
    const ficha = resolverFicha(get().fichasTreino, idOrTitle);
    const duracao = Number(duracaoMin) > 0 ? Number(duracaoMin) : 50;

    // Sem ficha correspondente, registra o treino pelo texto informado
    if (!ficha) {
      return get().addHealthLog('treino', String(idOrTitle || 'Treino Concluído'), duracao, 'min');
    }

    const resumoExercicios = (ficha.exercicios || [])
      .map((e) => `${e.nome} (${e.series} ${e.reps} - ${e.carga})`)
      .join(' • ');

    return get().addHealthLog('treino', `${ficha.title}: ${resumoExercicios}`, duracao, 'min');
  },

  // =========================================================================
  // HISTÓRICO (health_logs)
  // =========================================================================
  fetchHealthLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const userId = await resolveUserId();
      if (!userId) return;

      // As fichas locais pertencem a uma conta. Se outra pessoa entrou neste aparelho, descarta as do usuário
      // anterior (senão elas seriam enviadas para a nuvem da conta nova).
      const dono = readStorage(FICHAS_OWNER_KEY);
      if (!dono) {
        writeStorage(FICHAS_OWNER_KEY, userId); // dados de antes desta versão: assume que são do usuário atual
      } else if (dono !== userId) {
        writeStorage(FICHAS_STORAGE_KEY, null);
        writeStorage(FICHAS_DIRTY_KEY, null);
        writeStorage(FICHAS_OWNER_KEY, userId);
        set({ fichasTreino: DEFAULT_FICHAS, fichaSyncRowId: null });
      }

      // A linha das fichas é buscada à parte. Misturada aos logs, ela saía da primeira página de 1000
      // linhas com o tempo (é a mais antiga) e as fichas "sumiam".
      const [syncRes, logs] = await Promise.all([
        supabase
          .from('health_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'ficha_sync')
          .order('created_at', { ascending: false }),
        fetchAllRows('health_logs', (q) =>
          q.eq('user_id', userId)
            .neq('type', 'ficha_sync')
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
        )
      ]);
      if (syncRes.error) throw syncRes.error;

      const [syncRow, ...duplicadas] = syncRes.data || [];

      // Duas linhas aparecem quando dois aparelhos criam ao mesmo tempo: mantém a mais recente
      if (duplicadas.length > 0) {
        supabase
          .from('health_logs')
          .delete()
          .in('id', duplicadas.map((r) => r.id))
          .then(({ error }) => {
            if (error) console.warn('Não foi possível limpar fichas duplicadas:', error);
          });
      }

      const localSujo = readStorage(FICHAS_DIRTY_KEY) === '1';

      if (syncRow) {
        set({ fichaSyncRowId: syncRow.id });
        if (localSujo) {
          // Há alterações locais que não chegaram à nuvem: reenvia em vez de sobrescrevê-las com a versão antiga
          get().syncFichasWithCloud(get().fichasTreino);
        } else {
          try {
            const cloudFichas = JSON.parse(syncRow.title);
            if (Array.isArray(cloudFichas)) {
              writeStorage(FICHAS_STORAGE_KEY, JSON.stringify(cloudFichas));
              set({ fichasTreino: cloudFichas, syncStatus: 'ok' });
            }
          } catch (parseErr) {
            console.warn('Falha ao ler o JSON das fichas na nuvem:', parseErr);
          }
        }
      } else if (get().fichasTreino.length > 0) {
        // Ainda não existe na nuvem: sobe as fichas deste aparelho
        get().syncFichasWithCloud(get().fichasTreino);
      }

      set({ healthLogs: logs });
    } catch (error) {
      console.error('[Supabase] Erro ao buscar health_logs:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  addHealthLog: async (type, title, value = null, unit = null) => {
    set({ error: null });

    try {
      const userId = await resolveUserId();
      if (!userId) throw new Error('Usuário não autenticado');

      const cleanType = String(type || 'treino').toLowerCase().trim();

      let numericValue = null;
      if (value !== null && value !== undefined && value !== '') {
        numericValue = Number(String(value).replace(',', '.'));
        if (!Number.isFinite(numericValue)) throw new Error('Valor numérico inválido.');
      }
      validarRegistro(cleanType, numericValue);

      const payload = {
        type: cleanType,
        title: String(title || 'Registro').trim(),
        value: numericValue,
        unit: resolveDefaultUnit(cleanType, unit),
        user_id: userId
      };

      const { data, error } = await supabase.from('health_logs').insert([payload]).select().single();
      if (error) throw error;

      set((state) => ({ healthLogs: [data, ...state.healthLogs] }));
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao salvar health_log:', error);
      set({ error: error.message });
      throw error;
    }
  },

  // Edita título, valor ou unidade. Otimista; se falhar, reverte só este registro.
  updateHealthLog: async (logId, updates = {}) => {
    const original = get().healthLogs.find((l) => sameId(l.id, logId));
    if (!original) throw new Error('Registro não encontrado.');

    const campos = {};
    if (updates.title !== undefined) campos.title = String(updates.title).trim();
    if (updates.unit !== undefined) campos.unit = updates.unit;
    if (updates.value !== undefined) {
      const v = updates.value === null || updates.value === '' ? null : Number(String(updates.value).replace(',', '.'));
      if (v !== null && !Number.isFinite(v)) throw new Error('Valor numérico inválido.');
      validarRegistro(original.type, v);
      campos.value = v;
    }
    if (Object.keys(campos).length === 0) return original;

    set((state) => ({
      healthLogs: state.healthLogs.map((l) => (sameId(l.id, original.id) ? { ...l, ...campos } : l)),
      error: null
    }));

    try {
      const { data, error } = await supabase
        .from('health_logs')
        .update(campos)
        .eq('id', original.id)
        .select()
        .single();
      if (error) throw error;

      set((state) => ({
        healthLogs: state.healthLogs.map((l) => (sameId(l.id, original.id) ? { ...l, ...data } : l))
      }));
      return data;
    } catch (error) {
      console.error('[Supabase] Erro ao atualizar health_log (revertendo):', error);
      set((state) => ({
        healthLogs: state.healthLogs.map((l) => (sameId(l.id, original.id) ? original : l)),
        error: error.message
      }));
      throw error;
    }
  },

  // Exclui. Otimista; reverte se falhar ou se nada foi apagado (id errado ou sem permissão).
  deleteHealthLog: async (logId) => {
    if (!logId) throw new Error('Informe qual registro excluir.');

    const alvo = get().healthLogs.find((l) => sameId(l.id, logId));
    if (!alvo) throw new Error('Registro não encontrado.');

    set((state) => ({
      healthLogs: state.healthLogs.filter((l) => !sameId(l.id, alvo.id)),
      error: null
    }));

    try {
      const { data, error } = await supabase.from('health_logs').delete().eq('id', alvo.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Registro não encontrado.');
    } catch (error) {
      console.error('[Supabase] Erro ao deletar health_log (revertendo):', error);
      set((state) => ({
        healthLogs: [alvo, ...state.healthLogs.filter((l) => !sameId(l.id, alvo.id))],
        error: error.message
      }));
      throw error;
    }
  },

  // Limpa tudo, inclusive as fichas guardadas no aparelho (chame no logout: o store e o localStorage
  // continuam existindo depois que a pessoa sai)
  reset: () => {
    syncVersion++; // cancela envios pendentes
    writeStorage(FICHAS_STORAGE_KEY, null);
    writeStorage(FICHAS_DIRTY_KEY, null);
    writeStorage(FICHAS_OWNER_KEY, null);
    set({
      healthLogs: [],
      fichasTreino: DEFAULT_FICHAS,
      fichaSyncRowId: null,
      syncStatus: 'idle',
      isLoading: false,
      error: null
    });
  }
}));
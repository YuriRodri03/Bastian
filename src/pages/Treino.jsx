// src/pages/Treino.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFitnessStore } from '../store/useFitnessStore';
import {
  Dumbbell, Trash2, Calendar, Scale, Ruler, Play, Plus,
  ChevronDown, ChevronUp, Edit3, Check, X, UserCircle, AlertCircle,
  Timer, RotateCcw, Search, TrendingUp, CheckCircle2,
  Brain, Moon, Smile, Wind, Sparkles, BatteryCharging, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

/* ------------------------------------------------------------------ */
/* Constantes e helpers                                                */
/* ------------------------------------------------------------------ */

const MOOD_LEVELS = [
  { score: 1, label: 'Exausto / Sobrecarregado', emoji: '😫', color: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
  { score: 2, label: 'Tenso / Baixa Energia', emoji: '😕', color: 'border-amber-500/40 bg-amber-500/15 text-amber-300' },
  { score: 3, label: 'Equilibrado / Estável', emoji: '😐', color: 'border-slate-400/40 bg-slate-500/15 text-slate-200' },
  { score: 4, label: 'Focado / Produtivo', emoji: '🙂', color: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300' },
  { score: 5, label: 'Excelente / Em Flow', emoji: '🤩', color: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' }
];

const SLEEP_QUALITIES = [
  { id: 'Reparador', label: 'Reparador', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'Profundo', label: 'Profundo', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { id: 'Leve / Picado', label: 'Leve / Picado', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'Insônia / Pouco', label: 'Insônia / Pouco', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' }
];

const MENTAL_TAGS = [
  'Foco no Mestrado', 'Código / Dev Fluindo', 'Treino Pago', 'Boa Conversa / Lazer',
  'Ansiedade / Prazos', 'Excesso de Café', 'Cansaço Mental', 'Sono Atrasado'
];

const MEDIDAS = [
  { nome: 'Peso', unidade: 'kg' },
  { nome: 'Peitoral', unidade: 'cm' },
  { nome: 'Cintura', unidade: 'cm' },
  { nome: 'Bíceps Dir.', unidade: 'cm' },
  { nome: 'Bíceps Esq.', unidade: 'cm' },
  { nome: 'Coxa Dir.', unidade: 'cm' },
  { nome: 'Coxa Esq.', unidade: 'cm' }
];

const BREATH_PHASES = [
  'Inspire profundamente... (4s)',
  'Segure o ar... (4s)',
  'Expire devagar... (4s)',
  'Pulmões vazios... (4s)'
];
const BREATH_TOTAL_TICKS = 16; // 4 ciclos de 16 s = 1 minuto

const CHECKS_KEY = 'treino_checks_em_andamento';

const FILTROS_HISTORICO = [
  { id: 'todos', label: 'Todos' },
  { id: 'mental_all', label: 'Mente & Sono' },
  { id: 'sono', label: 'Sono' },
  { id: 'humor', label: 'Humor' },
  { id: 'treino', label: 'Treinos' },
  { id: 'peso', label: 'Peso' },
  { id: 'medida', label: 'Medidas' }
];

const TAG_CONFIG = {
  treino: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: Dumbbell },
  peso: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: Scale },
  medida: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', icon: Ruler },
  sono: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', icon: Moon },
  humor: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30', icon: Smile }
};

const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const logTime = (l) => new Date(l.created_at || l.date).getTime();
const porDataDesc = (a, b) => logTime(b) - logTime(a);

const diaISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const hojeISO = () => diaISO(new Date());

// Peso vem de type 'peso'; as demais medidas, de type 'medida' com o título igual ao nome
// (sem diferenciar maiúscula/acento: o Bastian pode registrar "cintura" em minúsculo)
const combinaComMedida = (log, nomeMedida) =>
  nomeMedida === 'Peso' ? log.type === 'peso' : log.type === 'medida' && norm(log.title) === norm(nomeMedida);

const formatDateToBR = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

const lerChecksSalvos = () => {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHECKS_KEY) || 'null');
    // Marcações de outro dia não valem: o treino de ontem não pode aparecer pela metade hoje
    if (salvo && salvo.dia === hojeISO() && salvo.checks) return salvo.checks;
  } catch { /* ignora */ }
  return {};
};

// Um único AudioContext, criado/ativado num clique (políticas de autoplay e o limite de contextos do navegador).
// Antes, cada bipe criava um contexto novo e nunca o fechava.
let audioCtxCompartilhado = null;
const getAudioCtx = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtxCompartilhado || audioCtxCompartilhado.state === 'closed') audioCtxCompartilhado = new Ctx();
  return audioCtxCompartilhado;
};

const prepararAudio = () => {
  try {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { /* ignora */ }
};

const playRestBeep = () => {
  try {
    const ctx = getAudioCtx();
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      [880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const inicio = ctx.currentTime + idx * 0.15;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, inicio);
        gain.gain.setValueAtTime(0.2, inicio);
        gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.3);
      });
    }
  } catch (e) {
    console.warn('Áudio bloqueado:', e);
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
};

/* ------------------------------------------------------------------ */
/* Componentes pequenos                                                */
/* ------------------------------------------------------------------ */

const Kpi = ({ gradient, border, label, value, valueClass = 'text-white' }) => (
  <div className={`bg-gradient-to-br ${gradient} to-transparent border ${border} px-3.5 py-2 rounded-2xl backdrop-blur-md flex items-center gap-2.5 shadow-lg`}>
    <div>
      <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">{label}</div>
      <div className={`text-sm font-bold font-mono ${valueClass}`}>{value}</div>
    </div>
  </div>
);

const DeleteButton = ({ confirming, onClick, title, confirmLabel = 'Confirmar?', iconSize = 16, className = '', idleClassName, confirmClassName }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`rounded-xl transition-all flex items-center gap-1 font-bold ${className} ${
      confirming
        ? (confirmClassName || 'bg-rose-500 text-white px-3 animate-pulse')
        : (idleClassName || 'text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10')
    }`}
  >
    <Trash2 size={iconSize} />
    {confirming && <span>{confirmLabel}</span>}
  </button>
);

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Treino() {
  const {
    healthLogs, fichasTreino, syncStatus, error: storeError,
    addHealthLog, deleteHealthLog, fetchHealthLogs,
    addFichaTreino, updateFichaTreino, deleteFichaTreino, concluirFichaTreino,
    syncFichasWithCloud
  } = useFitnessStore();

  const [activeTab, setActiveTab] = useState('fisico'); // 'fisico' | 'mental'

  /* ------------------------------ Toast e ações ------------------------------ */

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimerRef = useRef(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);
  const [savingKey, setSavingKey] = useState(null); // evita salvar duas vezes com cliques rápidos

  const showToast = (message, type = 'success') => {
    clearTimeout(toastTimerRef.current); // antes, o timer do aviso anterior escondia o novo antes da hora
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3500);
  };

  useEffect(() => () => {
    clearTimeout(toastTimerRef.current);
    clearTimeout(confirmTimerRef.current);
  }, []);

  // Executa uma ação de gravação uma vez por vez; qualquer falha vira um aviso na tela
  const guarded = async (key, fn, mensagemErro) => {
    if (savingKey) return;
    setSavingKey(key);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      showToast(mensagemErro, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const triggerSafeDelete = (uniqueKey, callback, mensagemErro = 'Não foi possível excluir.') => {
    clearTimeout(confirmTimerRef.current);
    if (confirmDeleteId === uniqueKey) {
      setConfirmDeleteId(null);
      Promise.resolve()
        .then(callback)
        .catch((err) => {
          console.error(err);
          showToast(mensagemErro, 'error');
        });
      return;
    }
    setConfirmDeleteId(uniqueKey);
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
  };

  useEffect(() => {
    fetchHealthLogs();
  }, [fetchHealthLogs]);

  /* ------------------------------ Mente & Sono ------------------------------ */

  const [sleepHours, setSleepHours] = useState('7.5');
  const [sleepQuality, setSleepQuality] = useState('Reparador');
  const [sleepNotes, setSleepNotes] = useState('');

  const [moodScore, setMoodScore] = useState(4);
  const [energyLevel, setEnergyLevel] = useState('Alta');
  const [selectedTags, setSelectedTags] = useState([]);
  const [moodNote, setMoodNote] = useState('');

  // Respiração quadrada 4-4-4-4. A fase é derivada do passo (antes, setBreathPhase rodava dentro do
  // updater do setBreathStep: efeito colateral que o React Strict Mode executa em dobro)
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathStep, setBreathStep] = useState(0);
  const breathPhase = breathingActive ? BREATH_PHASES[breathStep] : 'Pronto para relaxar';

  useEffect(() => {
    if (!breathingActive) {
      setBreathStep(0);
      return undefined;
    }
    let ticks = 0;
    setBreathStep(0);
    const interval = setInterval(() => {
      ticks += 1;
      if (ticks >= BREATH_TOTAL_TICKS) {
        // o botão diz "Iniciar 1 min", mas a sessão nunca terminava sozinha
        setBreathingActive(false);
        showToast('Sessão de respiração concluída.');
        return;
      }
      setBreathStep(ticks % 4);
    }, 4000);
    return () => clearInterval(interval);
  }, [breathingActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMentalTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSaveSleep = (e) => {
    e.preventDefault();
    const hoursNum = parseFloat(String(sleepHours).replace(',', '.'));
    if (Number.isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      showToast('Insira uma quantidade válida de horas.', 'error');
      return;
    }
    guarded('sono', async () => {
      const notas = sleepNotes.trim();
      const titulo = notas ? `Sono (${sleepQuality}): ${notas}` : `Sono (${sleepQuality})`;
      await addHealthLog('sono', titulo, hoursNum, 'h');
      setSleepNotes('');
      showToast(`Sono de ${hoursNum}h (${sleepQuality}) registrado!`);
    }, 'Erro ao registrar sono.');
  };

  const handleSaveMood = (e) => {
    e.preventDefault();
    const moodObj = MOOD_LEVELS.find((m) => m.score === moodScore) || MOOD_LEVELS[3];
    const tagsStr = selectedTags.length > 0 ? `[${selectedTags.join(', ')}]` : '';
    const extraParts = [`Energia: ${energyLevel}`, tagsStr, moodNote.trim()].filter(Boolean).join(' • ');

    guarded('humor', async () => {
      await addHealthLog('humor', `${moodObj.emoji} ${moodObj.label}: ${extraParts}`, moodScore, '/5');
      setSelectedTags([]);
      setMoodNote('');
      showToast(`Check-in mental salvo (${moodObj.label})!`);
    }, 'Erro ao salvar check-in mental.');
  };

  /* ------------------------ Descanso entre séries (físico) ------------------------ */

  // Baseado em horário de término (e não em "menos 1 a cada segundo"): continua certo mesmo se o navegador
  // atrasar os timers com a aba em segundo plano ou a tela bloqueada
  const [restEndsAt, setRestEndsAt] = useState(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restPreset, setRestPreset] = useState(null);
  const restRunning = restEndsAt !== null;

  useEffect(() => {
    if (restEndsAt === null) return undefined;

    const tick = () => {
      const restante = Math.ceil((restEndsAt - Date.now()) / 1000);
      if (restante <= 0) {
        setRestSeconds(0);
        setRestEndsAt(null);
        setRestPreset(null);
        playRestBeep();
        showToast('Descanso finalizado! Próxima série.');
      } else {
        setRestSeconds(restante);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [restEndsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRestTimer = (secs) => {
    prepararAudio(); // dentro do clique, para o bipe poder tocar depois
    setRestPreset(secs);
    setRestSeconds(secs);
    setRestEndsAt(Date.now() + secs * 1000);
  };

  const resetRestTimer = () => {
    setRestEndsAt(null);
    setRestSeconds(0);
    setRestPreset(null);
  };

  /* ---------------------- Fichas de treino e biometria (físico) ---------------------- */

  const [expandedFichaId, setExpandedFichaId] = useState(null);
  const [checkedExercises, setCheckedExercises] = useState(lerChecksSalvos);
  const [workoutDuration, setWorkoutDuration] = useState('50');

  const [isCreatingFicha, setIsCreatingFicha] = useState(false);
  const [editingFichaId, setEditingFichaId] = useState(null);
  const [novaFichaTitulo, setNovaFichaTitulo] = useState('');
  const [exerciciosTemp, setExerciciosTemp] = useState([]);

  const [novoExercicioNome, setNovoExercicioNome] = useState('');
  const [novoExercicioSeries, setNovoExercicioSeries] = useState('4x');
  const [novoExercicioReps, setNovoExercicioReps] = useState('10-12');
  const [novoExercicioCarga, setNovoExercicioCarga] = useState('10kg');

  const [editFichaTitulo, setEditFichaTitulo] = useState('');
  const [editExercicios, setEditExercicios] = useState([]);

  // As marcações da sessão sobrevivem a um recarregamento acidental no meio do treino (valem só para o dia)
  useEffect(() => {
    try {
      localStorage.setItem(CHECKS_KEY, JSON.stringify({ dia: hojeISO(), checks: checkedExercises }));
    } catch { /* ignora */ }
  }, [checkedExercises]);

  const toggleExerciseCheck = (exKey) => {
    setCheckedExercises((prev) => ({ ...prev, [exKey]: !prev[exKey] }));
  };

  const handleConcluirTreino = (ficha) => {
    const duracaoNum = Math.min(600, Math.max(1, parseInt(workoutDuration, 10) || 50));

    guarded(`concluir-${ficha.id}`, async () => {
      await concluirFichaTreino(ficha.id, duracaoNum);

      setCheckedExercises((prev) => {
        const resetChecks = { ...prev };
        (ficha.exercicios || []).forEach((ex, i) => {
          delete resetChecks[`${ficha.id}-${ex.id || i}`];
        });
        return resetChecks;
      });

      showToast(`Treino "${ficha.title}" registrado (${duracaoNum} min)!`);
    }, 'Erro ao registrar treino no banco.');
  };

  const handleAddExercicioTemp = () => {
    if (!novoExercicioNome.trim()) return;
    setExerciciosTemp((prev) => [
      ...prev,
      {
        id: uid(),
        nome: novoExercicioNome.trim(),
        series: novoExercicioSeries.trim() || '3x',
        reps: novoExercicioReps.trim() || '10',
        carga: novoExercicioCarga.trim() || 'Peso Corp.'
      }
    ]);
    setNovoExercicioNome('');
  };

  const handleSaveNovaFicha = (e) => {
    e.preventDefault();
    if (!novaFichaTitulo.trim() || exerciciosTemp.length === 0) {
      showToast('Adicione um título e ao menos um exercício.', 'error');
      return;
    }
    try {
      const nova = addFichaTreino(novaFichaTitulo.trim(), exerciciosTemp);
      setNovaFichaTitulo('');
      setExerciciosTemp([]);
      setIsCreatingFicha(false);
      setExpandedFichaId(nova.id);
      showToast('Nova ficha criada com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Não foi possível criar a ficha.', 'error');
    }
  };

  const handleStartEdit = (ficha) => {
    setEditingFichaId(ficha.id);
    setEditFichaTitulo(ficha.title);
    setEditExercicios((ficha.exercicios || []).map((ex) => ({ ...ex, id: ex.id || uid() })));
    setExpandedFichaId(ficha.id);
  };

  const handleSaveEdit = (id) => {
    const cleanExercises = editExercicios.filter((ex) => ex.nome && ex.nome.trim() !== '');
    if (!editFichaTitulo.trim() || cleanExercises.length === 0) {
      showToast('A ficha precisa de um título e ao menos 1 exercício válido.', 'error');
      return;
    }
    try {
      const atualizada = updateFichaTreino(id, { title: editFichaTitulo.trim(), exercicios: cleanExercises });
      if (!atualizada) throw new Error('Ficha não encontrada.');
      setEditingFichaId(null);
      showToast('Ficha atualizada com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Não foi possível atualizar a ficha.', 'error');
    }
  };

  const handleDeleteFicha = (id) => {
    if (!deleteFichaTreino(id)) throw new Error('Ficha não encontrada.');
    showToast('Ficha excluída.');
  };

  const updateEditExercicio = (index, campo, valor) => {
    setEditExercicios((prev) => prev.map((item, idx) => (idx === index ? { ...item, [campo]: valor } : item)));
  };

  // Medidas rápidas (valores digitados)
  const [valoresMedidas, setValoresMedidas] = useState({});
  const [selectedMetricChart, setSelectedMetricChart] = useState('Peso');

  const handleMedidaChange = (nome, valor) => {
    setValoresMedidas((prev) => ({ ...prev, [nome]: valor }));
  };

  const handleSaveMedida = (medida) => {
    const bruto = valoresMedidas[medida.nome];
    if (!bruto) return;

    const numValue = parseFloat(String(bruto).replace(',', '.'));
    if (Number.isNaN(numValue) || numValue <= 0) {
      showToast('Informe um valor maior que zero.', 'error');
      return;
    }

    guarded(`medida-${medida.nome}`, async () => {
      const tipoRegistro = medida.nome === 'Peso' ? 'peso' : 'medida';
      await addHealthLog(tipoRegistro, medida.nome, numValue, medida.unidade);
      handleMedidaChange(medida.nome, '');
      showToast(`${medida.nome} registrado: ${numValue}${medida.unidade}!`);
    }, 'Erro ao salvar medida no banco.');
  };

  /* ------------------------ Métricas e histórico ------------------------ */

  const [activeFilter, setActiveFilter] = useState('todos');
  const [searchHistory, setSearchHistory] = useState('');

  useEffect(() => {
    setActiveFilter(activeTab === 'mental' ? 'mental_all' : 'todos');
  }, [activeTab]);

  const {
    totalTreinos, treinosMesAtual, ultimoPeso, historicoPorMedida, chartEvolutionData,
    mediaSono7Dias, mediaHumorRecente, ultimoSono, mentalChartData
  } = useMemo(() => {
    const safeLogs = healthLogs || [];
    const now = new Date();

    const treinos = safeLogs.filter((l) => l.type === 'treino');
    const treinosMes = treinos.filter((l) => {
      const d = new Date(l.created_at || l.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // Histórico de cada medida, do mais recente para o mais antigo (calculado uma vez por mudança nos dados)
    const porMedida = {};
    MEDIDAS.forEach((m) => {
      porMedida[m.nome] = safeLogs.filter((l) => combinaComMedida(l, m.nome)).sort(porDataDesc);
    });

    const selecionada = MEDIDAS.find((m) => m.nome === selectedMetricChart) || MEDIDAS[0];
    const evolucao = [...(porMedida[selecionada.nome] || []).slice(0, 12)].reverse().map((l) => ({
      data: new Date(l.created_at || l.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      valor: Number(l.value || 0),
      unidade: l.unit || selecionada.unidade
    }));

    const sonos = safeLogs.filter((l) => l.type === 'sono').sort(porDataDesc);
    const humores = safeLogs.filter((l) => l.type === 'humor').sort(porDataDesc);
    const media = (lista) =>
      lista.length > 0 ? (lista.reduce((acc, l) => acc + Number(l.value || 0), 0) / lista.length).toFixed(1) : null;

    // Sono e humor por dia. A chave é a data completa (antes era DD/MM e juntava o mesmo dia de anos diferentes);
    // o humor do dia é a média dos check-ins, não só o último.
    const mapaMental = new Map();
    safeLogs
      .filter((l) => l.type === 'sono' || l.type === 'humor')
      .sort((a, b) => logTime(a) - logTime(b))
      .forEach((l) => {
        const d = new Date(l.created_at || l.date);
        const key = diaISO(d);
        if (!mapaMental.has(key)) {
          mapaMental.set(key, {
            data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            Sono: null,
            humores: []
          });
        }
        const item = mapaMental.get(key);
        if (l.type === 'sono') item.Sono = Number(l.value || 0);
        else item.humores.push(Number(l.value || 0));
      });

    const mentalData = Array.from(mapaMental.values())
      .map(({ data, Sono, humores: hs }) => ({
        data,
        Sono,
        Humor: hs.length > 0 ? Number((hs.reduce((a, b) => a + b, 0) / hs.length).toFixed(1)) : null
      }))
      .slice(-14);

    return {
      totalTreinos: treinos.length,
      treinosMesAtual: treinosMes,
      ultimoPeso: (porMedida.Peso || [])[0] || null,
      historicoPorMedida: porMedida,
      chartEvolutionData: evolucao,
      mediaSono7Dias: media(sonos.slice(0, 7)),
      mediaHumorRecente: media(humores.slice(0, 7)),
      ultimoSono: sonos[0] || null,
      mentalChartData: mentalData
    };
  }, [healthLogs, selectedMetricChart]);

  const filteredLogs = useMemo(() => {
    const query = norm(searchHistory);
    return (healthLogs || [])
      .filter((log) => {
        let matchType = true;
        if (activeFilter === 'mental_all') matchType = log.type === 'sono' || log.type === 'humor';
        else if (activeFilter !== 'todos') matchType = log.type === activeFilter;
        const matchQuery = !query || norm(log.title).includes(query);
        return matchType && matchQuery;
      })
      .sort(porDataDesc);
  }, [healthLogs, activeFilter, searchHistory]);

  /* -------------------------------- Render -------------------------------- */

  const inputBase = 'w-full bg-black/40 border border-white/10 rounded-xl text-slate-200 focus:outline-none';

  return (
    <div className="min-h-[calc(100vh-80px)] w-full px-3 py-6 sm:p-8 font-sans flex flex-col items-center overflow-x-hidden box-border max-w-[100vw] relative">

      {/* Toast */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform ${
          toast.show ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
        } ${toast.type === 'error' ? 'bg-rose-950/95 border-rose-500/30 text-rose-300' : 'bg-emerald-950/95 border-emerald-500/30 text-emerald-300'}`}
      >
        {toast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
        <span className="text-xs sm:text-sm font-bold tracking-wide">{toast.message}</span>
      </div>

      {/* CABEÇALHO */}
      <div className="w-full max-w-7xl mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl border backdrop-blur-md shadow-lg transition-colors ${
            activeTab === 'mental'
              ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border-purple-500/30 shadow-purple-500/10'
              : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border-cyan-500/20 shadow-cyan-500/10'
          }`}>
            {activeTab === 'mental'
              ? <Brain className="text-purple-400 w-6 h-6 sm:w-7 sm:h-7" />
              : <Dumbbell className="text-cyan-400 w-6 h-6 sm:w-7 sm:h-7" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Saúde & Performance</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {activeTab === 'mental'
                ? 'Monitoramento de Sono, Humor, Energia & Equilíbrio Mental'
                : 'Controle de Hipertrofia, Calistenia & Biometria Corporal'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center bg-black/40 border border-white/10 p-1.5 rounded-2xl backdrop-blur-xl shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('fisico')}
              aria-pressed={activeTab === 'fisico'}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'fisico' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Dumbbell size={16} /> <span>Físico & Treinos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mental')}
              aria-pressed={activeTab === 'mental'}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'mental' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Brain size={16} /> <span>Mente & Sono</span>
            </button>
          </div>

          {activeTab === 'fisico' ? (
            <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto">
              <Kpi gradient="from-cyan-500/10" border="border-cyan-500/20" label="No Mês" value={<>{treinosMesAtual} <span className="text-[10px] text-slate-400 font-sans">treinos</span></>} />
              <Kpi gradient="from-indigo-500/10" border="border-indigo-500/20" label="Total" value={totalTreinos} />
              <Kpi gradient="from-emerald-500/10" border="border-emerald-500/20" label="Peso" valueClass="text-emerald-400" value={ultimoPeso ? `${ultimoPeso.value}${ultimoPeso.unit ?? 'kg'}` : '--'} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto">
              <Kpi gradient="from-indigo-500/15" border="border-indigo-500/25" label="Média Sono" valueClass="text-indigo-300" value={mediaSono7Dias ? `${mediaSono7Dias}h` : '--'} />
              <Kpi gradient="from-purple-500/15" border="border-purple-500/25" label="Humor Médio" valueClass="text-purple-300" value={mediaHumorRecente ? `${mediaHumorRecente}/5` : '--'} />
              <Kpi gradient="from-emerald-500/15" border="border-emerald-500/25" label="Última Noite" valueClass="text-emerald-300" value={ultimoSono ? `${ultimoSono.value}h` : '--'} />
            </div>
          )}
        </div>
      </div>

      {/* Aviso de falha ao carregar/gravar */}
      {storeError && (
        <div role="alert" className="w-full max-w-7xl mb-4 flex items-start justify-between gap-3 text-xs sm:text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
          <span className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            Houve uma falha ao sincronizar seus registros: {storeError}
          </span>
          <button type="button" onClick={() => useFitnessStore.setState({ error: null })} aria-label="Fechar aviso" className="shrink-0 hover:text-rose-200">
            <X size={16} />
          </button>
        </div>
      )}

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ================= COLUNA ESQUERDA ================= */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {activeTab === 'mental' ? (
            <>
              {/* SONO */}
              <form onSubmit={handleSaveSleep} className="bg-gradient-to-b from-indigo-950/40 to-white/5 border border-indigo-500/25 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Moon size={18} className="text-indigo-400" /> Registro de Sono
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    Meta: 7.5h - 8h
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="tr-sono-horas" className="text-xs font-bold text-slate-300 uppercase tracking-wider">Horas Dormidas</label>
                    <span className="font-mono text-xl font-bold text-indigo-300 bg-black/40 px-3 py-1 rounded-xl border border-indigo-500/30">
                      {sleepHours}h
                    </span>
                  </div>
                  <input
                    id="tr-sono-horas"
                    type="range"
                    min="2"
                    max="12"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer h-2 bg-black/50 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>2h</span><span>5h</span><span>7.5h (Ideal)</span><span>10h</span><span>12h</span>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Qualidade do Descanso</span>
                  <div className="grid grid-cols-2 gap-2">
                    {SLEEP_QUALITIES.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setSleepQuality(q.id)}
                        aria-pressed={sleepQuality === q.id}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${sleepQuality === q.id ? `${q.color} shadow-md scale-[1.01]` : 'bg-black/30 border-white/5 text-slate-400 hover:text-slate-200'}`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  aria-label="Observação sobre o sono"
                  value={sleepNotes}
                  onChange={(e) => setSleepNotes(e.target.value)}
                  placeholder="Observação opcional (ex: acordei às 6h30, tomei café tarde...)"
                  className={`${inputBase} p-3 text-base sm:text-sm focus:border-indigo-500 placeholder:text-slate-500`}
                />

                <button
                  type="submit"
                  disabled={savingKey === 'sono'}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Check size={16} /> {savingKey === 'sono' ? 'Salvando...' : 'Salvar Noite de Sono'}
                </button>
              </form>

              {/* HUMOR */}
              <form onSubmit={handleSaveMood} className="bg-gradient-to-b from-purple-950/30 to-white/5 border border-purple-500/25 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Smile size={18} className="text-purple-400" /> Check-in Mental & Humor
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">Diário de Estado</span>
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">Como está sua mente hoje?</span>
                  <div className="grid grid-cols-5 gap-2">
                    {MOOD_LEVELS.map((m) => (
                      <button
                        key={m.score}
                        type="button"
                        onClick={() => setMoodScore(m.score)}
                        aria-pressed={moodScore === m.score}
                        className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl border transition-all ${moodScore === m.score ? `${m.color} scale-105 shadow-lg` : 'bg-black/30 border-white/5 opacity-60 hover:opacity-100'}`}
                        title={m.label}
                        aria-label={m.label}
                      >
                        <span className="text-2xl mb-1">{m.emoji}</span>
                        <span className="text-[10px] font-mono font-bold">{m.score}/5</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-xs font-bold text-purple-300 mt-2">
                    {MOOD_LEVELS.find((m) => m.score === moodScore)?.label}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BatteryCharging size={14} className="text-amber-400" /> Bateria Mental & Foco
                  </span>
                  <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                    {['Baixa', 'Moderada', 'Alta'].map((nivel) => (
                      <button
                        key={nivel}
                        type="button"
                        onClick={() => setEnergyLevel(nivel)}
                        aria-pressed={energyLevel === nivel}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${energyLevel === nivel ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40' : 'text-slate-400 hover:text-white'}`}
                      >
                        {nivel}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Fatores de Impacto (Opcional)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MENTAL_TAGS.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleMentalTag(tag)}
                          aria-pressed={active}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${active ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-black/30 text-slate-400 border-white/5 hover:border-white/15 hover:text-slate-200'}`}
                        >
                          {active ? `✓ ${tag}` : `+ ${tag}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  rows={2}
                  aria-label="Anotação do dia"
                  value={moodNote}
                  onChange={(e) => setMoodNote(e.target.value)}
                  placeholder="Algum desabafo rápido, insight ou reflexão sobre o dia?"
                  className={`${inputBase} p-3 text-base sm:text-sm focus:border-purple-500 placeholder:text-slate-500 resize-none`}
                />

                <button
                  type="submit"
                  disabled={savingKey === 'humor'}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Sparkles size={16} /> {savingKey === 'humor' ? 'Salvando...' : 'Registrar Check-in Mental'}
                </button>
              </form>

              {/* RESPIRAÇÃO */}
              <div className="bg-gradient-to-r from-cyan-950/50 via-slate-900/80 to-indigo-950/50 border border-cyan-500/25 p-5 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-300 flex items-center gap-2">
                    <Wind size={16} className={breathingActive ? 'text-cyan-400 animate-pulse' : 'text-cyan-400'} />
                    Respiração Quadrada (Foco & Calma)
                  </span>
                  <button
                    type="button"
                    onClick={() => setBreathingActive((v) => !v)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${breathingActive ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30'}`}
                  >
                    {breathingActive ? 'Parar' : 'Iniciar 1 min'}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full transition-all duration-1000 ${
                      !breathingActive ? 'bg-slate-600' :
                      breathStep === 0 ? 'bg-cyan-400 scale-150 shadow-[0_0_15px_#22d3ee]' :
                      breathStep === 1 ? 'bg-indigo-400 scale-150 shadow-[0_0_15px_#818cf8]' :
                      breathStep === 2 ? 'bg-emerald-400 scale-90' : 'bg-slate-500 scale-75'
                    }`} />
                    <span className="text-xs sm:text-sm font-bold text-slate-200">{breathPhase}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Ciclo 4-4-4-4</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* DESCANSO ENTRE SÉRIES */}
              <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-cyan-950/60 border border-cyan-500/25 p-4 sm:p-5 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-300 flex items-center gap-2">
                    <Timer size={16} className={restRunning ? 'text-cyan-400 animate-spin' : 'text-cyan-400'} />
                    Descanso entre Séries
                  </span>
                  {restRunning && (
                    <button
                      type="button"
                      onClick={resetRestTimer}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20"
                    >
                      <RotateCcw size={12} /> Zerar
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-2xl sm:text-3xl font-bold text-white bg-black/40 px-4 py-2 rounded-2xl border border-white/10 min-w-[100px] text-center" aria-live="off">
                    {String(Math.floor(restSeconds / 60)).padStart(2, '0')}:{String(restSeconds % 60).padStart(2, '0')}
                  </div>

                  <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
                    {[45, 60, 90, 120].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => startRestTimer(sec)}
                        aria-pressed={restRunning && restPreset === sec}
                        className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                          restRunning && restPreset === sec
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/25'
                            : 'bg-white/5 hover:bg-white/15 text-slate-200 border-white/10'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* FICHAS */}
              <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
                <div className="flex justify-between items-center mb-5 border-b border-white/10 pb-4 gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <Dumbbell size={18} className="text-cyan-400" /> Minhas Fichas ({fichasTreino.length})
                    </h2>
                    {syncStatus === 'syncing' && <span className="text-[10px] text-slate-400">Sincronizando…</span>}
                    {syncStatus === 'error' && (
                      <button
                        type="button"
                        onClick={() => syncFichasWithCloud(fichasTreino)}
                        className="text-[10px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1"
                      >
                        <RefreshCw size={10} /> Salvo só neste aparelho · tentar sincronizar
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFicha((v) => !v)}
                    className="px-3.5 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {isCreatingFicha ? <><X size={15} /> Fechar</> : <><Plus size={15} /> Nova Ficha</>}
                  </button>
                </div>

                {isCreatingFicha && (
                  <form onSubmit={handleSaveNovaFicha} className="bg-black/40 border border-cyan-500/30 p-4 rounded-2xl mb-5 space-y-4 shadow-inner">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Edit3 size={14} /> Nova Ficha de Treino
                    </h3>

                    <input
                      required
                      type="text"
                      aria-label="Título da ficha"
                      value={novaFichaTitulo}
                      onChange={(e) => setNovaFichaTitulo(e.target.value)}
                      placeholder="Título (ex: Treino D - Full Body / Calistenia)"
                      className={`${inputBase} p-3 text-base sm:text-sm focus:border-cyan-500 font-semibold`}
                    />

                    <div className="space-y-3 border-t border-white/10 pt-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Adicionar Exercícios:</span>
                      <div className="flex flex-col gap-2.5 bg-black/20 p-3 rounded-xl border border-white/5">
                        <input
                          type="text"
                          aria-label="Nome do exercício"
                          value={novoExercicioNome}
                          onChange={(e) => setNovoExercicioNome(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddExercicioTemp(); } }}
                          placeholder="Nome do Exercício (Enter para incluir)"
                          className={`${inputBase} p-2.5 text-base sm:text-sm focus:border-cyan-500`}
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" aria-label="Séries" value={novoExercicioSeries} onChange={(e) => setNovoExercicioSeries(e.target.value)} placeholder="Séries (4x)" className={`${inputBase} p-2.5 text-base sm:text-sm text-center`} />
                          <input type="text" aria-label="Repetições" value={novoExercicioReps} onChange={(e) => setNovoExercicioReps(e.target.value)} placeholder="Reps (10-12)" className={`${inputBase} p-2.5 text-base sm:text-sm text-center`} />
                          <input type="text" aria-label="Carga" value={novoExercicioCarga} onChange={(e) => setNovoExercicioCarga(e.target.value)} placeholder="Carga (10kg)" className={`${inputBase} p-2.5 text-base sm:text-sm text-center font-mono text-cyan-300`} />
                        </div>
                        <button type="button" onClick={handleAddExercicioTemp} className="py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold border border-white/10 transition-all flex justify-center items-center gap-1.5">
                          <Plus size={15} /> Incluir Exercício
                        </button>
                      </div>

                      {exerciciosTemp.length > 0 && (
                        <div className="bg-black/30 p-2.5 rounded-xl space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar border border-white/5">
                          {exerciciosTemp.map((ex) => (
                            <div key={ex.id} className="flex items-center justify-between text-xs text-slate-300 px-3 py-2 bg-white/5 rounded-lg border border-white/5">
                              <span className="font-semibold truncate pr-2">{ex.nome} <span className="opacity-60 font-mono">({ex.series} {ex.reps})</span></span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded">{ex.carga}</span>
                                <button type="button" aria-label={`Remover ${ex.nome}`} onClick={() => setExerciciosTemp((prev) => prev.filter((item) => item.id !== ex.id))} className="text-slate-500 hover:text-rose-400">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button type="button" onClick={() => setIsCreatingFicha(false)} className="px-4 py-2.5 bg-white/5 text-slate-300 hover:bg-white/10 text-xs font-bold rounded-xl">
                        Cancelar
                      </button>
                      <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg flex justify-center items-center gap-1.5">
                        <Check size={16} /> Salvar Ficha
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3.5">
                  {fichasTreino.length === 0 && (
                    <p className="text-xs sm:text-sm text-slate-500 text-center py-6">Nenhuma ficha ainda. Toque em "Nova Ficha" para criar a primeira.</p>
                  )}

                  {fichasTreino.map((ficha) => {
                    const isExpanded = expandedFichaId === ficha.id;
                    const isEditing = editingFichaId === ficha.id;
                    const confirmFichaKey = `ficha-${ficha.id}`;
                    const isConfirmingDelete = confirmDeleteId === confirmFichaKey;

                    const exerciciosDaFicha = ficha.exercicios || [];
                    const doneCount = exerciciosDaFicha.filter((ex, idx) => checkedExercises[`${ficha.id}-${ex.id || idx}`]).length;
                    const totalEx = exerciciosDaFicha.length;
                    const concluindo = savingKey === `concluir-${ficha.id}`;

                    return (
                      <div key={ficha.id} className={`bg-black/30 border rounded-2xl transition-all duration-200 ${isExpanded ? 'border-cyan-500/40 shadow-lg shadow-cyan-500/5' : 'border-white/10 hover:border-white/20'}`}>
                        <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                          <div
                            className="cursor-pointer flex-1 min-w-0"
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => !isEditing && setExpandedFichaId(isExpanded ? null : ficha.id)}
                            onKeyDown={(e) => {
                              if (!isEditing && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                e.preventDefault();
                                setExpandedFichaId(isExpanded ? null : ficha.id);
                              }
                            }}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                aria-label="Título da ficha"
                                value={editFichaTitulo}
                                onChange={(e) => setEditFichaTitulo(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-black/60 border border-cyan-500/50 rounded-xl px-3 py-2 text-base sm:text-sm text-white w-full font-bold focus:outline-none"
                              />
                            ) : (
                              <div>
                                <h4 className="text-sm sm:text-base font-bold text-white flex items-center justify-between sm:justify-start gap-2">
                                  <span className="truncate">{ficha.title}</span>
                                  {isExpanded ? <ChevronUp size={16} className="text-cyan-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
                                </h4>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                    {totalEx} exercícios
                                  </span>
                                  {doneCount > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                      {doneCount}/{totalEx} concluídos
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-1.5 border-t border-white/5 sm:border-0 pt-2.5 sm:pt-0 shrink-0">
                            {!isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleConcluirTreino(ficha)}
                                  disabled={Boolean(savingKey)}
                                  className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-60 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                                >
                                  <CheckCircle2 size={15} /> {concluindo ? 'Salvando...' : 'Concluir'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(ficha)}
                                  title="Editar ficha"
                                  aria-label="Editar ficha"
                                  className="text-slate-400 hover:text-cyan-400 p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                  <Edit3 size={15} />
                                </button>
                                <DeleteButton
                                  confirming={isConfirmingDelete}
                                  onClick={() => triggerSafeDelete(confirmFichaKey, () => handleDeleteFicha(ficha.id), 'Não foi possível excluir a ficha.')}
                                  title="Excluir ficha"
                                  confirmLabel="Apagar?"
                                  iconSize={15}
                                  className="p-2 text-[11px]"
                                  confirmClassName="bg-rose-500 text-white px-2.5 animate-pulse"
                                />
                              </>
                            ) : (
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button type="button" onClick={() => setEditingFichaId(null)} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold">
                                  Cancelar
                                </button>
                                <button type="button" onClick={() => handleSaveEdit(ficha.id)} className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                                  <Check size={15} /> Salvar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {(isExpanded || isEditing) && (
                          <div className="p-4 pt-3 border-t border-white/10 space-y-2.5">
                            {!isEditing ? (
                              <>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                                  Toque nos exercícios para marcar seu progresso na sessão:
                                </p>
                                {exerciciosDaFicha.map((ex, i) => {
                                  const checkKey = `${ficha.id}-${ex.id || i}`;
                                  const isDone = Boolean(checkedExercises[checkKey]);

                                  return (
                                    <div
                                      key={checkKey}
                                      role="checkbox"
                                      aria-checked={isDone}
                                      tabIndex={0}
                                      onClick={() => toggleExerciseCheck(checkKey)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          toggleExerciseCheck(checkKey);
                                        }
                                      }}
                                      className={`cursor-pointer flex flex-col sm:flex-row sm:justify-between sm:items-center text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border transition-all gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/60 ${
                                        isDone ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                      }`}
                                    >
                                      <span className={`font-bold flex items-center gap-2.5 ${isDone ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                        <input
                                          type="checkbox"
                                          checked={isDone}
                                          readOnly
                                          tabIndex={-1}
                                          aria-hidden="true"
                                          className="w-4 h-4 rounded border-white/20 bg-black/40 text-emerald-500 pointer-events-none shrink-0"
                                        />
                                        {ex.nome}
                                      </span>
                                      <div className="flex items-center gap-2 text-[11px] font-mono pl-6 sm:pl-0 shrink-0">
                                        <span className="text-slate-300 bg-black/40 px-2 py-0.5 rounded border border-white/5">{ex.series} {ex.reps}</span>
                                        <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-500/20">{ex.carga}</span>
                                      </div>
                                    </div>
                                  );
                                })}

                                <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t border-white/10">
                                  <div className="flex items-center gap-2">
                                    <label htmlFor={`tr-dur-${ficha.id}`} className="text-[11px] text-slate-400 font-semibold">Duração (min):</label>
                                    <input
                                      id={`tr-dur-${ficha.id}`}
                                      type="number"
                                      min="1"
                                      max="600"
                                      value={workoutDuration}
                                      onChange={(e) => setWorkoutDuration(e.target.value)}
                                      className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-base sm:text-xs font-mono text-center text-white focus:outline-none focus:border-cyan-500"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleConcluirTreino(ficha)}
                                    disabled={Boolean(savingKey)}
                                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                                  >
                                    <Play size={14} fill="currentColor" /> {concluindo ? 'Salvando...' : 'Finalizar Sessão'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-3 pt-1">
                                {editExercicios.map((ex, index) => (
                                  <div key={ex.id} className="flex flex-col gap-2.5 bg-black/40 p-3.5 rounded-xl border border-white/10">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        aria-label="Nome do exercício"
                                        value={ex.nome}
                                        onChange={(e) => updateEditExercicio(index, 'nome', e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2.5 text-base sm:text-sm text-white font-semibold"
                                      />
                                      <button
                                        type="button"
                                        aria-label="Remover exercício"
                                        onClick={() => setEditExercicios((prev) => prev.filter((_, idx) => idx !== index))}
                                        className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <input type="text" aria-label="Séries" value={ex.series} onChange={(e) => updateEditExercicio(index, 'series', e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-base sm:text-xs text-center text-slate-300 font-mono" />
                                      <input type="text" aria-label="Repetições" value={ex.reps} onChange={(e) => updateEditExercicio(index, 'reps', e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-base sm:text-xs text-center text-slate-300 font-mono" />
                                      <input type="text" aria-label="Carga" value={ex.carga} onChange={(e) => updateEditExercicio(index, 'carga', e.target.value)} className="w-full bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-2 text-base sm:text-xs text-center text-cyan-300 font-mono font-bold" />
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setEditExercicios((prev) => [...prev, { id: uid(), nome: '', series: '3x', reps: '10-12', carga: '10kg' }])}
                                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                                >
                                  <Plus size={15} /> Adicionar Exercício
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MEDIDAS RÁPIDAS */}
              <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
                <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-4">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <UserCircle size={18} className="text-emerald-400" /> Biometria & Medidas
                  </h2>
                  <span className="text-[10px] text-slate-400 font-medium">Enter para salvar</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {MEDIDAS.map((medida) => {
                    const isPeso = medida.nome === 'Peso';
                    const valorDigitado = valoresMedidas[medida.nome] ?? '';
                    const historico = historicoPorMedida[medida.nome] || [];
                    const ultimaGravada = historico[0];
                    const penultimaGravada = historico[1];
                    const delta = ultimaGravada && penultimaGravada
                      ? (Number(ultimaGravada.value) - Number(penultimaGravada.value)).toFixed(1)
                      : null;
                    const salvando = savingKey === `medida-${medida.nome}`;

                    return (
                      <div key={medida.nome} className={`bg-black/30 border border-white/5 p-3.5 rounded-2xl flex flex-col justify-between transition-all hover:border-white/15 ${isPeso ? 'col-span-2' : ''}`}>
                        <div className="flex items-center justify-between mb-2.5 gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedMetricChart(medida.nome)}
                            title="Ver no gráfico"
                            className={`text-[10px] sm:text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5 text-left hover:text-cyan-300 ${selectedMetricChart === medida.nome ? 'text-cyan-300' : 'text-slate-200'}`}
                          >
                            {isPeso ? <Scale size={13} className="text-emerald-400 shrink-0" /> : <Ruler size={13} className="text-cyan-400 shrink-0" />}
                            <span className="truncate">{medida.nome}</span>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {ultimaGravada && (
                              <span className="text-[10px] text-slate-300 font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded">
                                {ultimaGravada.value}{ultimaGravada.unit || medida.unidade}
                              </span>
                            )}
                            {delta !== null && Number(delta) !== 0 && (
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${Number(delta) > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                {Number(delta) > 0 ? `+${delta}` : delta}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            aria-label={`${medida.nome} (${medida.unidade})`}
                            value={valorDigitado}
                            onChange={(e) => handleMedidaChange(medida.nome, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveMedida(medida); } }}
                            placeholder={ultimaGravada ? `Atual: ${ultimaGravada.value}` : '00.0'}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-base sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 font-mono text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveMedida(medida)}
                            disabled={!valorDigitado || salvando}
                            aria-label={`Salvar ${medida.nome}`}
                            className={`px-3.5 rounded-xl flex items-center justify-center transition-all ${valorDigitado && !salvando ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
                          >
                            <Check size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ================= COLUNA DIREITA ================= */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {activeTab === 'mental' ? (
            <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col gap-4">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Brain size={18} className="text-purple-400" /> Correlação: Horas de Sono vs. Humor Diário
                </h2>
                <p className="text-[11px] text-slate-400">Impacto da recuperação noturna na sua energia e foco</p>
              </div>

              <div className="h-56 sm:h-64 w-full">
                {mentalChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs sm:text-sm border border-dashed border-white/10 rounded-2xl text-center px-4">
                    Registre seu sono ou humor ao lado para gerar o gráfico de correlação.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mentalChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="data" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" domain={[0, 12]} stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} unit="h" />
                      <YAxis yAxisId="right" orientation="right" domain={[1, 5]} stroke="#c084fc" fontSize={10} tickLine={false} axisLine={false} unit="/5" />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff1a', borderRadius: '12px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                      <Bar yAxisId="left" name="Sono (Horas)" dataKey="Sono" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={24} />
                      <Line yAxisId="right" name="Humor (1 a 5)" type="monotone" dataKey="Humor" stroke="#e879f9" strokeWidth={3} connectNulls dot={{ r: 4, fill: '#e879f9' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp size={18} className="text-cyan-400" /> Curva de Evolução: <span className="text-cyan-300">{selectedMetricChart}</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">Últimos 12 registros da métrica selecionada</p>
                </div>

                <select
                  aria-label="Métrica do gráfico"
                  value={selectedMetricChart}
                  onChange={(e) => setSelectedMetricChart(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-base sm:text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {MEDIDAS.map((m) => (
                    <option key={m.nome} value={m.nome} className="bg-slate-900">{m.nome}</option>
                  ))}
                </select>
              </div>

              <div className="h-48 sm:h-56 w-full">
                {chartEvolutionData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs sm:text-sm border border-dashed border-white/10 rounded-2xl text-center px-4">
                    Sem registros históricos para "{selectedMetricChart}".
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="data" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={['auto', 'auto']} stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff1a', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(val, name, props) => [`${val} ${props.payload.unidade}`, selectedMetricChart]}
                      />
                      <Area type="monotone" dataKey="valor" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMetric)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* HISTÓRICO */}
          <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-7 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col min-h-[500px] max-h-[780px]">

            <div className="flex flex-col gap-3.5 mb-5 border-b border-white/10 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-400" /> Histórico de Registros
                </h2>

                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                  {FILTROS_HISTORICO.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActiveFilter(f.id)}
                      aria-pressed={activeFilter === f.id}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeFilter === f.id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-black/30 text-slate-400 hover:text-slate-200 border border-white/5'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  aria-label="Buscar no histórico"
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  placeholder="Buscar por treino, qualidade do sono, humor ou medida..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-base sm:text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-500"
                />
                {searchHistory && (
                  <button type="button" onClick={() => setSearchHistory('')} aria-label="Limpar busca" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 sm:pr-2">
              {filteredLogs.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <div className="p-4 bg-black/20 rounded-full border border-white/5">
                    <Calendar size={32} className="opacity-40" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium">Nenhum registro encontrado para este filtro.</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const style = TAG_CONFIG[log.type] || TAG_CONFIG.treino;
                  const Icon = style.icon;
                  const confirmLogKey = `log-${log.id}`;
                  const isConfirming = confirmDeleteId === confirmLogKey;

                  const titulo = log.title || '';
                  const hasDetails = titulo.includes(': ');
                  const mainTitle = hasDetails ? titulo.split(': ')[0] : titulo;
                  const details = hasDetails ? titulo.substring(titulo.indexOf(': ') + 2) : '';

                  return (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/30 border border-white/10 rounded-2xl hover:border-white/20 hover:bg-white/5 transition-all gap-3">

                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        <span className={`flex items-center justify-center w-11 h-11 rounded-xl border shrink-0 ${style.bg} ${style.border} ${style.text}`}>
                          <Icon size={20} />
                        </span>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h4 className="text-white text-sm font-bold leading-snug truncate">{mainTitle}</h4>
                          {details && (
                            <p className="text-slate-400 text-[11px] mt-1 line-clamp-2 leading-relaxed">{details}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                              <Calendar size={10} /> {formatDateToBR(log.created_at || log.date)}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                              {log.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-3 sm:pt-0 border-t border-white/5 sm:border-0 shrink-0">
                        {log.value != null && (
                          <div className={`font-mono text-xs sm:text-sm font-bold px-3 py-1.5 rounded-xl border flex items-baseline gap-1 ${style.bg} ${style.text} ${style.border}`}>
                            {log.value} {log.unit && <span className="text-[10px] uppercase font-semibold opacity-80">{log.unit}</span>}
                          </div>
                        )}

                        <DeleteButton
                          confirming={isConfirming}
                          onClick={() => triggerSafeDelete(confirmLogKey, () => deleteHealthLog(log.id), 'Não foi possível excluir o registro.')}
                          title="Excluir registro"
                          className="p-2 text-xs"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
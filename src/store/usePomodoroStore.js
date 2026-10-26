import { create } from 'zustand';

// Gerador de alerta sonoro suave via Web Audio API (Zero arquivos externos)
const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // Acorde Dó Maior (C5, E5, G5, C6)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.45);
    });
  } catch (e) {
    console.warn('Áudio bloqueado pelo navegador:', e);
  }
};

export const usePomodoroStore = create((set, get) => ({
  pomodoroMode: 'foco', // 'foco' | 'pausa_curta' | 'pausa_longa'
  focusTime: 25 * 60,
  shortBreakTime: 5 * 60,
  longBreakTime: 15 * 60,

  timeLeft: 25 * 60,
  isRunning: false,
  targetEndTime: null, // Timestamp exato para não atrasar em background
  completedCycles: 0,
  soundEnabled: true,

  // Controle da pílula flutuante e Toast
  isFloatingPinned: false,
  toast: { show: false, message: '' },

  showToast: (message) => {
    set({ toast: { show: true, message } });
    setTimeout(() => {
      set({ toast: { show: false, message: '' } });
    }, 4500);
  },

  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  setFloatingPinned: (val) => set({ isFloatingPinned: val }),

  // Iniciar ou Pausar preservando o segundo exato onde parou!
  toggleRunning: () => {
    const { isRunning, timeLeft } = get();
    if (isRunning) {
      set({ isRunning: false, targetEndTime: null });
    } else {
      const nextTime = timeLeft > 0 ? timeLeft : get().getCurrentModeDuration();
      set({
        isRunning: true,
        timeLeft: nextTime,
        targetEndTime: Date.now() + nextTime * 1000
      });
    }
  },

  getCurrentModeDuration: () => {
    const { pomodoroMode, focusTime, shortBreakTime, longBreakTime } = get();
    if (pomodoroMode === 'foco') return focusTime;
    if (pomodoroMode === 'pausa_curta') return shortBreakTime;
    return longBreakTime;
  },

  switchMode: (mode) => {
    const { focusTime, shortBreakTime, longBreakTime } = get();
    const nextDuration =
      mode === 'foco' ? focusTime : mode === 'pausa_curta' ? shortBreakTime : longBreakTime;

    set({
      pomodoroMode: mode,
      isRunning: false,
      targetEndTime: null,
      timeLeft: nextDuration
    });
  },

  resetTimer: () => {
    const duration = get().getCurrentModeDuration();
    set({
      isRunning: false,
      targetEndTime: null,
      timeLeft: duration
    });
  },

  setCustomDuration: (totalSeconds) => {
    const safeSecs = Math.max(60, totalSeconds);
    const { pomodoroMode } = get();
    const updates = {
      timeLeft: safeSecs,
      isRunning: false,
      targetEndTime: null
    };

    if (pomodoroMode === 'foco') updates.focusTime = safeSecs;
    else if (pomodoroMode === 'pausa_curta') updates.shortBreakTime = safeSecs;
    else updates.longBreakTime = safeSecs;

    set(updates);
  },

  // Chamado a cada segundo pelo controlador global
  tick: () => {
    const { isRunning, targetEndTime, pomodoroMode, completedCycles, soundEnabled, showToast } = get();
    if (!isRunning || !targetEndTime) return;

    const remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));

    if (remaining > 0) {
      set({ timeLeft: remaining });
    } else {
      // Tempo Esgotado!
      if (soundEnabled) playNotificationSound();

      if (pomodoroMode === 'foco') {
        const nextCycles = completedCycles + 1;
        const nextMode = nextCycles % 4 === 0 ? 'pausa_longa' : 'pausa_curta';
        const nextDuration = nextMode === 'pausa_longa' ? get().longBreakTime : get().shortBreakTime;

        set({
          isRunning: false,
          targetEndTime: null,
          completedCycles: nextCycles,
          pomodoroMode: nextMode,
          timeLeft: nextDuration
        });

        showToast(
          nextMode === 'pausa_longa'
            ? `Ciclo #${nextCycles} concluído! Hora de uma Pausa Longa.`
            : `Foco #${nextCycles} concluído! Hora de uma Pausa Curta.`
        );
      } else {
        set({
          isRunning: false,
          targetEndTime: null,
          pomodoroMode: 'foco',
          timeLeft: get().focusTime
        });
        showToast('Pausa finalizada! Pronto para voltar ao foco?');
      }
    }
  }
}));
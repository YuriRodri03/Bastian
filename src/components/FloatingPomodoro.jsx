import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { formatPomodoroTime } from './PomodoroWidget';
import { 
  Play, Pause, RotateCcw, Bell, X, Maximize2, Minimize2, Flame 
} from 'lucide-react';

export default function FloatingPomodoro() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    pomodoroMode,
    timeLeft,
    isRunning,
    completedCycles,
    isFloatingPinned,
    toast,
    tick,
    toggleRunning,
    resetTimer,
    switchMode,
    setFloatingPinned,
    getCurrentModeDuration
  } = usePomodoroStore();

  // 1. Motor Global de Tick (Roda em qualquer página do sistema)
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  // 2. Atualiza o título da aba do navegador em tempo real
  useEffect(() => {
    if (isRunning) {
      const label = pomodoroMode === 'foco' ? '🎯 Foco' : '☕ Pausa';
      document.title = `(${formatPomodoroTime(timeLeft)}) ${label} • Bastian`;
    } else {
      document.title = 'Bastian';
    }
  }, [isRunning, timeLeft, pomodoroMode]);

  const totalDuration = getCurrentModeDuration();
  const isTimerModifiedOrActive = isRunning || timeLeft < totalDuration;
  const isOnDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  // Mostra a pílula flutuante se:
  // - O usuário não está no Dashboard E o timer está rodando/pausado no meio
  // - OU o usuário clicou no ícone de fixar (PictureInPicture)
  const shouldShowFloating = (!isOnDashboard && isTimerModifiedOrActive) || isFloatingPinned;

  return (
    <>
      {/* TOAST GLOBAL DO POMODORO (Aparece em qualquer página quando o tempo acaba) */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[120] flex items-center gap-3 px-5 py-3.5 rounded-2xl border bg-slate-900/95 border-indigo-500/40 text-indigo-200 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <Bell size={18} className="text-indigo-400 animate-bounce shrink-0" />
          <span className="text-xs sm:text-sm font-bold tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* MINI-PLAYER FLUTUANTE */}
      {shouldShowFloating && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-[110] animate-in fade-in slide-in-from-bottom-4 duration-200">
          {!isExpanded ? (
            /* MODO PÍLULA COMPACTA (Dynamic Island Style) */
            <div className="flex items-center gap-2.5 bg-slate-900/95 border border-white/15 px-3.5 py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <span 
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`} 
              />
              
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="font-mono text-sm font-bold text-white hover:text-indigo-300 transition-colors tracking-wider"
                title="Expandir controles"
              >
                {formatPomodoroTime(timeLeft)}
              </button>

              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                {pomodoroMode === 'foco' ? 'Foco' : 'Pausa'}
              </span>

              <div className="h-3.5 w-px bg-white/10 mx-0.5" />

              <button
                type="button"
                onClick={toggleRunning}
                className={`p-1.5 rounded-full transition-colors ${
                  isRunning 
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
                title={isRunning ? "Pausar" : "Continuar"}
              >
                {isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Expandir"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          ) : (
            /* MODO CARD FLUTUANTE EXPANDIDO */
            <div className="w-64 bg-slate-900/95 border border-white/15 p-4 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame size={13} className="text-amber-400" />
                  {pomodoroMode === 'foco' ? 'Modo Foco' : 'Modo Pausa'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                    title="Minimizar para pílula"
                  >
                    <Minimize2 size={14} />
                  </button>
                  {isFloatingPinned && (
                    <button
                      type="button"
                      onClick={() => setFloatingPinned(false)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10"
                      title="Desafixar"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                {[
                  { id: 'foco', label: 'Foco' },
                  { id: 'pausa_curta', label: 'Curta' },
                  { id: 'pausa_longa', label: 'Longa' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => switchMode(m.id)}
                    className={`py-1 rounded-lg text-[10px] font-bold transition-all ${
                      pomodoroMode === m.id 
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="text-center font-mono text-3xl font-bold text-white tracking-wider py-1">
                {formatPomodoroTime(timeLeft)}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleRunning}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isRunning 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isRunning ? <><Pause size={13} /> Pausar</> : <><Play size={13} fill="currentColor" /> Iniciar</>}
                </button>
                <button
                  type="button"
                  onClick={resetTimer}
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl"
                  title="Reiniciar"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
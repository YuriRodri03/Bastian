import React, { useState } from 'react';
import { usePomodoroStore } from '../store/usePomodoroStore';
import { 
  Timer, Play, Pause, RotateCcw, Volume2, VolumeX, 
  PictureInPicture2, Flame 
} from 'lucide-react';

export const formatPomodoroTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function PomodoroWidget() {
  const {
    pomodoroMode,
    timeLeft,
    isRunning,
    completedCycles,
    soundEnabled,
    isFloatingPinned,
    toggleRunning,
    switchMode,
    resetTimer,
    setCustomDuration,
    toggleSound,
    setFloatingPinned,
    getCurrentModeDuration
  } = usePomodoroStore();

  // Estados locais apenas para a edição inline dos dígitos
  const [isEditing, setIsEditing] = useState(false);
  const [editMins, setEditMins] = useState('25');
  const [editSecs, setEditSecs] = useState('00');

  const totalDuration = getCurrentModeDuration();
  const progressPercent = totalDuration > 0 
    ? Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100)) 
    : 0;

  const handleTimeClick = () => {
    if (isRunning) toggleRunning(); // Pausa se estiver rodando
    setEditMins(String(Math.floor(timeLeft / 60)).padStart(2, '0'));
    setEditSecs(String(timeLeft % 60).padStart(2, '0'));
    setIsEditing(true);
  };

  const saveEditedTime = () => {
    const m = parseInt(editMins, 10) || 0;
    const s = parseInt(editSecs, 10) || 0;
    setCustomDuration(m * 60 + s);
    setIsEditing(false);
  };

  const modeColors = {
    foco: {
      badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      bar: 'from-indigo-500 to-purple-500',
      button: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
    },
    pausa_curta: {
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      bar: 'from-emerald-500 to-teal-400',
      button: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25'
    },
    pausa_longa: {
      badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      bar: 'from-cyan-500 to-blue-500',
      button: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-500/25'
    }
  }[pomodoroMode];

  return (
    <div className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-5 sm:p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col items-center relative overflow-hidden">
      
      {/* Barra de Progresso Superior Sutil */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
        <div 
          className={`h-full bg-gradient-to-r ${modeColors.bar} transition-all duration-500`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Cabeçalho com Contador de Ciclos e Controles de Áudio / Mini-Player */}
      <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Timer size={17} className="text-indigo-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">Timer Pomodoro</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <span 
            title="Ciclos de foco concluídos hoje"
            className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg mr-1"
          >
            <Flame size={12} className="text-amber-400" /> {completedCycles}
          </span>

          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Som ativado" : "Som silenciado"}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-colors"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} className="text-rose-400" />}
          </button>

          <button
            type="button"
            onClick={() => setFloatingPinned(!isFloatingPinned)}
            title="Fixar Mini-Player flutuante em todas as telas"
            className={`p-1.5 rounded-lg border transition-colors ${
              isFloatingPinned 
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/5'
            }`}
          >
            <PictureInPicture2 size={14} />
          </button>
        </div>
      </div>

      {/* Seletor de Modos */}
      <div className="grid grid-cols-3 gap-1.5 w-full mb-5 bg-black/40 p-1 rounded-xl border border-white/10">
        {[
          { id: 'foco', label: 'Foco' },
          { id: 'pausa_curta', label: 'Pausa Curta' },
          { id: 'pausa_longa', label: 'Pausa Longa' }
        ].map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setIsEditing(false);
              switchMode(m.id);
            }}
            className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              pomodoroMode === m.id 
                ? `${modeColors.badge} border shadow-sm` 
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Visor do Relógio (Clicável para Editar) */}
      <div className="h-[74px] flex items-center justify-center mb-5 w-full">
        {isEditing ? (
          <div 
            className="flex items-center justify-center gap-1.5 animate-in fade-in zoom-in duration-150"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                saveEditedTime();
              }
            }}
          >
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={editMins}
              onChange={(e) => setEditMins(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && saveEditedTime()}
              className="w-16 h-16 bg-black/50 border border-indigo-500/50 rounded-2xl text-3xl sm:text-4xl font-bold font-mono text-center text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="25"
            />
            <span className="text-3xl font-bold text-indigo-500/50 pb-1">:</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={editSecs}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (parseInt(val, 10) > 59) val = '59';
                setEditSecs(val);
              }}
              onKeyDown={(e) => e.key === 'Enter' && saveEditedTime()}
              className="w-16 h-16 bg-black/50 border border-indigo-500/50 rounded-2xl text-3xl sm:text-4xl font-bold font-mono text-center text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="00"
            />
          </div>
        ) : (
          <div 
            onClick={handleTimeClick}
            title="Clique nos números para editar o tempo"
            className="text-5xl sm:text-[3.5rem] font-bold font-mono text-white tracking-wider cursor-pointer hover:text-indigo-300 transition-all hover:scale-105 select-none"
          >
            {formatPomodoroTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-3 w-full">
        <button
          type="button"
          onClick={() => {
            if (isEditing) saveEditedTime();
            toggleRunning();
          }}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
            isRunning 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
              : `${modeColors.button} text-white`
          }`}
        >
          {isRunning ? <><Pause size={15} /> Pausar</> : <><Play size={15} fill="currentColor" /> {timeLeft < totalDuration ? 'Continuar' : 'Iniciar'}</>}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            resetTimer();
          }}
          title="Reiniciar cronômetro"
          className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl transition-all"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
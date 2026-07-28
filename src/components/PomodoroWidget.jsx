import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, Bell } from 'lucide-react'; // NOVO: Ícone Bell adicionado

export default function PomodoroWidget() {
  const [pomodoroMode, setPomodoroMode] = useState('foco'); 
  // Agora armazenamos a base em Segundos para precisão total
  const [focusTime, setFocusTime] = useState(25 * 60);
  const [shortBreakTime, setShortBreakTime] = useState(5 * 60);
  const [longBreakTime, setLongBreakTime] = useState(15 * 60);
  
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  // Estados da edição inline (Minutos e Segundos separados)
  const [isEditing, setIsEditing] = useState(false);
  const [editMins, setEditMins] = useState('25');
  const [editSecs, setEditSecs] = useState('00');

  // NOVO: Estado para a notificação flutuante (Toast)
  const [toast, setToast] = useState({ show: false, message: '' });

  // NOVO: Função para exibir a notificação
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 4000); // 4 segundos para dar tempo de ler tranquilamente
  };

  useEffect(() => {
    if (!isRunning && !isEditing) {
      if (pomodoroMode === 'foco') setTimeLeft(focusTime);
      else if (pomodoroMode === 'pausa_curta') setTimeLeft(shortBreakTime);
      else if (pomodoroMode === 'pausa_longa') setTimeLeft(longBreakTime);
    }
  }, [pomodoroMode, focusTime, shortBreakTime, longBreakTime, isRunning, isEditing]);

  useEffect(() => {
    let timer = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      // SUBSTITUÍDO: Alert nativo pela nossa notificação
      showToast('Tempo esgotado! Bom trabalho.'); 
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const switchPomodoroMode = (mode) => {
    setIsEditing(false);
    setPomodoroMode(mode);
    setIsRunning(false);
    if (mode === 'foco') setTimeLeft(focusTime);
    else if (mode === 'pausa_curta') setTimeLeft(shortBreakTime);
    else if (mode === 'pausa_longa') setTimeLeft(longBreakTime);
  };

  const handleReset = () => {
    setIsEditing(false);
    setIsRunning(false);
    if (pomodoroMode === 'foco') setTimeLeft(focusTime);
    else if (pomodoroMode === 'pausa_curta') setTimeLeft(shortBreakTime);
    else if (pomodoroMode === 'pausa_longa') setTimeLeft(longBreakTime);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Lógica de Edição Inline Avançada ---
  const handleTimeClick = () => {
    setIsRunning(false);
    setEditMins(String(Math.floor(timeLeft / 60)).padStart(2, '0'));
    setEditSecs(String(timeLeft % 60).padStart(2, '0'));
    setIsEditing(true);
  };

  const saveEditedTime = () => {
    let m = parseInt(editMins, 10) || 0;
    let s = parseInt(editSecs, 10) || 0;
    let totalSecs = (m * 60) + s;
    
    // Trava de segurança para não deixar o relógio zerado
    if (totalSecs <= 0) totalSecs = 60;

    if (pomodoroMode === 'foco') setFocusTime(totalSecs);
    else if (pomodoroMode === 'pausa_curta') setShortBreakTime(totalSecs);
    else if (pomodoroMode === 'pausa_longa') setLongBreakTime(totalSecs);

    setTimeLeft(totalSecs);
    setIsEditing(false);
  };

  return (
    <>
      {/* NOVO: Toast Flutuante do Pomodoro */}
      {toast.show && (
        <div className="fixed top-8 right-8 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl border bg-indigo-500/10 border-indigo-500/20 text-indigo-300 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          <Bell size={20} className="animate-bounce" />
          <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex flex-col items-center">
        
        {/* Cabeçalho Limpo */}
        <div className="w-full flex items-center justify-center mb-4 pb-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Timer size={16} className="text-indigo-400" /> Pomodoro
          </h2>
        </div>

        {/* Botões de Modo */}
        <div className="grid grid-cols-3 gap-1.5 w-full mb-6 bg-black/30 p-1 rounded-xl border border-white/5">
          {[
            { id: 'foco', label: 'Foco' },
            { id: 'pausa_curta', label: 'Pausa C.' },
            { id: 'pausa_longa', label: 'Pausa L.' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => switchPomodoroMode(m.id)}
              className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                pomodoroMode === m.id 
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Visor do Relógio */}
        <div className="h-[70px] flex items-center justify-center mb-6 w-full">
          {isEditing ? (
            <div 
              className="flex items-center justify-center gap-1.5 animate-in fade-in zoom-in duration-200"
              // Salva automaticamente se o usuário clicar fora desta área
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  saveEditedTime();
                }
              }}
            >
              {/* Input Minutos */}
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={editMins}
                onChange={(e) => setEditMins(e.target.value.replace(/\D/g, ''))} // Só aceita números
                onKeyDown={(e) => e.key === 'Enter' && saveEditedTime()}
                className="w-16 h-16 bg-black/40 border border-indigo-500/50 rounded-2xl text-4xl font-bold font-mono text-center text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-black/60 transition-all placeholder-indigo-500/30"
                placeholder="00"
              />
              
              <span className="text-3xl font-bold text-indigo-500/50 pb-2">:</span>
              
              {/* Input Segundos */}
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={editSecs}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (parseInt(val) > 59) val = '59'; // Impede colocar tipo 80 segundos
                  setEditSecs(val);
                }}
                onKeyDown={(e) => e.key === 'Enter' && saveEditedTime()}
                className="w-16 h-16 bg-black/40 border border-indigo-500/50 rounded-2xl text-4xl font-bold font-mono text-center text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-black/60 transition-all placeholder-indigo-500/30"
                placeholder="00"
              />
            </div>
          ) : (
            <div 
              onClick={handleTimeClick}
              title="Clique para editar o tempo"
              className="text-[3.25rem] font-bold font-mono text-slate-100 tracking-wider cursor-pointer hover:text-indigo-300 transition-colors hover:scale-105 transform duration-200"
            >
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={() => {
              if(isEditing) saveEditedTime();
              setIsRunning(!isRunning);
            }}
            className={`flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg ${
              isRunning 
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
            }`}
          >
            {isRunning ? <><Pause size={14} /> Pausar</> : <><Play size={14} fill="currentColor" /> Iniciar</>}
          </button>
          <button
            onClick={handleReset}
            title="Reiniciar tempo"
            className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 rounded-xl transition-all"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
import React, { useState, useEffect } from 'react';
// NOVO: Adicionados BellRing e BellOff aos ícones
import { Target, Dumbbell, Command, User, LogOut, Wallet, LayoutDashboard, Bot, Bell, BellRing, BellOff } from 'lucide-react'; 
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { ativarNotificacoes } from '../utils/pushSetup';

export default function Navbar() {
  const location = useLocation(); 
  const { user, signOut } = useAuthStore();
  
  // NOVO: Estado para rastrear a permissão atual
  const [pushStatus, setPushStatus] = useState('default');

  // NOVO: Verifica o status atual ao carregar a página
  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  // ATUALIZADO: Função mais inteligente para lidar com o clique
  const handleAtivarPush = async () => {
    if (!user) return;
    
    if (pushStatus === 'granted') {
      toast('Os protocolos de notificação já estão ativos, senhor.', {
        icon: '✅',
        style: { background: '#064e3b', color: '#34d399', border: '1px solid #059669' }
      });
      return;
    }

    if (pushStatus === 'denied') {
      toast.error('O navegador bloqueou as notificações. O senhor precisa liberar no cadeado ao lado da URL.', {
        style: { background: '#4c0519', color: '#f43f5e', border: '1px solid #e11d48' }
      });
      return;
    }

    try {
      await ativarNotificacoes(user);
      
      // Atualiza o estado após o senhor clicar em "Permitir" ou "Bloquear" no navegador
      const novoStatus = Notification.permission;
      setPushStatus(novoStatus);

      if (novoStatus === 'granted') {
        toast.success('Protocolos de notificação do Bastian ativados!', {
          icon: '🔔',
          style: {
            background: '#083344', 
            color: '#22d3ee', 
            border: '1px solid #06b6d4',
          },
        });
      }
    } catch (error) {
      console.error("Erro ao ativar push:", error);
      toast.error('Houve uma falha de comunicação nos protocolos.');
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* 1. LOGO E MARCA */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
            <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
              <Command className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight hidden sm:block">
              Centro de Comando
            </span>
          </Link>

          {/* 2. NAVEGAÇÃO CENTRAL */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700/50 shadow-inner overflow-x-auto">
            
            <Link 
              to="/bastian"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === '/bastian'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Bot className="w-4 h-4 shrink-0" /> 
              <span className="hidden sm:inline">Bastian</span>
            </Link>

            <Link 
              to="/"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === '/' 
                  ? 'bg-slate-800 text-cyan-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" /> 
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Link 
              to="/financeiro"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === '/financeiro' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Wallet className="w-4 h-4 shrink-0" /> 
              <span className="hidden sm:inline">Financeiro</span>
            </Link>

            <Link 
              to="/agenda"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === '/agenda' 
                  ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Target className="w-4 h-4 shrink-0" /> 
              <span className="hidden sm:inline">Agenda</span>
            </Link>
            
            <Link 
              to="/treino"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === '/treino' || location.pathname === '/academia'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Dumbbell className="w-4 h-4 shrink-0" /> 
              <span className="hidden sm:inline">Treino</span>
            </Link>

          </div>

          {/* 3. MENU DO USUÁRIO */}
          <div className="flex items-center gap-3">
            
            {/* ATUALIZADO: Botão de Notificações Inteligente */}
            <button 
              onClick={handleAtivarPush}
              title={pushStatus === 'granted' ? 'Notificações Ativas' : 'Ativar Notificações do Bastian'}
              className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 border ${
                pushStatus === 'granted'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' // Visual Ativo
                  : pushStatus === 'denied'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' // Visual Bloqueado
                  : 'text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-950/50 border-transparent hover:border-cyan-800/50' // Visual Padrão
              }`}
            >
              {pushStatus === 'granted' ? (
                <BellRing className="w-5 h-5" />
              ) : pushStatus === 'denied' ? (
                <BellOff className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5 animate-pulse" />
              )}
            </button>

            <button className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-800">
              <User className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-slate-800"></div> {/* Divisor visual */}
            
            <button 
              onClick={() => signOut && signOut()} 
              title="Sair da conta"
              className="flex items-center justify-center p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
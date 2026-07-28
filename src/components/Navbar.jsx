import React from 'react';
import { Target, Dumbbell, Command, User, LogOut, Wallet, LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore'; // Para podermos fazer o logout

export default function Navbar() {
  const location = useLocation(); // Lê a rota atual (ex: '/agenda')
  const { signOut } = useAuthStore(); // Puxa a função de logout do seu store

  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* 1. LOGO E MARCA (Link para o Dashboard) */}
          <Link to="/" className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80">
            <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
              <Command className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight hidden sm:block">
              Centro de Comando
            </span>
          </Link>

          {/* 2. NAVEGAÇÃO CENTRAL (Usando rotas) */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700/50 shadow-inner">
            
            {/* Nova aba Dashboard */}
            <Link 
              to="/"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                location.pathname === '/' 
                  ? 'bg-slate-800 text-cyan-400 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> 
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
              <Wallet className="w-4 h-4" /> 
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
              <Target className="w-4 h-4" /> 
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
              <Dumbbell className="w-4 h-4" /> 
              <span className="hidden sm:inline">Treino</span>
            </Link>

          </div>

          {/* 3. MENU DO USUÁRIO */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-800">
              <User className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-slate-800"></div> {/* Divisor visual */}
            
            <button 
              onClick={() => signOut && signOut()} // Se tiver a função signOut, ele desloga
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
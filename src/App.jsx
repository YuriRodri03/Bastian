import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';

// imports das páginas
import Login from './pages/Login';
import Bastian from './pages/Bastian';
import Dashboard from './pages/Dashboard'; 
import Financeiro from './pages/Financeiro';
import Agenda from './pages/Agenda';
import Treino from './pages/Treino';
import Navbar from './components/Navbar';
import BarraComandoIA from './components/BarraComandoIA';

// =====================================================================
// REGISTRO DO SERVICE WORKER (Bastian Notifier)
// =====================================================================
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registrado com sucesso. Escopo:', registration.scope);
      })
      .catch((error) => {
        console.error('Falha ao registrar o Service Worker:', error);
      });
  });
}
// =====================================================================

function App() {
  const { user, initialize, isLoading } = useAuthStore();
  
  // NOVO: Estado para segurar a animação artificialmente
  const [showLoading, setShowLoading] = useState(true);

  // Verifica a sessão quando o app abre
  useEffect(() => {
    initialize();
  }, [initialize]);

  // NOVO: Controle de tempo mínimo da animação
  useEffect(() => {
    if (isLoading) {
      setShowLoading(true);
    } else {
      // Se já carregou os dados, espera mais 3 segundos (3000ms) antes de liberar a tela
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 3000); 
      
      return () => clearTimeout(timer); // Limpa o timer se o componente desmontar
    }
  }, [isLoading]);

  // Substitua o 'if (isLoading)' por 'if (showLoading)'
  if (showLoading) {
      return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-mono select-none">
        {/* Fundo de Grid Tecnológico (HUD) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d40a_1px,transparent_1px),linear-gradient(to_bottom,#06b6d40a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          {/* Sistema de Círculos Giratórios */}
          <div className="relative flex items-center justify-center w-64 h-64 mb-8">
            {/* Anel Externo Lento */}
            <div className="absolute inset-0 border-[1px] border-cyan-500/20 border-t-cyan-400 rounded-full animate-[spin_4s_linear_infinite]"></div>
            <div className="absolute inset-2 border-[1px] border-cyan-500/10 border-b-cyan-500 rounded-full animate-[spin_6s_linear_reverse_infinite]"></div>
            
            {/* Anel Intermediário (Tracejado) */}
            <div className="absolute inset-8 border-[2px] border-dashed border-cyan-400/40 rounded-full animate-[spin_8s_linear_infinite]"></div>
            
            {/* Anel Interno Rápido */}
            <div className="absolute inset-16 border-2 border-cyan-300/20 border-l-cyan-300 border-r-cyan-300 rounded-full animate-[spin_3s_linear_reverse_infinite]"></div>
            
            {/* Núcleo Central Brilhante */}
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-sm border border-cyan-400/30">
              <div className="w-4 h-4 bg-cyan-300 rounded-full animate-ping"></div>
              <div className="absolute w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>

          {/* Painel de Texto de Inicialização */}
          <div className="text-center flex flex-col items-center gap-3">
            <h1 className="text-cyan-400 text-2xl font-bold tracking-[0.4em] uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
              SISTEMA ONLINE
            </h1>
            
            <p className="text-cyan-500/70 text-xs tracking-widest uppercase animate-pulse">
              Inicializando rede neural e protocolos...
            </p>
            
            {/* Barras de progresso / Data lines */}
            <div className="flex gap-2 justify-center mt-4 opacity-70">
              <div className="w-12 h-1 bg-cyan-500/60 animate-pulse"></div>
              <div className="w-4 h-1 bg-cyan-500/60 animate-pulse delay-75"></div>
              <div className="w-8 h-1 bg-cyan-500/60 animate-pulse delay-150"></div>
              <div className="w-20 h-1 bg-cyan-500/60 animate-pulse delay-300"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se não tem usuário, trava na tela de Login
  if (!user) {
    return <Login />;
  }

  // Se tem usuário, libera o acesso e exibe a Navbar + Rotas
  return (
    <BrowserRouter>
      {/* Container de notificações globais */}
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: '#1e293b', 
            color: '#f8fafc', 
            border: '1px solid #334155', 
          }
        }} 
      />

      {/* A Navbar entra aqui para ficar fixa no topo em todas as rotas abaixo */}
      <Navbar />

      {/* Adicionado pb-24 aqui para o conteúdo não ficar escondido atrás da barra da IA */}
      <main className="bg-slate-950 min-h-screen text-slate-100 pb-24">
        <Routes>
          {/* Rota do Bastian */}
          <Route path="/bastian" element={<Bastian />} />

          {/* Rota principal com o Dashboard integrado */}
          <Route path="/" element={<Dashboard />} />
          
          {/* Rota oficial do módulo financeiro */}
          <Route path="/financeiro" element={<Financeiro />} />
          
          <Route path="/agenda" element={<Agenda />} />
          
          {/* Suporte a ambas as rotas de treino para evitar links quebrados */}
          <Route path="/treino" element={<Treino />} />
        </Routes>
      </main>

      {/* NOVO: A Barra da IA renderizada aqui para flutuar em todas as telas */}
      <BarraComandoIA />
      
    </BrowserRouter>
  );
}

export default App;
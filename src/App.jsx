import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Toaster } from 'react-hot-toast';

// IMPORTS DOS STORES ZUSTAND
import { useAuthStore } from './store/useAuthStore';
import { useAgendaStore } from './store/useAgendaStore'; 
import { useFinanceStore } from './store/useFinanceStore';
import { useInboxStore } from './store/useInboxStore';
import { useKanbanStore } from './store/useKanbanStore';
import { useFitnessStore } from './store/useFitnessStore';

// IMPORT DO SERVIÇO DE PUSH NOTIFICATION
import { registrarPushNoCelular } from './services/pushService';

// IMPORTS DAS PÁGINAS (A antiga página Bastian foi removida do núcleo)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; 
import Financeiro from './pages/Financeiro';
import Agenda from './pages/Agenda';
import Treino from './pages/Treino';
import Navbar from './components/Navbar';
import BarraComandoIA from './components/BarraComandoIA';

// =====================================================================
// 1. REGISTRO DO SERVICE WORKER (Bastian Notifier)
// =====================================================================
if ('serviceWorker' in navigator && 'PushManager' in window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Bastian Notifier (Service Worker) online. Escopo:', registration.scope);
      })
      .catch((error) => {
        console.error('Falha nos sistemas de notificação:', error);
      });
  });
}

// =====================================================================
// 2. FUNÇÃO GLOBAL DE DISPARO NATIVO
// =====================================================================
export const dispararNotificacaoBastian = (titulo, mensagem) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(titulo, {
        body: mensagem,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200], 
        requireInteraction: true 
      });
    }).catch(() => {
      new Notification(titulo, { body: mensagem });
    });
  }
};
// =====================================================================

function App() {
  const { user, initialize, isLoading } = useAuthStore();
  const { agendaItems, fetchAgendaItems } = useAgendaStore(); 
  
  // Pegamos as funções de carregamento dos outros stores
  const fetchTransactions = useFinanceStore(state => state.fetchTransactions);
  const fetchInboxTasks = useInboxStore(state => state.fetchInboxTasks);
  const fetchKanbanTasks = useKanbanStore(state => state.fetchKanbanTasks);
  const fetchHealthLogs = useFitnessStore(state => state.fetchHealthLogs);

  const [showLoading, setShowLoading] = useState(true);

  // MOTOR 1: INICIALIZAÇÃO DE AUTENTICAÇÃO
  useEffect(() => {
    initialize();
  }, [initialize]);

  // =====================================================================
  // MOTOR 2: CARREGAMENTO GLOBAL DE DADOS (Pré-Load) E REGISTRO PUSH
  // =====================================================================
  useEffect(() => {
    if (user) {
      if (fetchAgendaItems) fetchAgendaItems();
      if (fetchTransactions) fetchTransactions();
      if (fetchInboxTasks) fetchInboxTasks();
      if (fetchKanbanTasks) fetchKanbanTasks();
      if (fetchHealthLogs) fetchHealthLogs();
      
      // Registra o aparelho no banco de dados silenciosamente
      registrarPushNoCelular(); 
    }
  }, [user, fetchAgendaItems, fetchTransactions, fetchInboxTasks, fetchKanbanTasks, fetchHealthLogs]);

  // =====================================================================
  // MOTOR 3: NOTIFICAÇÕES E VIGIA DA AGENDA (Seguro contra Loops)
  // =====================================================================
  
  const agendaRef = useRef(agendaItems);
  useEffect(() => {
    agendaRef.current = agendaItems;
  }, [agendaItems]);

  useEffect(() => {
    if (!user) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          dispararNotificacaoBastian('Bastian Core', 'Sistemas de notificação ativados com sucesso, senhor.');
        }
      });
    }

    const vigiaInterval = setInterval(() => {
      if ('Notification' in window && Notification.permission !== 'granted') return;

      const agora = new Date();
      const offsetTempo = agora.getTimezoneOffset() * 60000;
      const dataLocal = new Date(agora.getTime() - offsetTempo);
      const dataHojeString = dataLocal.toISOString().split('T')[0];
      
      const horaAtual = agora.getHours();
      const minAtual = agora.getMinutes();

      const compromissos = agendaRef.current || [];

      compromissos.forEach(evento => {
        if (evento.date === dataHojeString && evento.time) {
          const [evtHora, evtMin] = evento.time.split(':').map(Number);
          
          const minutosEvento = (evtHora * 60) + evtMin;
          const minutosAgora = (horaAtual * 60) + minAtual;
          const diferenca = minutosEvento - minutosAgora;

          if (diferenca === 15) {
            dispararNotificacaoBastian(
              'Aviso de Compromisso', 
              `Senhor, "${evento.title}" iniciará em 15 minutos (${evento.time.substring(0,5)}).`
            );
          }
        }
      });
    }, 60000); 

    return () => clearInterval(vigiaInterval);
  }, [user]);
  // =====================================================================

  // Vigia de Autenticação do Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          useAuthStore.setState({ user: null });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          useAuthStore.setState({ user: session.user });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Controle de tempo mínimo da animação cibernética
  useEffect(() => {
    if (isLoading) {
      setShowLoading(true);
    } else {
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (showLoading) {
      return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden font-mono select-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d40a_1px,transparent_1px),linear-gradient(to_bottom,#06b6d40a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex items-center justify-center w-64 h-64 mb-8">
            <div className="absolute inset-0 border-[1px] border-cyan-500/20 border-t-cyan-400 rounded-full animate-[spin_4s_linear_infinite]"></div>
            <div className="absolute inset-2 border-[1px] border-cyan-500/10 border-b-cyan-500 rounded-full animate-[spin_6s_linear_reverse_infinite]"></div>
            <div className="absolute inset-8 border-[2px] border-dashed border-cyan-400/40 rounded-full animate-[spin_8s_linear_infinite]"></div>
            <div className="absolute inset-16 border-2 border-cyan-300/20 border-l-cyan-300 border-r-cyan-300 rounded-full animate-[spin_3s_linear_reverse_infinite]"></div>
            
            <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-sm border border-cyan-400/30">
              <div className="w-4 h-4 bg-cyan-300 rounded-full animate-ping"></div>
              <div className="absolute w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>

          <div className="text-center flex flex-col items-center gap-3">
            <h1 className="text-cyan-400 text-2xl font-bold tracking-[0.4em] uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
              SISTEMA ONLINE
            </h1>
            <p className="text-cyan-500/70 text-xs tracking-widest uppercase animate-pulse">
              Inicializando rede neural e protocolos...
            </p>
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

  // Trava na tela de Login
  if (!user) {
    return <Login />;
  }

  // Libera o acesso e exibe as rotas
  return (
    <BrowserRouter>
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

      <Navbar />

      <main className="bg-slate-950 min-h-screen text-slate-100 pb-24">
        <Routes>
          {/* Rota principal substituída pelo Dashboard */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/treino" element={<Treino />} />
        </Routes>
      </main>

      {/* A mente onipresente do Bastian */}
      <BarraComandoIA />
      
    </BrowserRouter>
  );
}

export default App;
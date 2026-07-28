import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Wallet, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react'; // Adicionei o CheckCircle2

export default function Login() {
  const { signIn, signUp } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // NOVO: Estado para sucesso

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(''); // Limpa mensagens anteriores
    setLoading(true);
    
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        // SUBSTITUIMOS O ALERT POR ISSO:
        setSuccess('Conta criada com sucesso! Faça login para continuar.');
        setIsLogin(true);
        setPassword(''); // É uma boa prática limpar a senha ao mudar para login
      }
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        
        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4">
            <Wallet size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isLogin ? 'Acessar Dashboard' : 'Criar Conta'}
          </h2>
          <p className="text-slate-400 text-sm mt-2 text-center">
            Gerencie suas finanças com segurança e privacidade.
          </p>
        </div>

        {/* Alerta de Erro */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        {/* NOVO: Alerta de Sucesso */}
        {success && (
          <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              isLogin ? 'Entrar' : 'Registrar'
            )}
          </button>
        </form>

        {/* Rodapé de Troca */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess(''); // Limpa o sucesso ao trocar de tela também
            }}
            className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
          >
            {isLogin ? 'Não tem uma conta? Registre-se' : 'Já tem uma conta? Faça login'}
          </button>
        </div>
        
      </div>
    </div>
  );
}
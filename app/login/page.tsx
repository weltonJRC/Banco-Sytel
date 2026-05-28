'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Lock, Mail, AlertCircle } from 'lucide-react';
import { signIn, getCurrentUser, cacheUserSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Se o usuário já tiver uma sessão válida, redireciona para o dashboard
    const user = getCurrentUser();
    if (user) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalEmail = email.trim();
      if (finalEmail.toLowerCase() === 'cetesb') {
        finalEmail = process.env.NEXT_PUBLIC_CETESB_LOGIN_EMAIL || 'cetesb@jrc.local';
      }
      const { user, error: loginError } = await signIn(finalEmail, password);
      
      if (loginError) {
        setError(loginError);
      } else if (user) {
        // Cacheia os dados do usuário no sessionStorage para uso visual
        cacheUserSession(user);
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 select-none">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        {/* Logo JRC/CETESB */}
        <div className="flex items-center justify-center p-3 bg-blue-600 rounded-2xl text-white shadow-md">
          <Layers className="w-10 h-10" />
        </div>
        
        <h2 className="mt-6 text-center text-2xl font-bold text-slate-800 tracking-tight">
          Portal CETESB
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
          Retenção Histórica de Operação
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg border border-slate-200 sm:px-10">
          
          {/* Alerta de erro */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Input E-mail */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600">
                Endereço de E-mail ou Usuário
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Cetesb ou seu e-mail"
                  className="block w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Input Senha */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-600">
                Senha de Acesso
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Botão Acessar */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Autenticando...' : 'Acessar o Portal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

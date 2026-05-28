'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { getCurrentUser } from '../lib/auth';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Valida se o usuário tem sessão ativa no localStorage
    const user = getCurrentUser();
    
    if (!user) {
      setIsAuthenticated(false);
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Enquanto valida a sessão, renderiza tela de loading
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Autenticando sessão...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Menu Lateral Fixo */}
      <Sidebar />

      {/* Container de Conteúdo */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Topo com Título Contextual */}
        <Header title={title} />

        {/* Conteúdo Dinâmico da Página */}
        <main className="flex-grow p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

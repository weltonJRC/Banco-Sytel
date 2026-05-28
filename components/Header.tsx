'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
      {/* Título e Navegação */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
      </div>

      {/* Ações Rápidas ou Status */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1 font-medium bg-slate-50 border border-slate-200 text-slate-500 rounded px-2.5 py-1">
          <RefreshCw className="w-3 h-3 text-slate-400" />
          Retenção: 2025 - 2026
        </span>
      </div>
    </header>
  );
}

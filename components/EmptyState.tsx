import React from 'react';
import { Search } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({ 
  title = 'Nenhum registro encontrado', 
  description = 'Não encontramos nenhum dado histórico com os filtros aplicados. Tente ajustar os parâmetros superiores de pesquisa.' 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-lg border border-slate-200">
      <div className="p-4 bg-slate-50 text-slate-400 border border-slate-100 rounded-full flex items-center justify-center">
        <Search className="w-8 h-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-500 max-w-md">
        {description}
      </p>
    </div>
  );
}

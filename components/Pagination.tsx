import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
}

export default function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  if (total === 0) return null;

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border border-slate-200 border-t-0 rounded-b-lg gap-4">
      {/* Informações da página */}
      <div className="text-sm text-slate-500">
        Exibindo <span className="font-medium text-slate-800">{startIdx}</span> a{' '}
        <span className="font-medium text-slate-800">{endIdx}</span> de{' '}
        <span className="font-medium text-slate-800">{total}</span> registros
      </div>

      {/* Controles de Linhas e Navegação */}
      <div className="flex items-center gap-6">
        {/* Seletor de Tamanho de Página */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Linhas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-xs bg-slate-50 border border-slate-300 text-slate-700 rounded p-1 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value={50}>50 linhas</option>
            <option value={100}>100 linhas</option>
            <option value={500}>500 linhas</option>
          </select>
        </div>

        {/* Botões de Navegação */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            title="Página Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-xs font-semibold text-slate-700">
            Página {page} de {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages || totalPages === 0}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            title="Próxima Página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

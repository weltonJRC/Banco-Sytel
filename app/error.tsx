'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Portal CETESB] Erro capturado pelo error boundary:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          Ocorreu um Erro Inesperado
        </h2>
        
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Houve um problema ao carregar esta página. Se o erro persistir, entre em contato com o suporte da JRC.
        </p>

        {error.message && (
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 mb-6 text-left text-slate-600 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar Novamente
        </button>
      </div>
    </div>
  );
}

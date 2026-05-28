import Link from 'next/link';
import { SearchX, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200">
          <SearchX className="w-7 h-7 text-slate-400" />
        </div>
        
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          Página Não Encontrada
        </h2>
        
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          A página que você está procurando não existe ou foi movida. Verifique o endereço ou volte ao painel principal.
        </p>
        
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}

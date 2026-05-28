'use client';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-200 rounded-full"></div>
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <p className="text-sm font-semibold text-slate-500 tracking-tight">
          Carregando Portal CETESB...
        </p>
      </div>
    </div>
  );
}

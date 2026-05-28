import React from 'react';
import { Search, RotateCcw, FileSpreadsheet, Download } from 'lucide-react';

interface FiltersBarProps {
  tipo_relatorio: 'ATENDIMENTO_OPERACAO' | 'URA';
  filters: {
    startDate: string;
    endDate: string;
    campanha: string;
    fila: string;
    usuario?: string;
    resultado: string;
    fonte: string;
    status: string;
  };
  options: {
    campanhas: string[];
    filas: string[];
    usuarios: string[];
    fontes: string[];
    statuses: string[];
  };
  onFilterChange: (key: string, value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
}

export default function FiltersBar({
  tipo_relatorio,
  filters,
  options,
  onFilterChange,
  onSearch,
  onClear,
  onExportCsv,
  onExportXlsx
}: FiltersBarProps) {
  const isUra = tipo_relatorio === 'URA';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
      {/* Grid de Inputs de Filtro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Data Inicial */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Data Inicial</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          />
        </div>

        {/* Data Final */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Data Final</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          />
        </div>

        {/* Campanha */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Campanha</label>
          <select
            value={filters.campanha}
            onChange={(e) => onFilterChange('campanha', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          >
            <option value="">Todas as Campanhas</option>
            {options.campanhas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Fila */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Fila</label>
          <select
            value={filters.fila}
            onChange={(e) => onFilterChange('fila', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          >
            <option value="">Todas as Filas</option>
            {options.filas.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Usuário (APENAS PARA ATENDIMENTO HUMANO) */}
        {!isUra && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Usuário/Agente</label>
            <input
              type="text"
              placeholder="Filtrar por agente..."
              value={filters.usuario || ''}
              onChange={(e) => onFilterChange('usuario', e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
            />
          </div>
        )}

        {/* Resultado */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Resultado</label>
          <input
            type="text"
            placeholder="Ex: Sucesso, Ouvidoria..."
            value={filters.resultado}
            onChange={(e) => onFilterChange('resultado', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          />
        </div>

        {/* Fonte */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Fonte Oficial</label>
          <select
            value={filters.fonte}
            onChange={(e) => onFilterChange('fonte', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          >
            <option value="">Todas as Fontes</option>
            <option value="EXCEL_2025">CETESB 2025 - URA/Atendimento</option>
            <option value="SYTEL_2026">CETESB 2026 - Atendimento</option>
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Status de Validação</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
          >
            <option value="">Todos os Status</option>
            <option value="VALIDADO">Validado</option>
            <option value="PENDENTE">Pendente</option>
            <option value="DIVERGENTE">Divergente</option>
            <option value="ERRO">Erro</option>
          </select>
        </div>
      </div>

      {/* Ações / Botões */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100">
        {/* Exportações */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onExportCsv}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition cursor-pointer"
            title="Exportar dados filtrados para formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            CSV
          </button>
          
          <button
            onClick={onExportXlsx}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition cursor-pointer"
            title="Exportar dados filtrados para planilha Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Planilha Excel (.xlsx)
          </button>
        </div>

        {/* Pesquisar / Limpar */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onClear}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Limpar Filtros
          </button>
          
          <button
            onClick={onSearch}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            Pesquisar
          </button>
        </div>
      </div>
    </div>
  );
}

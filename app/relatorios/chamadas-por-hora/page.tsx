'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { fetchChamadasPorHora, fetchFilterOptions } from '@/lib/dataProvider';
import { formatSeconds, formatDateTime } from '@/lib/formatters';
import { exportToCsv } from '@/lib/exportCsv';
import type { ChamadasPorHoraRow, ChamadasPorHoraGroup } from '@/lib/types';
import {
  Clock,
  Database,
  Layers,
  Search,
  RotateCcw,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  CheckCircle,
  XCircle,
  AlertOctagon
} from 'lucide-react';

/** Retorna a data de hoje no formato YYYY-MM-DD */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Formata uma data ISO para o padrão legível dd mmm, yyyy */
function formatPeriodDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Agrupa os dados retornados pela RPC por Data, Campanha e Fila,
 * e preenche as 24 horas (0-23) para cada grupo para gerar gráficos contínuos.
 */
function processAndGroupData(
  rawData: ChamadasPorHoraRow[],
  startDate: string,
  endDate: string
): ChamadasPorHoraGroup[] {
  const groupsMap = new Map<string, ChamadasPorHoraRow[]>();

  for (const row of rawData) {
    const dataStr = row.data.split('T')[0];
    const key = `${dataStr}|${row.campanha}|${row.fila}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(row);
  }

  const resultGroups: ChamadasPorHoraGroup[] = [];

  groupsMap.forEach((rows, key) => {
    const [dataStr, campanha, fila] = key.split('|');

    // Inicializa as 24 horas com valores zerados
    const fullHoursRows: ChamadasPorHoraRow[] = Array.from({ length: 24 }, (_, h) => ({
      data: dataStr,
      campanha,
      midia: 'Voice',
      fila,
      hora: h,
      total: 0,
      enfileiradas: 0,
      em_fila: 0,
      conectadas_agente: 0,
      abandonadas: 0,
      expiradas_na_fila: 0,
      derrubadas: 0
    }));

    // Preenche com os dados reais do banco
    for (const r of rows) {
      if (r.hora >= 0 && r.hora < 24) {
        fullHoursRows[r.hora] = {
          ...r,
          data: dataStr // normaliza data
        };
      }
    }

    // Calcula os totais agregados do grupo
    let totalChamadas = 0;
    let totalConectadas = 0;
    let totalAbandonadas = 0;
    let totalExpiradas = 0;
    let totalDerrubadas = 0;

    for (const r of rows) {
      totalChamadas += r.total;
      totalConectadas += r.conectadas_agente;
      totalAbandonadas += r.abandonadas;
      totalExpiradas += r.expiradas_na_fila;
      totalDerrubadas += r.derrubadas;
    }

    const startFormatted = formatPeriodDate(startDate);
    const endFormatted = formatPeriodDate(endDate);
    const periodo = startFormatted === endFormatted ? startFormatted : `${startFormatted} a ${endFormatted}`;

    resultGroups.push({
      data: dataStr,
      campanha,
      midia: 'Voice',
      fila,
      periodo,
      rows: fullHoursRows,
      totalChamadas,
      totalConectadas,
      totalAbandonadas,
      totalExpiradas,
      totalDerrubadas
    });
  });

  // Ordena por data decrescente, depois campanha e fila crescentes
  return resultGroups.sort((a, b) => {
    const dateComp = b.data.localeCompare(a.data);
    if (dateComp !== 0) return dateComp;
    const campComp = a.campanha.localeCompare(b.campanha, 'pt-BR');
    if (campComp !== 0) return campComp;
    return a.fila.localeCompare(b.fila, 'pt-BR');
  });
}

export default function ChamadasPorHoraPage() {
  const [filters, setFilters] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    campanha: '',
    fila: '',
    fonte: '',
    status: ''
  });

  const [filterOptions, setFilterOptions] = useState({
    campanhas: [] as string[],
    filas: [] as string[],
    usuarios: [] as string[],
    fontes: [] as string[],
    statuses: [] as string[]
  });

  const [grupos, setGrupos] = useState<ChamadasPorHoraGroup[]>([]);
  const [rawData, setRawData] = useState<ChamadasPorHoraRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Carrega opções de filtro no mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const opts = await fetchFilterOptions('ATENDIMENTO_OPERACAO');
        setFilterOptions(opts);
      } catch (err) {
        console.warn('[ChamadasPorHora] Erro ao carregar filtros:', err);
      }
    }
    loadOptions();
  }, []);

  const loadData = useCallback(async (activeFilters = filters) => {
    if (!activeFilters.startDate || !activeFilters.endDate) {
      setError('Informe o período (data inicial e data final) para consultar.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await fetchChamadasPorHora(activeFilters);
      setRawData(data);
      setGrupos(processAndGroupData(data, activeFilters.startDate, activeFilters.endDate));
    } catch (err: any) {
      console.error('[ChamadasPorHora] Erro na consulta:', err);
      setError('Não foi possível carregar o relatório. Tente novamente ou acione o suporte JRC.');
      setRawData([]);
      setGrupos([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => loadData(filters);

  const handleClear = () => {
    const cleared = {
      startDate: todayISO(),
      endDate: todayISO(),
      campanha: '',
      fila: '',
      fonte: '',
      status: ''
    };
    setFilters(cleared);
    setRawData([]);
    setGrupos([]);
    setError(null);
    setHasSearched(false);
  };

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Métricas agregadas rápidas
  const totalChamadas = rawData.reduce((acc, r) => acc + r.total, 0);
  const totalConectadas = rawData.reduce((acc, r) => acc + r.conectadas_agente, 0);
  const totalAbandonadas = rawData.reduce((acc, r) => acc + r.abandonadas, 0);
  const totalExpiradas = rawData.reduce((acc, r) => acc + r.expiradas_na_fila, 0);
  const totalDerrubadas = rawData.reduce((acc, r) => acc + r.derrubadas, 0);

  // Exportação de Dados
  const buildExportPayload = () => {
    const headers = [
      'Data',
      'Campanha',
      'Mídia',
      'Fila',
      'Hora',
      'Total',
      'Enfileiradas',
      'Em Fila',
      'Conectadas Agente',
      'Abandonadas',
      'Expiradas na Fila',
      'Derrubadas'
    ];

    // Exporta apenas as horas que possuem algum registro (Total > 0)
    const activeRows = rawData.filter(r => r.total > 0);

    const rows = activeRows.map(r => [
      formatDateTime(r.data).split(' ')[0], // Apenas a data
      r.campanha,
      r.midia,
      r.fila,
      `${r.hora.toString().padStart(2, '0')}:00`,
      r.total,
      r.enfileiradas,
      r.em_fila,
      r.conectadas_agente,
      r.abandonadas,
      r.expiradas_na_fila,
      r.derrubadas
    ]);

    return { headers, rows };
  };

  // Único método de exportação: CSV completo com campos protegidos
  const handleExportCsv = () => {
    const { headers, rows } = buildExportPayload();
    // Coluna 0 = Data — protegida com ="valor" para não virar formato de data do Excel
    exportToCsv(headers, rows, 'cetesb-chamadas-por-hora.csv', [0]);
  };

  return (
    <AppLayout title="Relatórios: Chamadas Por Hora">
      <div className="space-y-6">
        
        {/* Título */}
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase">
            Receptivo - Chamadas Por Hora
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Relatório de distribuição de chamadas recebidas, enfileiradas e conectadas agrupado por hora
          </p>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Recebidas"
            value={totalChamadas.toLocaleString('pt-BR')}
            icon={<Database className="w-5 h-5 text-blue-500" />}
            description="Volume total de chamadas"
          />
          <StatCard
            title="Conectadas Agente"
            value={totalConectadas.toLocaleString('pt-BR')}
            icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
            description="Atendidas por operadores"
          />
          <StatCard
            title="Abandonadas"
            value={totalAbandonadas.toLocaleString('pt-BR')}
            icon={<XCircle className="w-5 h-5 text-amber-500" />}
            description="Desconexões do cliente"
          />
          <StatCard
            title="Expiradas na Fila"
            value={totalExpiradas.toLocaleString('pt-BR')}
            icon={<Clock className="w-5 h-5 text-indigo-500" />}
            description="Estouros de tempo limite"
          />
          <StatCard
            title="Derrubadas"
            value={totalDerrubadas.toLocaleString('pt-BR')}
            icon={<AlertOctagon className="w-5 h-5 text-red-500" />}
            description="Falhas/queda de conexão"
          />
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Data Inicial */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Data Inicial</label>
              <input
                id="cph-filter-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              />
            </div>

            {/* Data Final */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Data Final</label>
              <input
                id="cph-filter-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              />
            </div>

            {/* Campanha */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Campanha</label>
              <select
                id="cph-filter-campanha"
                value={filters.campanha}
                onChange={(e) => handleFilterChange('campanha', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              >
                <option value="">Todas as Campanhas</option>
                {filterOptions.campanhas.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Fila */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Fila</label>
              <select
                id="cph-filter-fila"
                value={filters.fila}
                onChange={(e) => handleFilterChange('fila', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              >
                <option value="">Todas as Filas</option>
                {filterOptions.filas.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Fonte */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Fonte Oficial</label>
              <select
                id="cph-filter-fonte"
                value={filters.fonte}
                onChange={(e) => handleFilterChange('fonte', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              >
                <option value="">Todas as Fontes</option>
                <option value="EXCEL_2025">CETESB 2025 - URA/Atendimento</option>
                <option value="SYTEL_2026">CETESB 2026 - Atendimento</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Status Validação</label>
              <select
                id="cph-filter-status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
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

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100">
            {/* Exportações */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                id="cph-export-csv"
                onClick={handleExportCsv}
                disabled={grupos.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                title="Baixar CSV completo — todos os registros do filtro/período selecionado"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                Baixar CSV completo
              </button>
            </div>

            {/* Pesquisar / Limpar */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                id="cph-btn-clear"
                onClick={handleClear}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Limpar Filtros
              </button>
              <button
                id="cph-btn-search"
                onClick={handleSearch}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                Pesquisar
              </button>
            </div>
          </div>
        </div>

        {/* Área de Resultados */}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Calculando chamadas por hora...</p>
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-red-50 rounded-lg border border-red-200 shadow-sm">
            <div className="p-4 bg-red-100 text-red-500 border border-red-200 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-red-800">Erro na Consulta</h3>
            <p className="mt-2 text-sm text-red-600 max-w-md font-semibold">{error}</p>
          </div>
        )}

        {/* Sem Dados */}
        {!loading && !error && hasSearched && grupos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Clock className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">Nenhum registro encontrado para os filtros aplicados.</p>
            <p className="text-xs text-slate-400">Tente alterar as datas ou remover filtros específicos.</p>
          </div>
        )}

        {/* Estado Inicial */}
        {!loading && !error && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Clock className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">
              Selecione o período e clique em <span className="text-blue-600 font-bold">Pesquisar</span> para gerar o relatório de Chamadas Por Hora.
            </p>
          </div>
        )}

        {/* Renderização dos Blocos de Relatório */}
        {!loading && !error && grupos.length > 0 && (
          <div className="space-y-8" id="cph-report-area">
            {grupos.map((grupo) => {
              const groupKey = `${grupo.data}_${grupo.campanha}_${grupo.fila}`;
              const isCollapsed = collapsed.has(groupKey);

              // Calcula o valor máximo do grupo para escala do gráfico
              const maxVal = Math.max(...grupo.rows.map(r => r.total), 1);
              const stepY = maxVal / 4;

              // Dimensões do Gráfico SVG
              const width = 800;
              const height = 220;
              const paddingLeft = 40;
              const paddingRight = 20;
              const paddingTop = 20;
              const paddingBottom = 30;

              const chartWidth = width - paddingLeft - paddingRight;
              const chartHeight = height - paddingTop - paddingBottom;

              // Função auxiliar para mapear ponto (hora, valor) em coordenadas SVG (cx, cy)
              const getCoords = (hora: number, value: number) => {
                const cx = paddingLeft + (hora * (chartWidth / 23));
                const cy = height - paddingBottom - ((value / maxVal) * chartHeight);
                return { cx, cy };
              };

              // Gera paths para as 4 linhas
              const getLinePath = (field: 'total' | 'enfileiradas' | 'conectadas_agente' | 'derrubadas') => {
                return grupo.rows
                  .map((r, idx) => {
                    const { cx, cy } = getCoords(idx, r[field]);
                    return `${idx === 0 ? 'M' : 'L'} ${cx} ${cy}`;
                  })
                  .join(' ');
              };

              return (
                <div
                  key={groupKey}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                  id={`cph-block-${groupKey.replace(/[^a-zA-Z0-9]/g, '-')}`}
                >
                  
                  {/* Cabeçalho do Bloco (Estilo Sytel) */}
                  <div className="bg-slate-800 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-blue-400 shrink-0" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                          Campanha
                        </span>
                        <h2 className="text-sm font-bold leading-tight uppercase tracking-tight text-white">
                          {grupo.campanha}
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-300">
                      <span>
                        <span className="font-bold text-slate-400 mr-1">Fila:</span>
                        <span className="font-semibold">{grupo.fila}</span>
                      </span>
                      <span>
                        <span className="font-bold text-slate-400 mr-1">Mídia:</span>
                        {grupo.midia}
                      </span>
                      <span>
                        <span className="font-bold text-slate-400 mr-1">Período:</span>
                        <span className="font-semibold">{grupo.periodo}</span>
                      </span>
                      <button
                        onClick={() => toggleCollapse(groupKey)}
                        className="ml-2 p-1 rounded hover:bg-slate-700 transition text-slate-400 hover:text-white"
                        title={isCollapsed ? 'Expandir' : 'Recolher'}
                      >
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-6 space-y-6">
                      
                      {/* Título do Gráfico */}
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Distribuição das Chamadas por Hora do Dia
                        </h3>
                        {/* Legenda do Gráfico */}
                        <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                            Total
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                            Enfileiradas
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                            Conectadas
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                            Derrubadas
                          </span>
                        </div>
                      </div>

                      {/* Gráfico SVG Puro Responsivo */}
                      <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 relative">
                        <svg 
                          width="100%" 
                          height="230" 
                          viewBox={`0 0 ${width} ${height}`} 
                          preserveAspectRatio="none"
                          className="overflow-visible"
                        >
                          {/* Gridlines Horizontais */}
                          {Array.from({ length: 5 }).map((_, i) => {
                            const val = Math.round(i * stepY);
                            const { cy } = getCoords(0, val);
                            return (
                              <g key={i}>
                                <line 
                                  x1={paddingLeft} 
                                  y1={cy} 
                                  x2={width - paddingRight} 
                                  y2={cy} 
                                  stroke="#E2E8F0" 
                                  strokeWidth="1"
                                  strokeDasharray="4 4"
                                />
                                <text 
                                  x={paddingLeft - 8} 
                                  y={cy + 4} 
                                  fill="#94A3B8" 
                                  fontSize="9" 
                                  textAnchor="end"
                                  className="font-semibold select-none font-mono"
                                >
                                  {val}
                                </text>
                              </g>
                            );
                          })}

                          {/* Gridlines Verticais (Marcações de Horas 0, 6, 8, 10, 12, 14, 15, 16, 17, 18, 23 etc.) */}
                          {[0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 23].map((h) => {
                            const { cx } = getCoords(h, 0);
                            return (
                              <g key={h}>
                                <line 
                                  x1={cx} 
                                  y1={paddingTop} 
                                  x2={cx} 
                                  y2={height - paddingBottom} 
                                  stroke="#F1F5F9" 
                                  strokeWidth="1.5"
                                />
                                <text 
                                  x={cx} 
                                  y={height - paddingBottom + 16} 
                                  fill="#94A3B8" 
                                  fontSize="9" 
                                  textAnchor="middle"
                                  className="font-bold select-none font-mono"
                                >
                                  {h}
                                </text>
                              </g>
                            );
                          })}

                          {/* Linha Total (Emerald) */}
                          <path d={getLinePath('total')} fill="none" stroke="#10B981" strokeWidth="2.5" />

                          {/* Linha Enfileiradas (Amber) */}
                          <path d={getLinePath('enfileiradas')} fill="none" stroke="#F59E0B" strokeWidth="2" />

                          {/* Linha Conectadas (Blue) */}
                          <path d={getLinePath('conectadas_agente')} fill="none" stroke="#3B82F6" strokeWidth="2" />

                          {/* Linha Derrubadas (Red) */}
                          <path d={getLinePath('derrubadas')} fill="none" stroke="#EF4444" strokeWidth="1.5" />

                          {/* Renderiza pontos interativos e tooltips */}
                          {grupo.rows.map((row, idx) => {
                            const t = getCoords(idx, row.total);
                            const enf = getCoords(idx, row.enfileiradas);
                            const con = getCoords(idx, row.conectadas_agente);
                            const der = getCoords(idx, row.derrubadas);

                            // Ponto principal da hover zone (mapeia no total)
                            return (
                              <g key={idx} className="group/dot cursor-pointer">
                                {/* Círculos visíveis */}
                                {row.total > 0 && <circle cx={t.cx} cy={t.cy} r="4" fill="white" stroke="#10B981" strokeWidth="2" />}
                                {row.enfileiradas > 0 && <circle cx={enf.cx} cy={enf.cy} r="3.5" fill="white" stroke="#F59E0B" strokeWidth="2" />}
                                {row.conectadas_agente > 0 && <circle cx={con.cx} cy={con.cy} r="3.5" fill="white" stroke="#3B82F6" strokeWidth="2" />}
                                {row.derrubadas > 0 && <circle cx={der.cx} cy={der.cy} r="3" fill="white" stroke="#EF4444" strokeWidth="2" />}

                                {/* Área invisível para facilitar o hover */}
                                <line 
                                  x1={t.cx} 
                                  y1={paddingTop} 
                                  x2={t.cx} 
                                  y2={height - paddingBottom} 
                                  stroke="transparent" 
                                  strokeWidth="12" 
                                />

                                {/* Indicador de linha de hover */}
                                <line 
                                  x1={t.cx} 
                                  y1={paddingTop} 
                                  x2={t.cx} 
                                  y2={height - paddingBottom} 
                                  stroke="#3B82F6" 
                                  strokeWidth="1.5" 
                                  className="opacity-0 group-hover/dot:opacity-30 pointer-events-none transition-opacity"
                                />

                                {/* Tooltip Flutuante em SVG puro */}
                                <g className="opacity-0 group-hover/dot:opacity-100 pointer-events-none transition-opacity duration-150 z-20">
                                  {/* Caixa da Tooltip */}
                                  <rect 
                                    x={t.cx + 10 + 130 > width ? t.cx - 140 : t.cx + 10} 
                                    y={t.cy - 70} 
                                    width="130" 
                                    height="95" 
                                    rx="6" 
                                    fill="#1E293B" 
                                    opacity="0.95"
                                  />
                                  {/* Textos da Tooltip */}
                                  <text x={t.cx + 10 + 130 > width ? t.cx - 130 : t.cx + 20} y={t.cy - 52} fill="white" fontSize="10" fontWeight="bold">
                                    Hora: {row.hora.toString().padStart(2, '0')}:00
                                  </text>
                                  <text x={t.cx + 10 + 130 > width ? t.cx - 130 : t.cx + 20} y={t.cy - 36} fill="#34D399" fontSize="9" fontWeight="semibold">
                                    Total: {row.total}
                                  </text>
                                  <text x={t.cx + 10 + 130 > width ? t.cx - 130 : t.cx + 20} y={t.cy - 22} fill="#FBBF24" fontSize="9" fontWeight="semibold">
                                    Enfileiradas: {row.enfileiradas}
                                  </text>
                                  <text x={t.cx + 10 + 130 > width ? t.cx - 130 : t.cx + 20} y={t.cy - 8} fill="#60A5FA" fontSize="9" fontWeight="semibold">
                                    Conectadas: {row.conectadas_agente}
                                  </text>
                                  <text x={t.cx + 10 + 130 > width ? t.cx - 130 : t.cx + 20} y={t.cy + 6} fill="#F87171" fontSize="9" fontWeight="semibold">
                                    Derrubadas: {row.derrubadas}
                                  </text>
                                </g>
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* Tabela por Hora */}
                      <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 select-none">
                            <tr>
                              <th className="px-4 py-3 text-slate-600 font-bold">Hora</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Total</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Enfileiradas</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Em Fila</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Conectadas Agente</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Abandonadas</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Expiradas na Fila</th>
                              <th className="px-4 py-3 text-slate-600 font-bold text-center">Derrubadas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {grupo.rows.map((row) => {
                              const isInactive = row.total === 0;
                              return (
                                <tr 
                                  key={row.hora} 
                                  className={`hover:bg-slate-50 transition-colors ${
                                    isInactive ? 'opacity-40 hover:opacity-100 font-normal text-slate-400' : 'bg-white'
                                  }`}
                                >
                                  <td className="px-4 py-2.5 font-bold font-mono">
                                    {row.hora.toString().padStart(2, '0')}:00 - {(row.hora + 1).toString().padStart(2, '0')}:00
                                  </td>
                                  <td className={`px-4 py-2.5 text-center font-bold font-mono ${!isInactive && 'text-slate-900 bg-slate-50/50'}`}>
                                    {row.total}
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono">{row.enfileiradas}</td>
                                  <td className="px-4 py-2.5 text-center font-mono">{row.em_fila}</td>
                                  <td className={`px-4 py-2.5 text-center font-bold font-mono ${row.conectadas_agente > 0 && 'text-blue-600'}`}>
                                    {row.conectadas_agente}
                                  </td>
                                  <td className={`px-4 py-2.5 text-center font-mono ${row.abandonadas > 0 && 'text-amber-600 font-bold'}`}>
                                    {row.abandonadas}
                                  </td>
                                  <td className={`px-4 py-2.5 text-center font-mono ${row.expiradas_na_fila > 0 && 'text-indigo-600 font-bold'}`}>
                                    {row.expiradas_na_fila}
                                  </td>
                                  <td className={`px-4 py-2.5 text-center font-mono ${row.derrubadas > 0 && 'text-red-600 font-bold'}`}>
                                    {row.derrubadas}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                            <tr>
                              <td className="px-4 py-3 uppercase tracking-wider">Total Acumulado</td>
                              <td className="px-4 py-3 text-center text-sm font-mono">{grupo.totalChamadas}</td>
                              <td className="px-4 py-3 text-center font-mono">
                                {grupo.rows.reduce((acc, r) => acc + r.enfileiradas, 0)}
                              </td>
                              <td className="px-4 py-3 text-center font-mono">
                                {grupo.rows.reduce((acc, r) => acc + r.em_fila, 0)}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-blue-700 font-mono">{grupo.totalConectadas}</td>
                              <td className="px-4 py-3 text-center text-amber-700 font-mono">{grupo.totalAbandonadas}</td>
                              <td className="px-4 py-3 text-center text-indigo-700 font-mono">{grupo.totalExpiradas}</td>
                              <td className="px-4 py-3 text-center text-red-700 font-mono">{grupo.totalDerrubadas}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </AppLayout>
  );
}

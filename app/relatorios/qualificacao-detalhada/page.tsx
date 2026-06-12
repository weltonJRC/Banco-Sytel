'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { fetchQualificacaoDetalhada, fetchFilterOptions } from '@/lib/dataProvider';
import { formatDateTime } from '@/lib/formatters';
import { exportToCsv } from '@/lib/exportCsv';
import type { QualificacaoDetalhadaRow } from '@/lib/types';
import {
  ClipboardList,
  Clock,
  Database,
  Layers2,
  Search,
  RotateCcw,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Garante saída sempre no formato HH:MM:SS */
function formatHHMMSS(seconds: number | null | undefined): string {
  const s = Math.round(Number(seconds ?? 0));
  if (isNaN(s) || s < 0) return '00:00:00';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

/** Formata uma data ISO para o padrão legível dd mmm, yyyy (pt-BR) */
function formatPeriodDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Retorna a data de hoje no formato YYYY-MM-DD */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface CampanhaGroup {
  campanha: string;
  tipo: string;
  rows: QualificacaoDetalhadaRow[];
  totalChamadas: number;
  periodoInicio: string;
  periodoFim: string;
}

// ─── Agrupamento ──────────────────────────────────────────────────────────────

function groupByCampanha(data: QualificacaoDetalhadaRow[]): CampanhaGroup[] {
  const map = new Map<string, CampanhaGroup>();

  for (const row of data) {
    if (!map.has(row.campanha)) {
      map.set(row.campanha, {
        campanha: row.campanha,
        tipo: row.tipo,
        rows: [],
        totalChamadas: 0,
        periodoInicio: row.periodo_inicio,
        periodoFim: row.periodo_fim,
      });
    }
    const group = map.get(row.campanha)!;
    group.rows.push(row);
    group.totalChamadas += row.chamadas;
  }

  // Ordena os grupos por nome de campanha
  return Array.from(map.values()).sort((a, b) =>
    a.campanha.localeCompare(b.campanha, 'pt-BR')
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function QualificacaoDetalhadaPage() {
  // ── Estado de filtros ──────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    startDate: todayISO(),
    endDate: todayISO(),
    campanha: '',
    resultado: '',
  });

  // ── Estado de dados ────────────────────────────────────────────────────────
  const [grupos, setGrupos] = useState<CampanhaGroup[]>([]);
  const [rawData, setRawData] = useState<QualificacaoDetalhadaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Opções de campanha para o select (reutiliza filterOptions existente) ──
  const [campanhas, setCampanhas] = useState<string[]>([]);

  // ── Grupos colapsados ─────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Carrega campanhas disponíveis na montagem ──────────────────────────────
  useEffect(() => {
    fetchFilterOptions('ATENDIMENTO_OPERACAO')
      .then((opts) => setCampanhas(opts.campanhas))
      .catch(() => {
        // falha silenciosa — não bloqueia o usuário
      });
  }, []);

  // ── Consulta principal ────────────────────────────────────────────────────
  const loadData = useCallback(async (activeFilters = filters) => {
    if (!activeFilters.startDate || !activeFilters.endDate) {
      setError('Informe o período (data inicial e data final) para consultar.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await fetchQualificacaoDetalhada(activeFilters);
      setRawData(data);
      setGrupos(groupByCampanha(data));
    } catch (err: any) {
      // Log técnico seguro (apenas em dev)
      if (process.env.NODE_ENV === 'development') {
        console.error('[QualificacaoDetalhada] Erro interno:', err?.message ?? err);
      }
      setError(
        'Não foi possível carregar o relatório de qualificação detalhada. Tente novamente ou acione o suporte JRC.'
      );
      setRawData([]);
      setGrupos([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ── Manipuladores ─────────────────────────────────────────────────────────
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => loadData(filters);

  const handleClear = () => {
    const cleared = { startDate: todayISO(), endDate: todayISO(), campanha: '', resultado: '' };
    setFilters(cleared);
    setRawData([]);
    setGrupos([]);
    setError(null);
    setHasSearched(false);
  };

  const toggleCollapse = (campanha: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(campanha)) next.delete(campanha);
      else next.add(campanha);
      return next;
    });
  };

  // ── Métricas dos cards ────────────────────────────────────────────────────
  const totalRegistros = rawData.reduce((acc, r) => acc + r.chamadas, 0);
  const totalCampanhas = grupos.length;
  const tmaSomaGeral = rawData.reduce((acc, r) => acc + r.tma_soma_segundos, 0);
  const tmaMediaGeral =
    totalRegistros > 0
      ? Math.round(tmaSomaGeral / totalRegistros)
      : 0;

  // ── Exportação ────────────────────────────────────────────────────────────
  const buildExportPayload = () => {
    const headers = [
      'Campanha',
      'Tipo',
      'Período Inicial',
      'Período Final',
      'Qualificação / Resultado',
      'Conectadas / Cham. Feitas',
      'TMA Soma',
      'TMA Média',
      'Tempo pós-atend. Soma',
      'Tempo pós-atend. Média',
    ];

    const rows = rawData.map((r) => [
      r.campanha,
      r.tipo,
      formatDateTime(r.periodo_inicio),
      formatDateTime(r.periodo_fim),
      r.qualificacao,
      r.chamadas,
      formatHHMMSS(r.tma_soma_segundos),
      formatHHMMSS(Math.round(r.tma_media_segundos)),
      formatHHMMSS(r.pos_atendimento_soma_segundos),
      formatHHMMSS(Math.round(r.pos_atendimento_media_segundos)),
    ]);

    return { headers, rows };
  };

  // Único método de exportação: CSV completo com campos protegidos
  const handleExportCsv = () => {
    const { headers, rows } = buildExportPayload();
    // Colunas 2 e 3 são datas (Período Inicial e Final) — protegidas com ="valor"
    exportToCsv(headers, rows, 'cetesb-qualificacao-detalhada.csv', [2, 3]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="Relatórios: Qualificação Detalhada">
      <div className="space-y-6">

        {/* ── Cabeçalho da Página ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase">
              Relatório Detalhado — QUALIFICAÇÃO DO ATENDIMENTO
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Consolidado de qualificações por campanha com volumes e tempos médios de atendimento.
            </p>
          </div>
        </div>

        {/* ── Cards Superiores ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Registros"
            value={totalRegistros.toLocaleString('pt-BR')}
            icon={<Database className="w-5 h-5 text-blue-500" />}
            description="Chamadas no período filtrado"
          />
          <StatCard
            title="Total de Campanhas"
            value={totalCampanhas.toLocaleString('pt-BR')}
            icon={<Layers2 className="w-5 h-5 text-violet-500" />}
            description="Campanhas distintas encontradas"
          />
          <StatCard
            title="TMA Geral (Média)"
            value={formatHHMMSS(tmaMediaGeral)}
            icon={<Clock className="w-5 h-5 text-emerald-500" />}
            description="Tempo médio de atendimento global"
          />
          <StatCard
            title="Tempo Total de Atendimento"
            value={formatHHMMSS(tmaSomaGeral)}
            icon={<ClipboardList className="w-5 h-5 text-indigo-500" />}
            description="Soma de toda a fala no período"
          />
        </div>

        {/* ── Painel de Filtros ──────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Data Inicial */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Data Inicial</label>
              <input
                id="qd-filter-start-date"
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
                id="qd-filter-end-date"
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
                id="qd-filter-campanha"
                value={filters.campanha}
                onChange={(e) => handleFilterChange('campanha', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              >
                <option value="">Todas as Campanhas</option>
                {campanhas.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Resultado / Qualificação */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Resultado / Qualificação</label>
              <input
                id="qd-filter-resultado"
                type="text"
                placeholder="Ex: Resolvido, Muda..."
                value={filters.resultado}
                onChange={(e) => handleFilterChange('resultado', e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100">
            {/* Exportações */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                id="qd-export-csv"
                onClick={handleExportCsv}
                disabled={rawData.length === 0}
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
                id="qd-btn-clear"
                onClick={handleClear}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Limpar Filtros
              </button>
              <button
                id="qd-btn-search"
                onClick={handleSearch}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                Pesquisar
              </button>
            </div>
          </div>
        </div>

        {/* ── Área do Relatório ──────────────────────────────────────── */}

        {/* Estado de carregamento */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Carregando qualificações...</p>
          </div>
        )}

        {/* Erro amigável */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-red-50 rounded-lg border border-red-200 shadow-sm">
            <div className="p-4 bg-red-100 text-red-500 border border-red-200 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-red-800">Erro na Consulta</h3>
            <p className="mt-2 text-sm text-red-600 max-w-md font-semibold">{error}</p>
          </div>
        )}

        {/* Sem dados */}
        {!loading && !error && hasSearched && grupos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">
              Nenhum registro encontrado para os filtros aplicados.
            </p>
            <p className="text-xs text-slate-400">
              Tente ampliar o período ou remover filtros opcionais.
            </p>
          </div>
        )}

        {/* Estado inicial (antes da primeira pesquisa) */}
        {!loading && !error && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-400">
              Selecione o período e clique em <span className="text-blue-600">Pesquisar</span> para carregar o relatório.
            </p>
          </div>
        )}

        {/* Blocos de campanha */}
        {!loading && !error && grupos.length > 0 && (
          <div className="space-y-6" id="qd-report-area">
            {grupos.map((grupo) => {
              const isCollapsed = collapsed.has(grupo.campanha);
              return (
                <div
                  key={grupo.campanha}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                  id={`qd-campanha-${grupo.campanha.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {/* Cabeçalho do bloco de campanha */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-800 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Campanha
                        </span>
                        <h2 className="text-sm font-bold text-white leading-tight uppercase tracking-tight">
                          {grupo.campanha}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-slate-300">
                      <span>
                        <span className="font-semibold text-slate-400 mr-1">Tipo:</span>
                        {grupo.tipo}
                      </span>
                      <span>
                        <span className="font-semibold text-slate-400 mr-1">Período:</span>
                        {formatPeriodDate(grupo.periodoInicio)}
                        {grupo.periodoInicio !== grupo.periodoFim && (
                          <> → {formatPeriodDate(grupo.periodoFim)}</>
                        )}
                      </span>
                      <button
                        onClick={() => toggleCollapse(grupo.campanha)}
                        className="ml-2 p-1 rounded hover:bg-slate-700 transition text-slate-400 hover:text-white"
                        title={isCollapsed ? 'Expandir' : 'Recolher'}
                      >
                        {isCollapsed
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronUp className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Tabela de qualificações */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left font-semibold text-slate-600 min-w-[200px]">
                              Qualificação / Resultado
                            </th>
                            <th className="px-4 py-2.5 text-center font-semibold text-slate-600 whitespace-nowrap">
                              Conectadas /<br />Cham. Feitas
                            </th>
                            <th className="px-4 py-2.5 text-center font-semibold text-slate-600 whitespace-nowrap">
                              TMA<br />(Soma)
                            </th>
                            <th className="px-4 py-2.5 text-center font-semibold text-slate-600 whitespace-nowrap">
                              TMA<br />(Média)
                            </th>
                            <th className="px-4 py-2.5 text-center font-semibold text-slate-600 whitespace-nowrap">
                              Tempo pós-atend.<br />(Soma)
                            </th>
                            <th className="px-4 py-2.5 text-center font-semibold text-slate-600 whitespace-nowrap">
                              Tempo pós-atend.<br />(Média)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.rows.map((row, idx) => (
                            <tr
                              key={`${row.campanha}-${row.qualificacao}-${idx}`}
                              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium text-slate-700">
                                {row.qualificacao}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800">
                                {row.chamadas.toLocaleString('pt-BR')}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-slate-700">
                                {formatHHMMSS(row.tma_soma_segundos)}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-slate-700">
                                {formatHHMMSS(Math.round(row.tma_media_segundos))}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-slate-500">
                                {formatHHMMSS(row.pos_atendimento_soma_segundos)}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-slate-500">
                                {formatHHMMSS(Math.round(row.pos_atendimento_media_segundos))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td className="px-4 py-2.5 font-bold text-slate-700 text-xs uppercase tracking-wide">
                              Totals
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold text-slate-900 text-sm">
                              {grupo.totalChamadas.toLocaleString('pt-BR')}
                            </td>
                            <td colSpan={4} />
                          </tr>
                        </tfoot>
                      </table>
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

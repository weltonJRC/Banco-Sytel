'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import FiltersBar from '@/components/FiltersBar';
import DataTable from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import SourceBadge from '@/components/SourceBadge';
import StatusBadge from '@/components/StatusBadge';
import StatCard from '@/components/StatCard';
import { fetchEvents, fetchFilterOptions } from '@/lib/dataProvider';
import { formatSeconds, formatDateTime } from '@/lib/formatters';
import { exportToCsv } from '@/lib/exportCsv';
import { exportToXlsx } from '@/lib/exportXlsx';
import { Cpu, Clock, Calendar, Database } from 'lucide-react';

interface UraRow {
  id: number;
  campanha: string;
  fila: string;
  numero_telefone: string;
  sessao_iniciada: string;
  duracao_fila_segundos: number;
  duracao_fala_segundos: number;
  resultado_nome: string;
  descricao_resultado: string;
  fonte_oficial: string;
  status_validacao: string;
}

export default function UraCetesbPage() {
  const [data, setData] = useState<UraRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [filterOptions, setFilterOptions] = useState({
    campanhas: [] as string[],
    filas: [] as string[],
    usuarios: [] as string[],
    fontes: [] as string[],
    statuses: [] as string[]
  });

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    campanha: '',
    fila: '',
    usuario: '', // Fica vazio e oculto no URA
    resultado: '',
    fonte: '',
    status: ''
  });

  const loadData = async (activePage = page, activePageSize = pageSize) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvents({
        tipo_relatorio: 'URA',
        page: activePage,
        pageSize: activePageSize,
        ...filters
      });
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Erro ao carregar registros de URA:', err);
      setError('Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.');
      setData([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadOptions() {
      const opts = await fetchFilterOptions('URA');
      setFilterOptions(opts);
    }
    loadOptions();
  }, []);

  useEffect(() => {
    loadData(page, pageSize);
  }, [page, pageSize]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setPage(1);
    loadData(1, pageSize);
  };

  const handleClear = () => {
    const cleared = {
      startDate: '',
      endDate: '',
      campanha: '',
      fila: '',
      usuario: '',
      resultado: '',
      fonte: '',
      status: ''
    };
    setFilters(cleared);
    setPage(1);

    setLoading(true);
    setError(null);
    fetchEvents({
      tipo_relatorio: 'URA',
      page: 1,
      pageSize,
      ...cleared
    }).then(res => {
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setLoading(false);
    }).catch(err => {
      console.error('Erro ao carregar registros de URA ao limpar:', err);
      setError('Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.');
      setData([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
    });
  };

  const getExportData = async () => {
    const res = await fetchEvents({
      tipo_relatorio: 'URA',
      page: 1,
      pageSize: 50000,
      ...filters
    });

    const headers = [
      'Campanha',
      'Fila',
      'Número de telefone',
      'Sessão iniciada - Evento',
      'Duração da fila - Total',
      'Duração da fala - Total',
      'Resultado',
      'Descrição do resultado do usuário'
    ];

    const rows = res.data.map(e => [
      e.campanha,
      e.fila,
      e.numero_telefone,
      formatDateTime(e.sessao_iniciada),
      formatSeconds(e.duracao_fila_segundos),
      formatSeconds(e.duracao_fala_segundos),
      e.resultado_nome,
      e.descricao_resultado
    ]);

    return { headers, rows };
  };

  const handleExportCsv = async () => {
    const { headers, rows } = await getExportData();
    exportToCsv(headers, rows, 'cetesb-relatorio-ura.csv');
  };

  const handleExportXlsx = async () => {
    const { headers, rows } = await getExportData();
    exportToXlsx(headers, rows, 'cetesb-relatorio-ura.xlsx');
  };

  const totalNavegacaoSegundos = data.reduce((acc, curr) => acc + (curr.duracao_fala_segundos || 0), 0);
  const avgNavegacaoSegundos = data.length > 0
    ? Math.round(totalNavegacaoSegundos / data.length)
    : 0;

  const headers = [
    'Campanha',
    'Fila',
    'Número de telefone',
    'Sessão iniciada - Evento',
    'Duração da fila - Total',
    'Duração da fala - Total',
    'Resultado',
    'Descrição do resultado do usuário'
  ];

  return (
    <AppLayout title="Relatórios: URA CETESB">
      <div className="space-y-6">
        
        {/* Topo com Título */}
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase">
            Relatório Detalhado - URA CETESB
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Histórico das navegações e interações eletrônicas sem intervenção humana
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Navegações URA"
            value={total.toLocaleString('pt-BR')}
            icon={<Database className="w-5 h-5 text-indigo-500" />}
            description="Interações correspondentes aos filtros"
          />
          <StatCard
            title="Tempo Médio de Navegação"
            value={formatSeconds(avgNavegacaoSegundos)}
            icon={<Clock className="w-5 h-5 text-emerald-500" />}
            description="Média de permanência na URA"
          />
          <StatCard
            title="Tempo Total Acumulado"
            value={formatSeconds(totalNavegacaoSegundos)}
            icon={<Cpu className="w-5 h-5 text-blue-500" />}
            description="Soma de tempos de navegação"
          />
        </div>

        {/* Filtros Superiores */}
        <FiltersBar
          tipo_relatorio="URA"
          filters={filters}
          options={filterOptions}
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          onClear={handleClear}
          onExportCsv={handleExportCsv}
          onExportXlsx={handleExportXlsx}
        />

        {/* Tabela de Dados Grande */}
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-red-50 rounded-lg border border-red-200 shadow-sm">
            <div className="p-4 bg-red-100 text-red-500 border border-red-200 rounded-full flex items-center justify-center">
              <Database className="w-8 h-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-red-800">Erro na Consulta</h3>
            <p className="mt-2 text-sm text-red-600 max-w-md font-semibold">
              {error}
            </p>
          </div>
        ) : (
          <DataTable
            headers={headers}
            loading={loading}
            totalRecords={total}
          >
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                <td className="px-4 py-3.5 font-bold text-slate-800">{row.campanha}</td>
                <td className="px-4 py-3.5 text-slate-600 font-medium">{row.fila}</td>
                <td className="px-4 py-3.5 font-mono text-slate-600 tracking-wider font-semibold">{row.numero_telefone}</td>
                <td className="px-4 py-3.5 text-slate-500 font-medium">{formatDateTime(row.sessao_iniciada)}</td>
                <td className="px-4 py-3.5 font-mono text-slate-500">{formatSeconds(row.duracao_fila_segundos)}</td>
                <td className="px-4 py-3.5 font-mono text-slate-800 font-bold">{formatSeconds(row.duracao_fala_segundos)}</td>
                <td className="px-4 py-3.5 font-semibold text-slate-700">{row.resultado_nome || '-'}</td>
                <td className="px-4 py-3.5 text-slate-600 max-w-[200px] truncate" title={row.descricao_resultado}>
                  {row.descricao_resultado}
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        {/* Paginação */}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />

      </div>
    </AppLayout>
  );
}

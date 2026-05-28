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
import { PhoneCall, Clock, MessageSquare, Database } from 'lucide-react';

interface EventRow {
  id: number;
  campanha: string;
  fila: string;
  usuario: string;
  numero_telefone: string;
  sessao_iniciada: string;
  duracao_fila_segundos: number;
  duracao_fala_segundos: number;
  descricao_resultado: string;
  resultado_usuario: string;
  fonte_oficial: string;
  status_validacao: string;
}

export default function AtendimentosOperacaoPage() {
  const [data, setData] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Opções para Selects de Filtros
  const [filterOptions, setFilterOptions] = useState({
    campanhas: [] as string[],
    filas: [] as string[],
    usuarios: [] as string[],
    fontes: [] as string[],
    statuses: [] as string[]
  });

  // Estado dos Filtros Ativos
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    campanha: '',
    fila: '',
    usuario: '',
    resultado: '',
    fonte: '',
    status: ''
  });

  // Dispara a busca principal de dados
  const loadData = async (activePage = page, activePageSize = pageSize) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvents({
        tipo_relatorio: 'ATENDIMENTO_OPERACAO',
        page: activePage,
        pageSize: activePageSize,
        ...filters
      });
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.warn('[Atendimentos Page] Falha de comunicação interna ao carregar atendimentos.');
      setError('Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.');
      setData([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Carrega as opções de filtro uma única vez no mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const opts = await fetchFilterOptions('ATENDIMENTO_OPERACAO');
        setFilterOptions(opts);
      } catch (err) {
        console.warn('[Atendimentos Page] Falha de comunicação interna ao carregar filtros de pesquisa.');
      }
    }
    loadOptions();
  }, []);

  // Monitora mudança de página ou tamanho de página
  useEffect(() => {
    loadData(page, pageSize);
  }, [page, pageSize]);

  // Manipulador de alterações nos campos de filtros
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setPage(1); // Reinicia para a primeira página
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
    
    // Executa a busca com os campos limpos imediatamente
    setLoading(true);
    setError(null);
    fetchEvents({
      tipo_relatorio: 'ATENDIMENTO_OPERACAO',
      page: 1,
      pageSize,
      ...cleared
    }).then(res => {
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setLoading(false);
    }).catch(err => {
      console.warn('[Atendimentos Page] Falha de comunicação interna ao limpar filtros.');
      setError('Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.');
      setData([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
    });
  };

  // Funções de Exportação
  const getExportData = async () => {
    // Consulta TODOS os registros correspondentes aos filtros atuais (sem limitação de página)
    const res = await fetchEvents({
      tipo_relatorio: 'ATENDIMENTO_OPERACAO',
      page: 1,
      pageSize: 50000, // Limite estendido para pegar toda a base filtrada
      ...filters
    });
    
    const headers = [
      'Campanha',
      'Fila',
      'Usuário',
      'Número de telefone',
      'Sessão iniciada - Evento',
      'Duração da fila - Total',
      'Duração da fala - Total',
      'Descrição do resultado do usuário',
      'Resultado do usuário'
    ];

    const rows = res.data.map(e => [
      e.campanha,
      e.fila,
      e.usuario,
      e.numero_telefone,
      formatDateTime(e.sessao_iniciada),
      formatSeconds(e.duracao_fila_segundos),
      formatSeconds(e.duracao_fala_segundos),
      e.descricao_resultado,
      e.resultado_usuario
    ]);

    return { headers, rows };
  };

  const handleExportCsv = async () => {
    const { headers, rows } = await getExportData();
    exportToCsv(headers, rows, 'cetesb-atendimentos-operacao.csv');
  };

  const handleExportXlsx = async () => {
    const { headers, rows } = await getExportData();
    exportToXlsx(headers, rows, 'cetesb-atendimentos-operacao.xlsx');
  };

  // Métricas agregadas rápidas sobre os itens visualizados
  const avgTalkTime = data.length > 0
    ? Math.round(data.reduce((acc, curr) => acc + (curr.duracao_fala_segundos || 0), 0) / data.length)
    : 0;

  const totalTalkTime = data.reduce((acc, curr) => acc + (curr.duracao_fala_segundos || 0), 0);

  const headers = [
    'Campanha',
    'Fila',
    'Usuário',
    'Número de telefone',
    'Sessão iniciada - Evento',
    'Duração da fila - Total',
    'Duração da fala - Total',
    'Descrição do resultado do usuário',
    'Resultado do usuário'
  ];

  return (
    <AppLayout title="Relatórios: Atendimentos Operação">
      <div className="space-y-6">
        
        {/* Topo com Título no Estilo Sytel */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase">
              Relatório Detalhado - ATENDIMENTOS OPERAÇÃO
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Histórico consolidado de ligações receptivas e ativas com atendimento humano
            </p>
          </div>
        </div>

        {/* Estatísticas rápidas baseadas nos filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Registros Filtrados"
            value={total.toLocaleString('pt-BR')}
            icon={<Database className="w-5 h-5 text-blue-500" />}
            description="Chamadas correspondentes aos filtros"
          />
          <StatCard
            title="TMA (Tempo Médio de Atendimento)"
            value={formatSeconds(avgTalkTime)}
            icon={<Clock className="w-5 h-5 text-emerald-500" />}
            description="Média de duração de fala"
          />
          <StatCard
            title="Tempo Total de Conversação"
            value={formatSeconds(totalTalkTime)}
            icon={<PhoneCall className="w-5 h-5 text-indigo-500" />}
            description="Acumulado da fala dos operadores"
          />
        </div>

        {/* Painel de Filtros Superiores */}
        <FiltersBar
          tipo_relatorio="ATENDIMENTO_OPERACAO"
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
                <td className="px-4 py-3.5 font-semibold text-slate-700">{row.usuario}</td>
                <td className="px-4 py-3.5 font-mono text-slate-600 tracking-wider font-semibold">{row.numero_telefone}</td>
                <td className="px-4 py-3.5 text-slate-500 font-medium">{formatDateTime(row.sessao_iniciada)}</td>
                <td className="px-4 py-3.5 font-mono text-slate-600">{formatSeconds(row.duracao_fila_segundos)}</td>
                <td className="px-4 py-3.5 font-mono text-slate-800 font-bold">{formatSeconds(row.duracao_fala_segundos)}</td>
                <td className="px-4 py-3.5 text-slate-600 max-w-[200px] truncate" title={row.descricao_resultado}>
                  {row.descricao_resultado}
                </td>
                <td className="px-4 py-3.5 font-semibold text-slate-700">{row.resultado_usuario}</td>
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

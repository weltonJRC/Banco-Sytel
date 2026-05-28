'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import SourceBadge from '@/components/SourceBadge';
import { fetchDashboardStats } from '@/lib/dataProvider';
import { formatDateTime } from '@/lib/formatters';
import { 
  Database, 
  PhoneCall, 
  Cpu, 
  CalendarRange, 
  Clock, 
  TrendingUp,
  BarChart4
} from 'lucide-react';

interface DashboardData {
  totalRecords: number;
  totalAtendimentos: number;
  totalUra: number;
  periodoInicio: string;
  periodoFim: string;
  fontes: {
    EXCEL_2025: number;
    SYTEL_2026: number;
  };
  ultimaImportacao: string;
  monthlyCoverage: Array<{
    mes: string;
    total: number;
    atendimentos: number;
    ura: number;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        setError('Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatDateShort = (isoString: string | undefined) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <AppLayout title="Dashboard Geral">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-white border border-slate-200 rounded-lg"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !stats) {
    return (
      <AppLayout title="Dashboard Geral">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-red-50 rounded-lg border border-red-200 shadow-sm space-y-4">
          <div className="p-4 bg-red-100 text-red-500 border border-red-200 rounded-full flex items-center justify-center">
            <Database className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-red-800">Falha ao Inicializar Dashboard</h2>
          <p className="text-sm text-red-600 max-w-md font-semibold font-medium">
            {error || 'Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.'}
          </p>
        </div>
      </AppLayout>
    );
  }

  // Encontra o valor máximo para dimensionar as barras do gráfico SVG
  const maxVolume = Math.max(...stats.monthlyCoverage.map(m => m.total), 10);

  return (
    <AppLayout title="Dashboard Geral">
      <div className="space-y-8">
        
        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Geral */}
          <StatCard
            title="Total de Registros"
            value={stats.totalRecords.toLocaleString('pt-BR')}
            icon={<Database className="w-6 h-6 text-blue-600" />}
            description="Registros totais consolidados"
          />

          {/* Atendimentos */}
          <StatCard
            title="Atendimentos da Operação"
            value={stats.totalAtendimentos.toLocaleString('pt-BR')}
            icon={<PhoneCall className="w-6 h-6 text-emerald-600" />}
            description="Chamadas com atendimento humano"
          />

          {/* URA */}
          <StatCard
            title="Registros de URA"
            value={stats.totalUra.toLocaleString('pt-BR')}
            icon={<Cpu className="w-6 h-6 text-indigo-600" />}
            description="Navegações na URA eletrônica"
          />

          {/* Período Coberto */}
          <StatCard
            title="Período Disponível"
            value={`${formatDateShort(stats.periodoInicio)} a ${formatDateShort(stats.periodoFim)}`}
            icon={<CalendarRange className="w-6 h-6 text-slate-600" />}
            description="Janela histórica recuperada"
          />
        </div>

        {/* Fontes de Dados e Detalhes da Carga */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card Fontes de Origem */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Registros por Fonte
              </h3>
              
              <div className="mt-5 space-y-4">
                {/* Excel 2025 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SourceBadge source="EXCEL_2025" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {stats.fontes.EXCEL_2025.toLocaleString('pt-BR')}
                  </span>
                </div>
                
                {/* Sytel 2026 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SourceBadge source="SYTEL_2026" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {stats.fontes.SYTEL_2026.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Última importação física:
              </span>
              <span className="font-semibold text-slate-600">
                {formatDateTime(stats.ultimaImportacao)}
              </span>
            </div>
          </div>

          {/* Gráfico de Volume Mensal (Custom SVG Bar Chart) */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-6">
              <BarChart4 className="w-4 h-4 text-blue-600" />
              Quantidade de Registros por Mês
            </h3>
            
            {/* Desenho do gráfico nativo e responsivo em SVG */}
            <div className="w-full h-48 flex items-end justify-between px-2 gap-4 select-none">
              {stats.monthlyCoverage.map((m, idx) => {
                const heightPercentage = Math.max((m.total / maxVolume) * 100, 5); // Garante altura mínima
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* Tooltip Hover */}
                    <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow z-10 flex flex-col gap-0.5 min-w-[120px] text-left">
                      <p className="font-bold border-b border-slate-700 pb-0.5">{m.mes}</p>
                      <p>Atendimentos: <span className="font-bold text-emerald-400">{m.atendimentos}</span></p>
                      <p>URA: <span className="font-bold text-indigo-400">{m.ura}</span></p>
                      <p className="font-semibold text-slate-300 mt-0.5 pt-0.5 border-t border-slate-800">Total: {m.total}</p>
                    </div>
                    
                    {/* Barras do Gráfico (Empilhadas) */}
                    <div className="w-8 sm:w-12 rounded-t flex flex-col overflow-hidden w-full transition-all group-hover:brightness-95 shadow-sm" style={{ height: `${heightPercentage}%` }}>
                      {/* Atendimentos (Verde) */}
                      {m.atendimentos > 0 && (
                        <div 
                          className="bg-emerald-500 transition-all" 
                          style={{ height: `${(m.atendimentos / m.total) * 100}%` }}
                          title={`Atendimentos: ${m.atendimentos}`}
                        />
                      )}
                      {/* URA (Indigo) */}
                      {m.ura > 0 && (
                        <div 
                          className="bg-indigo-500 flex-1 transition-all"
                          title={`URA: ${m.ura}`}
                        />
                      )}
                    </div>
                    
                    {/* Legenda do Mês */}
                    <span className="mt-3 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                      {m.mes}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Legenda de Cores */}
            <div className="flex items-center justify-center gap-6 mt-4 text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                Atendimentos Humano
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 block"></span>
                URA Eletrônica
              </span>
            </div>

          </div>
        </div>

        {/* Tabela de Cobertura Mensal Detalhada */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Cobertura Temporal Histórica</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-xs">Mês/Ano</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-xs text-right">Volume Atendimentos</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-xs text-right">Volume URA</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-xs text-right">Volume Total</th>
                  <th className="px-6 py-3 text-slate-500 font-semibold text-xs">Status da Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.monthlyCoverage.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-bold text-slate-800">{m.mes}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-600">{m.atendimentos.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-600">{m.ura.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-3.5 text-right font-bold text-slate-900">{m.total.toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                        CONSOLIDADO
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

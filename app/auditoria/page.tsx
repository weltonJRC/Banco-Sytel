'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import SourceBadge from '@/components/SourceBadge';
import StatusBadge from '@/components/StatusBadge';
import { fetchAuditoria } from '@/lib/dataProvider';
import { formatDateTime } from '@/lib/formatters';
import { Shield, Copy, Check, FileText } from 'lucide-react';

interface AuditFile {
  id: number;
  source_system: string;
  source_type: string;
  file_name: string;
  file_hash_sha256: string;
  reference_start_date: string;
  reference_end_date: string;
  imported_at: string;
  imported_by: string;
  import_status: string;
  total_rows: number;
  notes: string;
}

export default function AuditoriaPage() {
  const [data, setData] = useState<AuditFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAuditoria();
        setData(res);
      } catch (err) {
        console.error('Erro ao carregar auditoria:', err);
        setError('Não foi possível carregar os dados. Tente novamente ou acione o suporte JRC.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopyHash = (id: number, hash: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(hash);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
  };

  return (
    <AppLayout title="Auditoria de Fontes">
      <div className="space-y-6">
        
        {/* Título */}
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Auditoria das Fontes de Dados
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Rastreamento completo e transparência sobre a origem de cada registro consolidado
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-sm text-blue-800 leading-relaxed shadow-sm">
          <p className="font-bold mb-1 flex items-center gap-1.5 text-blue-900">
            Sobre a Consolidacão Histórica
          </p>
          <p className="text-xs">
            Esta tela rastreia fisicamente os arquivos de planilhas Excel importados no sistema. Devido a uma falha na retenção de dados da Sytel,
            a JRC consolidou os dados de 2025 recuperados da planilha física local e os uniu às exportações da Sytel extraídas de 2026. 
            Todos os arquivos são validados com um hash criptográfico <strong>SHA-256</strong> exclusivo, o que garante a autenticidade e impede duplicações acidentais.
          </p>
        </div>

        {/* Tabela de Auditoria */}
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-red-50 rounded-lg border border-red-200 shadow-sm">
            <div className="p-4 bg-red-100 text-red-500 border border-red-200 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-red-800">Erro na Consulta</h3>
            <p className="mt-2 text-sm text-red-600 max-w-md font-semibold">
              {error}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Sistema de Origem</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Nome do Arquivo</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Hash SHA-256</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Período Coberto</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Importado Em</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-right">Total Linhas</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array(2).fill(0).map((_, idx) => (
                      <tr key={idx} className="animate-pulse bg-white">
                        {Array(8).fill(0).map((_, cIdx) => (
                          <td key={cIdx} className="px-6 py-4">
                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : data.length > 0 ? (
                    data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <div className="flex flex-col gap-0.5">
                            <span>{item.source_system}</span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">{item.source_type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-slate-400" />
                            {item.file_name}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[10px] bg-slate-100 font-mono border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 block max-w-[120px] truncate" title={item.file_hash_sha256}>
                              {item.file_hash_sha256}
                            </code>
                            <button
                              onClick={() => handleCopyHash(item.id, item.file_hash_sha256)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="Copiar Hash SHA-256"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-600">
                          {formatDate(item.reference_start_date)} a {formatDate(item.reference_end_date)}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{formatDateTime(item.imported_at)}</span>
                            <span className="text-[10px] text-slate-400">Por: {item.imported_by}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          {item.total_rows.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.import_status} />
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate" title={item.notes}>
                          {item.notes}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-400 text-xs font-semibold">
                        Nenhum arquivo auditado encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

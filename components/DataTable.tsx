import React from 'react';
import EmptyState from './EmptyState';

interface DataTableProps {
  headers: string[];
  loading: boolean;
  totalRecords: number;
  children: React.ReactNode;
}

export default function DataTable({
  headers,
  loading,
  totalRecords,
  children
}: DataTableProps) {
  return (
    <div className="bg-white rounded-t-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto w-full max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          {/* Cabeçalho Fixo (Sticky Header) */}
          <thead className="sticky top-0 bg-slate-50 shadow-[0_1px_0_0_#cbd5e1] z-10">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap bg-slate-50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* Corpo da Tabela */}
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Esqueleto de Loading
              Array(5)
                .fill(0)
                .map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse bg-white">
                    {headers.map((_, cIdx) => (
                      <td key={cIdx} className="px-4 py-4 whitespace-nowrap">
                        <div className="h-4 bg-slate-100 rounded w-4/5"></div>
                      </td>
                    ))}
                  </tr>
                ))
            ) : totalRecords > 0 ? (
              children
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Exibição se estiver vazio (fora da rolagem se possível, ou integrado) */}
      {!loading && totalRecords === 0 && (
        <div className="p-8">
          <EmptyState />
        </div>
      )}
    </div>
  );
}

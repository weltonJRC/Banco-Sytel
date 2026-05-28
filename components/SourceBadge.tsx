import React from 'react';

interface SourceBadgeProps {
  source: string | null | undefined;
}

export default function SourceBadge({ source }: SourceBadgeProps) {
  if (!source) return <span className="text-gray-400">-</span>;

  let classes = 'bg-gray-100 text-gray-800 border-gray-300';
  let label = source;

  if (source === 'EXCEL_2025' || source === 'CETESB 2025 - URA/Atendimento') {
    classes = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'CETESB 2025 - URA/Atendimento';
  } else if (source === 'SYTEL_2026' || source === 'CETESB 2026 - Atendimento') {
    classes = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    label = 'CETESB 2026 - Atendimento';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}>
      {label}
    </span>
  );
}

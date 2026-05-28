import React from 'react';

interface StatusBadgeProps {
  status: string | null | undefined;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const norm = status ? status.toUpperCase() : 'PENDENTE';

  let classes = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  let label = 'Pendente';

  if (norm === 'VALIDADO' || norm === 'SUCESSO') {
    classes = 'bg-green-50 text-green-700 border-green-200';
    label = 'Validado';
  } else if (norm === 'DIVERGENTE') {
    classes = 'bg-orange-50 text-orange-700 border-orange-200';
    label = 'Divergente';
  } else if (norm === 'ERRO') {
    classes = 'bg-red-50 text-red-700 border-red-200';
    label = 'Erro';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${classes}`}>
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current"></span>
      {label}
    </span>
  );
}

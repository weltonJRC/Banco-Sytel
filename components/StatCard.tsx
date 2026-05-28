import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export default function StatCard({ title, value, icon, description, className = '' }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex items-start justify-between transition-all hover:shadow-md hover:border-slate-300 ${className}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
        <h4 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{value}</h4>
        {description && (
          <p className="mt-1 text-xs text-slate-400 truncate">{description}</p>
        )}
      </div>
      {icon && (
        <div className="ml-4 p-3 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
  );
}

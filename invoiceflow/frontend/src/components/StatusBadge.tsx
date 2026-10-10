import React from 'react';
import { InvoiceStatus } from '../types';

interface StatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const configs: Record<
    InvoiceStatus,
    { label: string; dotClass: string; bgClass: string; textClass: string; borderClass: string }
  > = {
    draft: {
      label: 'Draft',
      dotClass: 'bg-slate-400',
      bgClass: 'bg-slate-50',
      textClass: 'text-slate-700',
      borderClass: 'border-slate-200',
    },
    sent: {
      label: 'Sent',
      dotClass: 'bg-blue-500',
      bgClass: 'bg-blue-50/60',
      textClass: 'text-blue-700',
      borderClass: 'border-blue-200',
    },
    paid: {
      label: 'Paid',
      dotClass: 'bg-emerald-500',
      bgClass: 'bg-emerald-50/70',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
    },
    overdue: {
      label: 'Overdue',
      dotClass: 'bg-rose-500 animate-pulse',
      bgClass: 'bg-rose-50',
      textClass: 'text-rose-700',
      borderClass: 'border-rose-200',
    },
    void: {
      label: 'Voided',
      dotClass: 'bg-zinc-400',
      bgClass: 'bg-zinc-100',
      textClass: 'text-zinc-600',
      borderClass: 'border-zinc-200',
    },
  };

  const config = configs[status] || configs.draft;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
};

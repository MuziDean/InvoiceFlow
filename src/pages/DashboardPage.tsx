import React from 'react';
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  PlusCircle,
  Download,
  ArrowRight,
  ShieldCheck,
  Hash,
  Eye,
} from 'lucide-react';
import { DashboardData, Invoice } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

interface DashboardPageProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigateToTab: (tab: string) => void;
  onOpenCreateInvoice: () => void;
  onViewInvoice: (invoiceId: number) => void;
  onRefresh: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  data,
  loading,
  onNavigateToTab,
  onOpenCreateInvoice,
  onViewInvoice,
  onRefresh,
}) => {
  const { showToast } = useToast();

  if (loading || !data) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-200 rounded-xl"></div>
          <div className="h-28 bg-slate-200 rounded-xl"></div>
          <div className="h-28 bg-slate-200 rounded-xl"></div>
          <div className="h-28 bg-slate-200 rounded-xl"></div>
        </div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  const { summary, monthly_revenue, recent_invoices, next_invoice_number } = data;

  const handleQuickMarkPaid = async (inv: Invoice) => {
    try {
      await api.markPaid(inv.id);
      showToast(`Invoice ${inv.invoice_number} marked as Paid`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDownloadPdf = (inv: Invoice) => {
    window.location.href = api.getPdfUrl(inv.id);
  };

  // Calculate highest monthly value for chart scale
  const maxMonthlyVal = Math.max(
    ...monthly_revenue.map((m) => Math.max(m.invoiced, m.paid)),
    1000
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time billing performance and sequential invoice numbering tracker
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToTab('invoices')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            All Invoices
          </button>
          <button
            onClick={onOpenCreateInvoice}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Generate Invoice</span>
          </button>
        </div>
      </div>

      {/* Auto-Numbering Engine Announcement Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-sm border border-blue-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/30 text-blue-300 border border-blue-400/30">
              Core Guarantee
            </span>
            <span className="text-xs text-blue-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Atomic Database Lock & Zero-Collision
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Automated Sequential Numbering Engine
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Invoices are assigned guaranteed sequential numbers server-side inside transactional locks.
            Users never type numbers manually, numbers are never reused upon deletion/voiding, and counters auto-reset annually.
          </p>
        </div>
        <div className="bg-slate-950/70 border border-blue-500/30 rounded-lg p-3 text-right shrink-0 min-w-52">
          <span className="text-[11px] font-medium text-slate-400 block">Next Auto-Assigned Number</span>
          <span className="font-mono text-xl font-bold text-blue-400 tracking-wider">
            {next_invoice_number}
          </span>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Format: Prefix-Year-Sequence
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoiced</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(summary.total_invoiced)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Across {summary.active_invoices_count} active invoices
            </p>
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collected</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(summary.total_paid)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.total_invoiced > 0
                ? `${Math.round((summary.total_paid / summary.total_invoiced) * 100)}% collection rate`
                : 'No invoices yet'}
            </p>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(summary.outstanding)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Sent & pending payment
            </p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              {formatCurrency(summary.overdue_amount)}
            </div>
            <p className="text-xs text-rose-600 font-medium mt-1">
              {summary.overdue_count} invoice{summary.overdue_count === 1 ? '' : 's'} past due date
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Monthly Revenue & Collections</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison of total invoiced vs payments received
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
              <span className="text-slate-600">Invoiced</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
              <span className="text-slate-600">Paid</span>
            </div>
          </div>
        </div>

        {monthly_revenue.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            No billing history recorded yet.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-3 items-end h-48 border-b border-slate-100 pb-3">
              {monthly_revenue.map((m, idx) => {
                const invHeightPct = Math.round((m.invoiced / maxMonthlyVal) * 100);
                const paidHeightPct = Math.round((m.paid / maxMonthlyVal) * 100);

                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-12 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                      <div>Invoiced: {formatCurrency(m.invoiced)}</div>
                      <div>Paid: {formatCurrency(m.paid)}</div>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      <div
                        style={{ height: `${Math.max(4, invHeightPct)}%` }}
                        className="w-3.5 bg-blue-600 rounded-t-xs hover:bg-blue-500 transition-all"
                      />
                      <div
                        style={{ height: `${Math.max(4, paidHeightPct)}%` }}
                        className="w-3.5 bg-emerald-500 rounded-t-xs hover:bg-emerald-400 transition-all"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {m.month.split('-')[1] || m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Recent Invoices</h2>
          </div>
          <button
            onClick={() => onNavigateToTab('invoices')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View All ({summary.active_invoices_count})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent_invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onViewInvoice(inv.id)}
                      className="font-mono font-semibold text-blue-600 hover:underline flex items-center gap-1.5"
                    >
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span>{inv.invoice_number}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{inv.client?.name}</div>
                    <div className="text-xs text-slate-500">{inv.client?.company}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {formatDate(inv.issue_date)}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {formatDate(inv.due_date)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900 font-mono text-sm">
                    {formatCurrency(inv.total, inv.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onViewInvoice(inv.id)}
                        title="View Invoice"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(inv)}
                        title="Download PDF"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {inv.status !== 'paid' && inv.status !== 'void' && (
                        <button
                          onClick={() => handleQuickMarkPaid(inv)}
                          title="Mark as Paid"
                          className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  Download,
  Eye,
  CheckCircle,
  Ban,
  Send,
  Hash,
  Copy,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Invoice, InvoiceStatus } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

interface InvoicesListPageProps {
  onOpenCreateInvoice: () => void;
  onViewInvoice: (id: number) => void;
}

export const InvoicesListPage: React.FC<InvoicesListPageProps> = ({
  onOpenCreateInvoice,
  onViewInvoice,
}) => {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Void confirmation modal state
  const [voidingInvoice, setVoidingInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.getInvoices({
        search,
        status: statusFilter,
        page,
        page_size: 15,
      });
      setInvoices(res.results);
      setTotalPages(res.total_pages);
      setTotalCount(res.count);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter, page]);

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    showToast(`Copied ${num} to clipboard`, 'info');
  };

  const handleMarkPaid = async (inv: Invoice) => {
    try {
      await api.markPaid(inv.id);
      showToast(`Invoice ${inv.invoice_number} marked as Paid`, 'success');
      fetchInvoices();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMarkSent = async (inv: Invoice) => {
    try {
      await api.markSent(inv.id);
      showToast(`Invoice ${inv.invoice_number} marked as Sent`, 'success');
      fetchInvoices();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidingInvoice) return;
    try {
      await api.voidInvoice(voidingInvoice.id);
      showToast(`Invoice ${voidingInvoice.invoice_number} has been voided`, 'info');
      setVoidingInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const statusTabs: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Drafts' },
    { id: 'sent', label: 'Sent' },
    { id: 'paid', label: 'Paid' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'void', label: 'Voided' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, manage, download PDFs, and monitor sequential invoice numbers
          </p>
        </div>
        <button
          onClick={onOpenCreateInvoice}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        {/* Status Tab Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by invoice #, client name, or company..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center font-medium">
            Showing {invoices.length} of {totalCount} records
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-base font-semibold text-slate-800">No invoices found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No matching records for current query. Create a new invoice to assign the next sequential number.
            </p>
            <button
              onClick={onOpenCreateInvoice}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Invoice</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Invoice Number</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3">Issue Date</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Invoice Number with Monospace & Copy */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewInvoice(inv.id)}
                          className="font-mono font-bold text-slate-900 hover:text-blue-600 hover:underline tracking-tight flex items-center gap-1"
                        >
                          <Hash className="w-3.5 h-3.5 text-blue-500" />
                          <span>{inv.invoice_number}</span>
                        </button>
                        <button
                          onClick={() => handleCopyNumber(inv.invoice_number)}
                          title="Copy Number"
                          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{inv.client?.name}</div>
                      <div className="text-xs text-slate-500">{inv.client?.company || inv.client?.email}</div>
                    </td>

                    {/* Dates */}
                    <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                      {formatDate(inv.issue_date)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                      {formatDate(inv.due_date)}
                    </td>

                    {/* Total Amount */}
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={inv.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onViewInvoice(inv.id)}
                          title="View & Preview"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={api.getPdfUrl(inv.id)}
                          title="Download PDF"
                          download
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleMarkSent(inv)}
                            title="Mark as Sent"
                            className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                          >
                            Send
                          </button>
                        )}

                        {inv.status !== 'paid' && inv.status !== 'void' && (
                          <button
                            onClick={() => handleMarkPaid(inv)}
                            title="Mark as Paid"
                            className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}

                        {inv.status !== 'void' && (
                          <button
                            onClick={() => setVoidingInvoice(inv)}
                            title="Void Invoice"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Void Confirmation Modal */}
      {voidingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Void Invoice {voidingInvoice.invoice_number}?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preserves numbering sequence for financial auditing
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                No Number Reuse Guarantee
              </p>
              <p className="mt-1">
                Voiding marks this invoice as canceled but <strong>never</strong> deletes the record or frees the invoice number for reuse. The next invoice created will continue strictly sequentially.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setVoidingInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
              >
                Yes, Void Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

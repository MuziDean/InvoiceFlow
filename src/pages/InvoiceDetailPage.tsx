import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  CheckCircle,
  Send,
  Ban,
  Edit,
  Hash,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  Copy,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import { BusinessSettings, Invoice } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

interface InvoiceDetailPageProps {
  invoiceId: number;
  onBack: () => void;
  onEdit: (invoice: Invoice) => void;
}

export const InvoiceDetailPage: React.FC<InvoiceDetailPageProps> = ({
  invoiceId,
  onBack,
  onEdit,
}) => {
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const [invRes, setRes] = await Promise.all([
        api.getInvoice(invoiceId),
        api.getSettings(),
      ]);
      setInvoice(invRes);
      setSettings(setRes);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [invoiceId]);

  const handleMarkPaid = async () => {
    if (!invoice) return;
    try {
      const res = await api.markPaid(invoice.id);
      setInvoice(res.invoice);
      showToast(`Invoice ${invoice.invoice_number} marked as Paid!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMarkSent = async () => {
    if (!invoice) return;
    try {
      const res = await api.markSent(invoice.id);
      setInvoice(res.invoice);
      showToast(`Invoice ${invoice.invoice_number} marked as Sent!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleVoid = async () => {
    if (!invoice) return;
    if (confirm(`Are you sure you want to void ${invoice.invoice_number}? The number will remain recorded for compliance.`)) {
      try {
        const res = await api.voidInvoice(invoice.id);
        setInvoice(res.invoice);
        showToast(`Invoice ${invoice.invoice_number} voided`, 'info');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyNumber = () => {
    if (invoice) {
      navigator.clipboard.writeText(invoice.invoice_number);
      showToast(`Copied ${invoice.invoice_number} to clipboard`, 'info');
    }
  };

  if (loading || !invoice || !settings) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-28"></div>
        <div className="h-96 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  const isPastDue = invoice.status === 'overdue' || (invoice.status === 'sent' && new Date(invoice.due_date) < new Date());
  const logoAlignment = settings.logo_position === 'center'
    ? 'justify-center'
    : settings.logo_position === 'right' ? 'justify-end' : 'justify-start';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* Action Bar (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Official PDF */}
          <a
            href={api.getPdfUrl(invoice.id)}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </a>

          {invoice.status === 'paid' && (
            <a
              href={api.getReceiptUrl(invoice.id)}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Download Receipt</span>
            </a>
          )}

          {/* Print */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          {invoice.status !== 'void' && (
            <>
              {invoice.status === 'draft' && (
                <button
                  onClick={handleMarkSent}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Mark Sent</span>
                </button>
              )}

              {invoice.status !== 'paid' && (
                <button
                  onClick={handleMarkPaid}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Mark Paid</span>
                </button>
              )}

              <button
                onClick={() => onEdit(invoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              <button
                onClick={handleVoid}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Void</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Printable Invoice Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-8 lg:p-12 space-y-6 sm:space-y-8 print:border-none print:shadow-none print:p-0">
        {settings.logo && (
          <div className={`flex ${logoAlignment}`}>
            <img src={settings.logo} alt="Business logo" className="max-h-16 max-w-40 object-contain" />
          </div>
        )}

        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {settings.business_name}
            </h1>
            <div className="text-xs text-slate-500 mt-2 space-y-0.5 whitespace-pre-line leading-relaxed">
              <p>{settings.address}</p>
              <p>Email: {settings.email} · Phone: {settings.phone}</p>
              {settings.vat_number && <p>ZIMRA VAT Registration No: {settings.vat_number}</p>}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Commercial Invoice
            </div>
            <div className="flex items-center sm:justify-end gap-2">
              <span className="shrink-0 whitespace-nowrap font-mono text-base sm:text-lg font-bold text-slate-900">
                {invoice.invoice_number}
              </span>
              <button
                onClick={handleCopyNumber}
                title="Copy Invoice #"
                className="text-slate-400 hover:text-slate-600 print:hidden p-1 rounded hover:bg-slate-100"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>

        {/* Bill To & Meta Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-2">
          {/* Client Info */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Billed To
            </span>
            <div className="text-sm font-bold text-slate-900">
              {invoice.client?.name}
            </div>
            {invoice.client?.company && (
              <div className="text-xs font-medium text-slate-700 mt-0.5">
                {invoice.client.company}
              </div>
            )}
            {invoice.client?.address && (
              <div className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                {invoice.client.address}
              </div>
            )}
            {invoice.client?.email && (
              <div className="text-xs text-slate-500 mt-1">
                {invoice.client.email} · {invoice.client.phone}
              </div>
            )}
          </div>

          {/* Dates & Currency */}
          <div className="sm:text-right space-y-1.5 text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Invoice Details
            </span>
            <div className="flex justify-between sm:justify-end gap-4">
              <span className="text-slate-500">Issue Date:</span>
              <span className="font-semibold text-slate-900">{formatDate(invoice.issue_date)}</span>
            </div>
            <div className="flex justify-between sm:justify-end gap-4">
              <span className="text-slate-500">Due Date:</span>
              <span className={`font-semibold ${isPastDue ? 'text-rose-600 font-bold' : 'text-slate-900'}`}>
                {formatDate(invoice.due_date)} {isPastDue && '(Past Due)'}
              </span>
            </div>
            <div className="flex justify-between sm:justify-end gap-4">
              <span className="text-slate-500">Currency:</span>
              <span className="font-semibold text-slate-900">{invoice.currency}</span>
            </div>
            {(invoice.status === 'paid' || invoice.paid_at) && (
              <div className="flex justify-between sm:justify-end gap-4">
                <span className="text-slate-500">Paid Date:</span>
                <span className="font-semibold text-emerald-700">{formatDate(invoice.paid_at || invoice.created_at)}</span>
              </div>
            )}
            <div className="flex justify-between sm:justify-end gap-4">
              <span className="text-slate-500">Terms:</span>
              <span className="font-semibold text-slate-900">{invoice.terms || 'Net 14'}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <th className="border border-slate-300 py-3 px-4 text-left">Description</th>
                <th className="border border-slate-300 py-3 px-4 text-right">Quantity</th>
                <th className="border border-slate-300 py-3 px-4 text-right">Unit Price</th>
                <th className="border border-slate-300 py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(invoice.items || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="border border-slate-300 py-3.5 px-4 text-slate-900 font-medium">
                    {item.description}
                  </td>
                  <td className="border border-slate-300 py-3.5 px-4 text-right font-mono text-slate-600">
                    {Number(item.quantity).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 py-3.5 px-4 text-right font-mono text-slate-600">
                    {formatCurrency(item.unit_price, invoice.currency)}
                  </td>
                  <td className="border border-slate-300 py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(item.line_total, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200">
          <div className="space-y-4 max-w-md">
            {invoice.notes && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Notes
                </span>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Payment Instructions
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {invoice.terms}
                </p>
              </div>
            )}
          </div>

          <div className="sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </span>
            </div>

            {invoice.discount_value > 0 && (
              <div className="flex justify-between py-1 text-rose-600">
                <span>
                  Discount {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : '(Fixed)'}:
                </span>
                <span className="font-mono font-semibold">
                  -{formatCurrency(
                    invoice.discount_type === 'percentage'
                      ? (invoice.subtotal * invoice.discount_value) / 100
                      : invoice.discount_value,
                    invoice.currency
                  )}
                </span>
              </div>
            )}

            {invoice.tax_rate > 0 && (
              <div className="flex justify-between py-1 text-slate-600">
                <span>VAT ({invoice.tax_rate}%):</span>
                <span className="font-mono font-semibold text-slate-900">
                  +{formatCurrency(invoice.tax_amount, invoice.currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-slate-900 text-base">
              <span>Total Due:</span>
              <span className="font-mono text-xl text-blue-600">
                {formatCurrency(invoice.total, invoice.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        {settings.footer_note && (
          <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400 leading-relaxed">
            {settings.footer_note}
          </div>
        )}
      </div>
    </div>
  );
};

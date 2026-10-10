import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Hash,
  Download,
  Eye,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { BusinessSettings, Client, Invoice, InvoiceItem, Product } from '../types';
import { api } from '../api/client';
import { calculateInvoiceTotals, formatCurrency } from '../utils/format';
import { ClientModal } from '../components/ClientModal';
import { useToast } from '../components/Toast';

interface InvoiceFormPageProps {
  invoiceToEdit?: Invoice | null;
  onCancel: () => void;
  onInvoiceCreated: (invoice: Invoice) => void;
  onViewInvoice: (id: number) => void;
}

export const InvoiceFormPage: React.FC<InvoiceFormPageProps> = ({
  invoiceToEdit,
  onCancel,
  onInvoiceCreated,
  onViewInvoice,
}) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Success Modal State after creation
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);

  // Form Fields
  const todayStr = new Date().toISOString().split('T')[0];
  const [clientId, setClientId] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'draft' | 'sent' | 'paid'>('draft');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState(15.5);
  const [applyVat, setApplyVat] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');

  // Line items state
  const [items, setItems] = useState<
    Array<{ id?: number; description: string; quantity: number | string; unit_price: number | string }>
  >([
    { description: '', quantity: 1, unit_price: 0 },
  ]);

  const [formError, setFormError] = useState('');

  // Load initial settings and clients
  useEffect(() => {
    async function loadInitial() {
      try {
        const [settingsRes, clientsRes, productsRes] = await Promise.all([
          api.getSettings(),
          api.getClients(),
          api.getProducts(),
        ]);
        setSettings(settingsRes);
        setClients(clientsRes);
        setProducts(productsRes);

        if (!invoiceToEdit) {
          setCurrency(settingsRes.default_currency || 'USD');
          setTaxRate(settingsRes.vat_number ? (settingsRes.default_tax_rate ?? 15.5) : 0);
          setApplyVat(Boolean(settingsRes.vat_number));
          
          // Calculate default due date based on payment terms
          const days = settingsRes.default_payment_terms_days || 14;
          const due = new Date();
          due.setDate(due.getDate() + days);
          setDueDate(due.toISOString().split('T')[0]);
          setTerms(`Net ${days} days from invoice date.`);
          setNotes(settingsRes.footer_note || '');
          if (clientsRes.length > 0) {
            setClientId(clientsRes[0].id);
          }
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
    loadInitial();
  }, []);

  // Hydrate if editing
  useEffect(() => {
    if (invoiceToEdit) {
      setClientId(invoiceToEdit.client_id);
      setIssueDate(invoiceToEdit.issue_date);
      setDueDate(invoiceToEdit.due_date);
      setStatus(invoiceToEdit.status as any);
      setCurrency(invoiceToEdit.currency);
      setTaxRate(invoiceToEdit.tax_rate);
      setApplyVat(invoiceToEdit.tax_rate > 0);
      setDiscountType(invoiceToEdit.discount_type);
      setDiscountValue(invoiceToEdit.discount_value);
      setNotes(invoiceToEdit.notes || '');
      setTerms(invoiceToEdit.terms || '');
      if (invoiceToEdit.items && invoiceToEdit.items.length > 0) {
        setItems(
          invoiceToEdit.items.map((i) => ({
            id: i.id,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
          }))
        );
      }
    }
  }, [invoiceToEdit]);

  // Live Totals Calculation
  const totals = calculateInvoiceTotals(
    items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
    })),
    discountType,
    discountValue,
    applyVat ? taxRate : 0
  );

  const handleApplyVatChange = (checked: boolean) => {
    setApplyVat(checked);
    // If ticking VAT but no usable rate is set, fall back to the Settings default
    if (checked && !(Number(taxRate) > 0)) {
      setTaxRate(settings?.default_tax_rate ?? 15.5);
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showToast('An invoice must have at least one line item', 'info');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleTermsPreset = (days: number) => {
    const d = new Date(issueDate || todayStr);
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split('T')[0]);
    setTerms(`Payment due within ${days} days (Net ${days}).`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!clientId) {
      setFormError('Please select or create a client.');
      return;
    }
    if (!issueDate) {
      setFormError('Please set an issue date.');
      return;
    }
    if (!dueDate) {
      setFormError('Please set a due date.');
      return;
    }
    if (new Date(dueDate) < new Date(issueDate)) {
      setFormError('Due date cannot be before issue date.');
      return;
    }
    if (items.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.description.trim()) {
        setFormError(`Line item #${i + 1} is missing a description.`);
        return;
      }
      if (Number(it.quantity) <= 0) {
        setFormError(`Line item #${i + 1} must have a quantity greater than 0.`);
        return;
      }
      if (Number(it.unit_price) < 0) {
        setFormError(`Line item #${i + 1} unit price cannot be negative.`);
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        client_id: Number(clientId),
        issue_date: issueDate,
        due_date: dueDate,
        status,
        currency,
        tax_rate: applyVat ? Number(taxRate) || 0 : 0,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        notes,
        terms,
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      };

      if (invoiceToEdit) {
        const updated = await api.updateInvoice(invoiceToEdit.id, payload);
        showToast(`Invoice ${updated.invoice_number} updated`, 'success');
        onInvoiceCreated(updated);
      } else {
        const created = await api.createInvoice(payload);
        setCreatedInvoice(created);
        showToast(
          `Sequential invoice number ${created.invoice_number} assigned!`,
          'success',
          'Invoice Created'
        );
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save invoice');
      showToast(err.message || 'Failed to save invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </button>
        <div className="text-xs text-slate-500 font-medium">
          {invoiceToEdit ? `Editing Invoice ${invoiceToEdit.invoice_number}` : 'New Invoice Draft'}
        </div>
      </div>

      {/* Prominent Auto-Number Notice Banner */}
      {!invoiceToEdit ? (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-blue-900">
                Automatic Invoice Numbering Active
              </h2>
              <span className="text-[10px] font-mono bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded font-semibold">
                Expected: {settings?.next_invoice_number || 'INV-2026-0013'}
              </span>
            </div>
            <p className="text-xs text-blue-700/90 mt-1 leading-relaxed">
              You do not need to enter an invoice number. Upon submission, the server will atomically generate the next collision-free sequential number matching your configured format. Once assigned, numbers cannot be skipped or edited.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Hash className="w-5 h-5 text-slate-600" />
            <div>
              <span className="text-xs text-slate-500 font-medium">Assigned Invoice Number</span>
              <div className="font-mono text-base font-bold text-slate-900">
                {invoiceToEdit.invoice_number}
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-200 text-slate-700 rounded">
            Read-Only (Immutable)
          </span>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Date Details Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Client & Payment Terms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select Client <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Client</span>
                </button>
              </div>

              <select
                value={clientId}
                onChange={(e) => setClientId(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Choose a client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </option>
                ))}
              </select>

              {clientId && (
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {(() => {
                    const sel = clients.find((c) => c.id === clientId);
                    if (!sel) return null;
                    return (
                      <div>
                        <div className="font-semibold text-slate-800">{sel.company || sel.name}</div>
                        <div>{sel.email} · {sel.phone}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{sel.address}</div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Dates & Status */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Issue Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Terms Presets */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Quick presets:</span>
                <button
                  type="button"
                  onClick={() => handleTermsPreset(0)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  Due on Receipt
                </button>
                <button
                  type="button"
                  onClick={() => handleTermsPreset(14)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  Net 14
                </button>
                <button
                  type="button"
                  onClick={() => handleTermsPreset(30)}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  Net 30
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="ZWG">Zimbabwe Gold (ZWG / ZiG)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Line Items Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Line Items
              </h2>
              <p className="text-xs text-slate-500">
                Itemize deliverables, billable hours, or services
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="overflow-x-auto contain-paint rounded-md border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                  <th scope="col" className="border border-slate-300 px-3 py-3 text-left">Product / Description</th>
                  <th scope="col" className="w-28 border border-slate-300 px-3 py-3 text-right">Quantity</th>
                  <th scope="col" className="w-40 border border-slate-300 px-3 py-3 text-right">Unit Price ({currency})</th>
                  <th scope="col" className="w-36 border border-slate-300 px-3 py-3 text-right">Amount</th>
                  <th scope="col" className="w-12 border border-slate-300 px-2 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => {
                  const quantity = Number(item.quantity) || 0;
                  const unitPrice = Number(item.unit_price) || 0;
                  const lineTotal = Math.round(quantity * unitPrice * 100) / 100;

                  return (
                    <tr key={index} className="bg-white hover:bg-slate-50/70">
                      <td className="border border-slate-300 px-3 py-2">
                        <div className="space-y-2">
                          {products.some((product) => product.currency === currency) && (
                            <select
                              aria-label={`Choose a saved product for line item ${index + 1}`}
                              value={products.find((product) => product.currency === currency && product.name.toLocaleLowerCase() === item.description.trim().toLocaleLowerCase())?.id ?? ''}
                              onChange={(event) => {
                                const selectedProduct = products.find((product) => product.id === Number(event.target.value));
                                if (!selectedProduct) return;
                                setItems((currentItems) => currentItems.map((currentItem, itemIndex) =>
                                  itemIndex === index
                                    ? { ...currentItem, description: selectedProduct.name, unit_price: selectedProduct.unit_price }
                                    : currentItem
                                ));
                              }}
                              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Choose a saved product</option>
                              {products.filter((product) => product.currency === currency).map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} · {formatCurrency(product.unit_price, product.currency)}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            required
                            aria-label={`Description for line item ${index + 1}`}
                            placeholder="Product or service description"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            className="w-full min-w-64 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-300 px-3 py-2">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          aria-label={`Quantity for line item ${index + 1}`}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full px-2 py-2 text-right border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </td>
                      <td className="border border-slate-300 px-3 py-2">
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          aria-label={`Unit price for line item ${index + 1}`}
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="w-full px-2 py-2 text-right border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono text-sm font-semibold text-slate-800">
                        {formatCurrency(lineTotal, currency)}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          aria-label={`Remove line item ${index + 1}`}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-lg text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Item Row</span>
          </button>
        </div>

        {/* Calculations & Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Notes & Terms */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Terms & Remittance
              </label>
              <input
                type="text"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="e.g. Net 30. Wire transfer to Acme Bank..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes / Client Message
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thank you for partnering with us!"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Totals Summary Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
              Live Total Breakdown
            </h3>

            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(totals.subtotal, currency)}
              </span>
            </div>

            {/* Discount Row */}
            <div className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600">Discount:</span>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-slate-50"
                >
                  <option value="percentage">%</option>
                  <option value="fixed">Fixed</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-16 px-1.5 py-0.5 text-xs border border-slate-300 rounded text-right font-mono"
                />
              </div>
              <span className="font-mono text-rose-600 font-semibold">
                -{formatCurrency(totals.discountAmount, currency)}
              </span>
            </div>

            {/* VAT Tick Box & Rate Row */}
            <div className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyVat}
                    disabled={!settings?.vat_number}
                    onChange={(e) => handleApplyVatChange(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className={`font-medium ${settings?.vat_number ? 'text-slate-600' : 'text-slate-400'}`}>
                    Apply VAT
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className={`text-slate-600 ${applyVat ? '' : 'opacity-50'}`}>Rate (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    disabled={!applyVat || !settings?.vat_number}
                    className="w-16 px-1.5 py-0.5 text-xs border border-slate-300 rounded text-right font-mono disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <span className="font-mono font-semibold text-slate-900">
                +{formatCurrency(totals.taxAmount, currency)}
              </span>
            </div>
            {!settings?.vat_number && (
              <p className="text-[11px] text-slate-500">Add the ZIMRA VAT registration number in Settings to enable VAT on this invoice.</p>
            )}

            {/* Final Grand Total */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">Grand Total Due:</span>
              <span className="font-mono text-xl font-bold text-blue-600">
                {formatCurrency(totals.total, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{invoiceToEdit ? 'Save Changes' : 'Create Invoice & Assign Number'}</span>
          </button>
        </div>
      </form>

      {/* Inline Client Creation Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onClientSaved={(newClient) => {
          setClients((prev) => [...prev, newClient]);
          setClientId(newClient.id);
        }}
      />

      {/* Post-Creation Success Modal with Generated Number */}
      {createdInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-7 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                Guaranteed Sequential Mintage
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">
                Invoice Created Successfully!
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Your new invoice has been registered and assigned an immutable sequential number.
              </p>
            </div>

            {/* Large Prominent Assigned Number Display */}
            <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Assigned Invoice Number
              </div>
              <div className="font-mono text-2xl font-bold text-blue-400 tracking-wider">
                {createdInvoice.invoice_number}
              </div>
              <div className="text-[11px] text-slate-400">
                Amount: {formatCurrency(createdInvoice.total, createdInvoice.currency)} · Status: {createdInvoice.status.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  onInvoiceCreated(createdInvoice);
                  onViewInvoice(createdInvoice.id);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>View & Print</span>
              </button>
              <a
                href={api.getPdfUrl(createdInvoice.id)}
                download
                onClick={() => {
                  onInvoiceCreated(createdInvoice);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Hash,
  ShieldCheck,
  Loader2,
  Lock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { BusinessSettings } from '../types';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

interface SettingsPageProps {
  onSettingsUpdated: () => void;
  onClearDemoData: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onSettingsUpdated,
  onClearDemoData,
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // Form states
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [logo, setLogo] = useState('');
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right'>('left');
  const [vatNumber, setVatNumber] = useState('');
  const [logoError, setLogoError] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [defaultTaxRate, setDefaultTaxRate] = useState(15.5);
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(14);
  const [footerNote, setFooterNote] = useState('');

  // Numbering engine states
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [includeYear, setIncludeYear] = useState(true);
  const [zeroPadding, setZeroPadding] = useState(4);
  const [separator, setSeparator] = useState('-');

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const data = await api.getSettings();
        setSettings(data);
        setBusinessName(data.business_name);
        setAddress(data.address);
        setEmail(data.email);
        setPhone(data.phone);
        setLogo(data.logo || '');
        setLogoPosition(data.logo_position || 'left');
        setVatNumber(data.vat_number || '');
        setDefaultCurrency(data.default_currency || 'USD');
        setDefaultTaxRate(data.default_tax_rate ?? 15.5);
        setDefaultPaymentTermsDays(data.default_payment_terms_days ?? 14);
        setFooterNote(data.footer_note || '');
        setInvoicePrefix(data.invoice_prefix || 'INV');
        setIncludeYear(Boolean(data.include_year));
        setZeroPadding(data.zero_padding || 4);
        setSeparator(data.separator ?? '-');
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Compute live client-side preview for the next invoice number based on form inputs
  const currentYear = new Date().getFullYear();
  const sampleNextNumber = 13; // or the counter preview
  const previewPadded = String(sampleNextNumber).padStart(Number(zeroPadding) || 4, '0');
  const livePreview = includeYear
    ? `${invoicePrefix || 'INV'}${separator}${currentYear}${separator}${previewPadded}`
    : `${invoicePrefix || 'INV'}${separator}${previewPadded}`;

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('Choose a PNG or JPEG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo images must be 2 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogo(reader.result);
        setLogoError('');
      }
    };
    reader.onerror = () => setLogoError('Could not read that image. Please try another file.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateSettings({
        business_name: businessName.trim(),
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
        logo,
        logo_position: logoPosition,
        vat_number: vatNumber.trim(),
        default_currency: defaultCurrency,
        default_tax_rate: Number(defaultTaxRate) || 0,
        default_payment_terms_days: Number(defaultPaymentTermsDays) || 14,
        footer_note: footerNote.trim(),
        invoice_prefix: invoicePrefix.trim() || 'INV',
        include_year: includeYear,
        zero_padding: Number(zeroPadding) || 4,
        separator,
      });
      setSettings(updated);
      showToast('Settings & numbering rules saved successfully!', 'success');
      onSettingsUpdated();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-4xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Settings & Numbering Configuration
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure business details, currency defaults, and customize the automatic invoice numbering algorithm
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: Automatic Invoice Numbering Engine (The Core Feature!) */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 p-6 text-white">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-400/30">
                <Hash className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Automatic Invoice Numbering Format
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-2xl">
              Invoices are issued numbers automatically on creation. The server enforces concurrency locks to eliminate collisions or duplicate IDs. Once assigned, numbers cannot be manually overridden.
            </p>

            {/* LIVE PREVIEW BOX */}
            <div className="mt-5 p-4 bg-slate-950/80 rounded-xl border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Interactive Live Preview (Next Mintage)
                </span>
                <div className="font-mono text-2xl font-bold text-blue-400 tracking-wider mt-0.5">
                  {livePreview}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Duplicates Guaranteed</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Prefix */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number Prefix
                </label>
                <input
                  type="text"
                  required
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. INV, BILL, ACME"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Alphanumeric prefix prepended to all invoices
                </span>
              </div>

              {/* Separator */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Separator Character
                </label>
                <select
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="/">Slash (/)</option>
                  <option value=".">Period (.)</option>
                  <option value="_">Underscore (_)</option>
                  <option value="">None (Empty)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Delimiter between prefix, year, and sequential sequence
                </span>
              </div>

              {/* Zero-Padding */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zero-Padding Length
                </label>
                <select
                  value={zeroPadding}
                  onChange={(e) => setZeroPadding(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={3}>3 Digits (e.g. 001)</option>
                  <option value={4}>4 Digits (e.g. 0001)</option>
                  <option value={5}>5 Digits (e.g. 00001)</option>
                  <option value={6}>6 Digits (e.g. 000001)</option>
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Ensures uniform length and alphanumeric sorting
                </span>
              </div>

              {/* Include Year Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Include Year & Annual Reset
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeYear}
                      onChange={(e) => setIncludeYear(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-xs font-medium text-slate-700">
                    {includeYear ? 'Enabled (resets each January 1st)' : 'Disabled (continuous global sequence)'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1.5 block">
                  When enabled, numbers include the 4-digit year and the counter automatically resets for each new calendar year.
                </span>
              </div>
            </div>

            {/* Compliance Note */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Immutable Audit Trail: </span>
                Voiding or deleting an invoice will never free up its sequential number for reuse. The next invoice will strictly continue the sequence, maintaining strict accounting integrity.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Business Profile */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-900">
              Business Profile & Invoice Header
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Legal Business / Trading Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Acme Digital Solutions Ltd"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Billing Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@acme.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 234-5678"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Address (appears on invoice)
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, City, State, Country"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="vat-number">
                ZIMRA VAT Registration Number
              </label>
              <input
                id="vat-number"
                type="text"
                maxLength={80}
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="Enter VAT number, if registered"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Only VAT-registered operators may charge VAT. New invoices use this rate only when a registration number is saved.
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="business-logo">
                  Business Logo
                </label>
                <input
                  id="business-logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoChange}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-md file:bg-slate-100 file:text-slate-700 file:font-semibold hover:file:bg-slate-200"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">PNG or JPEG, up to 2 MB.</span>
              </div>

              {logoError && <p role="alert" className="text-xs text-rose-600">{logoError}</p>}

              <div className="flex items-center gap-3">
                {logo ? (
                  <img
                    src={logo}
                    alt="Business logo preview"
                    className="w-16 h-16 rounded-md border border-slate-200 bg-white object-contain p-1"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                {logo && (
                  <button
                    type="button"
                    onClick={() => { setLogo(''); setLogoError(''); }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove logo
                  </button>
                )}
              </div>

              <fieldset>
                <legend className="block text-xs font-semibold text-slate-700 mb-1.5">Logo Position on Invoice</legend>
                <div className="inline-flex rounded-md border border-slate-300 bg-white p-1 gap-1">
                  {([
                    ['left', 'Left', AlignLeft],
                    ['center', 'Center', AlignCenter],
                    ['right', 'Right', AlignRight],
                  ] as const).map(([position, label, Icon]) => (
                    <button
                      key={position}
                      type="button"
                      aria-pressed={logoPosition === position}
                      onClick={() => setLogoPosition(position)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium ${logoPosition === position ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {/* SECTION 3: Defaults & Terms */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
          <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
            Billing Defaults
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Currency
              </label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
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
                Default VAT Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Payment Terms (Days)
              </label>
              <input
                type="number"
                min="0"
                value={defaultPaymentTermsDays}
                onChange={(e) => setDefaultPaymentTermsDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice Footer Note / Remittance Notice
            </label>
            <input
              type="text"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              placeholder="Thank you for your business! Please remit payment within terms stated."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Save Bar */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onClearDemoData}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 px-3 py-2 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Demo Data</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};

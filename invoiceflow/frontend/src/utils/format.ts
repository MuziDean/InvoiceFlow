import { InvoiceItem } from '../types';

export function formatCurrency(amount: number | undefined | null, currency = 'USD'): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unit_price: number }>,
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  taxRate: number
) {
  let subtotal = 0;
  for (const item of items) {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unit_price) || 0;
    subtotal += Math.round(q * p * 100) / 100;
  }
  subtotal = Math.round(subtotal * 100) / 100;

  const discVal = Number(discountValue) || 0;
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = Math.round(((subtotal * discVal) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(subtotal, discVal);
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = Number(taxRate) || 0;
  const taxAmount = Math.round(((taxableAmount * tax) / 100) * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    total,
  };
}

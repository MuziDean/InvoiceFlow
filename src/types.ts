export interface BusinessSettings {
  id: number;
  business_name: string;
  address: string;
  email: string;
  phone: string;
  logo?: string;
  logo_position: 'left' | 'center' | 'right';
  vat_number: string;
  default_currency: string;
  default_tax_rate: number;
  default_payment_terms_days: number;
  invoice_prefix: string;
  include_year: boolean;
  zero_padding: number;
  separator: string;
  footer_note?: string;
  next_invoice_number?: string;
}

export interface AuthenticatedUser {
  id: number;
  workspace_id: number;
  email: string;
  business_name: string;
}

export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  created_at: string;
  invoice_count?: number;
  total_billed?: number;
}

export interface Product {
  id: number;
  name: string;
  currency: string;
  unit_price: number;
  updated_at: string;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  client?: Client;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  paid_at: string | null;
  currency: string;
  tax_rate: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  notes?: string;
  terms?: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
  items?: InvoiceItem[];
}

export interface DashboardSummary {
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  overdue_amount: number;
  overdue_count: number;
  active_invoices_count: number;
  draft_count: number;
}

export interface MonthlyRevenue {
  month: string;
  invoiced: number;
  paid: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  monthly_revenue: MonthlyRevenue[];
  recent_invoices: Invoice[];
  next_invoice_number: string;
}

export interface InvoicesResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: Invoice[];
}

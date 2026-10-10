import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'path';

export interface BusinessSettings {
  id: number;
  business_name: string;
  address: string;
  email: string;
  phone: string;
  logo: string;
  logo_position: 'left' | 'center' | 'right';
  vat_number: string;
  default_currency: string;
  default_tax_rate: number;
  default_payment_terms_days: number;
  invoice_prefix: string;
  include_year: boolean;
  zero_padding: number;
  separator: string;
  footer_note: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  created_at: string;
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

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  client?: Client;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  paid_at: string | null;
  currency: string;
  tax_rate: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  notes: string;
  terms: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
  items?: InvoiceItem[];
}

const dbPath = path.resolve(process.env.INVOICEFLOW_DB_PATH || 'invoiceflow.sqlite');
const databaseContext = new AsyncLocalStorage<DatabaseSync>();
const baseDatabase = new DatabaseSync(dbPath);
const workspaceDatabases = new Map<number, DatabaseSync>([[1, baseDatabase]]);

function initializeDatabase(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      business_name TEXT NOT NULL,
      address TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      logo TEXT,
      logo_position TEXT NOT NULL DEFAULT 'left',
      vat_number TEXT NOT NULL DEFAULT '',
      default_currency TEXT NOT NULL DEFAULT 'USD',
      default_tax_rate REAL NOT NULL DEFAULT 15.5,
      default_payment_terms_days INTEGER NOT NULL DEFAULT 14,
      invoice_prefix TEXT NOT NULL DEFAULT 'INV',
      include_year INTEGER NOT NULL DEFAULT 1,
      zero_padding INTEGER NOT NULL DEFAULT 4,
      separator TEXT NOT NULL DEFAULT '-',
      footer_note TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      company TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      currency TEXT NOT NULL,
      unit_price REAL NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(name, currency)
    );

    CREATE TABLE IF NOT EXISTS invoice_counters (
      year INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      paid_at TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      tax_rate REAL NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0,
      notes TEXT,
      terms TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL
    );
  `);

  const settingsColumns = database.prepare('PRAGMA table_info(settings)').all() as Array<{ name: string }>;
  if (!settingsColumns.some((column) => column.name === 'logo_position')) {
    database.exec("ALTER TABLE settings ADD COLUMN logo_position TEXT NOT NULL DEFAULT 'left'");
    database.exec('UPDATE settings SET default_tax_rate = 15.5 WHERE default_tax_rate IN (10, 15)');
  }
  if (!settingsColumns.some((column) => column.name === 'vat_number')) {
    database.exec("ALTER TABLE settings ADD COLUMN vat_number TEXT NOT NULL DEFAULT ''");
  }
  database.exec("UPDATE settings SET default_tax_rate = 15.5 WHERE default_tax_rate = 15 AND COALESCE(vat_number, '') = ''");
  const invoiceColumns = database.prepare('PRAGMA table_info(invoices)').all() as Array<{ name: string }>;
  if (!invoiceColumns.some((column) => column.name === 'paid_at')) {
    database.exec('ALTER TABLE invoices ADD COLUMN paid_at TEXT');
  }
  database.exec("UPDATE invoices SET paid_at = COALESCE(created_at, datetime('now')) WHERE status = 'paid' AND (paid_at IS NULL OR paid_at = '')");
}

initializeDatabase(baseDatabase);

export const db = new Proxy(baseDatabase, {
  get(target, property) {
    const database = databaseContext.getStore() || target;
    const value = Reflect.get(database, property, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
}) as DatabaseSync;

export function getWorkspaceDatabase(workspaceId: number) {
  const existing = workspaceDatabases.get(workspaceId);
  if (existing) return existing;

  const workspacePath = path.resolve(path.dirname(dbPath), `invoiceflow-workspace-${workspaceId}.sqlite`);
  const database = new DatabaseSync(workspacePath);
  initializeDatabase(database);
  workspaceDatabases.set(workspaceId, database);
  return database;
}

export function withWorkspaceDatabase<T>(database: DatabaseSync, callback: () => T) {
  return databaseContext.run(database, callback);
}

export function getSettings(): BusinessSettings {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
  if (!row) {
    const defaultSettings = {
      business_name: 'Acme Digital Solutions Ltd',
      address: '742 Evergreen Terrace, Suite 400\nSan Francisco, CA 94107',
      email: 'billing@acmedigital.io',
      phone: '+1 (555) 234-5678',
      logo: '',
      logo_position: 'left' as const,
      vat_number: '',
      default_currency: 'USD',
      default_tax_rate: 15.5,
      default_payment_terms_days: 14,
      invoice_prefix: 'INV',
      include_year: 1,
      zero_padding: 4,
      separator: '-',
      footer_note: 'Thank you for your business! Please remit payment within terms stated.',
    };
    db.prepare(`
      INSERT INTO settings (id, business_name, address, email, phone, logo, logo_position, vat_number, default_currency, default_tax_rate, default_payment_terms_days, invoice_prefix, include_year, zero_padding, separator, footer_note)
      VALUES (1, :business_name, :address, :email, :phone, :logo, :logo_position, :vat_number, :default_currency, :default_tax_rate, :default_payment_terms_days, :invoice_prefix, :include_year, :zero_padding, :separator, :footer_note)
    `).run(defaultSettings);
    return {
      id: 1,
      ...defaultSettings,
      include_year: true,
    };
  }
  return {
    ...row,
    include_year: Boolean(row.include_year),
  };
}

export function updateSettings(data: Partial<BusinessSettings>): BusinessSettings {
  const current = getSettings();
  const updated = {
    ...current,
    ...data,
    include_year: data.include_year !== undefined ? (data.include_year ? 1 : 0) : (current.include_year ? 1 : 0),
  };
  const { id: ignoredId, ...settingsValues } = updated;

  db.prepare(`
    UPDATE settings SET
      business_name = :business_name,
      address = :address,
      email = :email,
      phone = :phone,
      logo = :logo,
      logo_position = :logo_position,
      vat_number = :vat_number,
      default_currency = :default_currency,
      default_tax_rate = :default_tax_rate,
      default_payment_terms_days = :default_payment_terms_days,
      invoice_prefix = :invoice_prefix,
      include_year = :include_year,
      zero_padding = :zero_padding,
      separator = :separator,
      footer_note = :footer_note
    WHERE id = 1
  `).run(settingsValues);

  return getSettings();
}

export function getNextInvoiceNumberPreview(yearOverride?: number): string {
  const settings = getSettings();
  const currentYear = yearOverride || new Date().getFullYear();
  const counterYear = settings.include_year ? currentYear : 0;

  const counterRow = db.prepare('SELECT last_number FROM invoice_counters WHERE year = ?').get(counterYear) as any;
  const nextNumber = (counterRow?.last_number || 0) + 1;

  const padded = String(nextNumber).padStart(settings.zero_padding, '0');
  if (settings.include_year) {
    return `${settings.invoice_prefix}${settings.separator}${currentYear}${settings.separator}${padded}`;
  }
  return `${settings.invoice_prefix}${settings.separator}${padded}`;
}

export function generateNextInvoiceNumber(issueDate: string): string {
  const settings = getSettings();
  const issueYear = issueDate ? new Date(issueDate).getFullYear() : new Date().getFullYear();
  const counterYear = settings.include_year ? issueYear : 0;

  // Perform atomic select-and-increment
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT last_number FROM invoice_counters WHERE year = ?').get(counterYear) as any;
    let nextNum = 1;
    if (existing) {
      nextNum = existing.last_number + 1;
      db.prepare('UPDATE invoice_counters SET last_number = ? WHERE year = ?').run(nextNum, counterYear);
    } else {
      db.prepare('INSERT INTO invoice_counters (year, last_number) VALUES (?, ?)').run(counterYear, 1);
      nextNum = 1;
    }

    const padded = String(nextNum).padStart(settings.zero_padding, '0');
    let invoiceNumber: string;
    if (settings.include_year) {
      invoiceNumber = `${settings.invoice_prefix}${settings.separator}${counterYear}${settings.separator}${padded}`;
    } else {
      invoiceNumber = `${settings.invoice_prefix}${settings.separator}${padded}`;
    }

    db.exec('COMMIT');
    return invoiceNumber;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function autoUpdateOverdueInvoices() {
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    UPDATE invoices
    SET status = 'overdue'
    WHERE status IN ('sent') AND due_date < ?
  `).run(today);
}

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getSettings,
  updateSettings,
  getNextInvoiceNumberPreview,
  generateNextInvoiceNumber,
  getWorkspaceDatabase,
  withWorkspaceDatabase,
  autoUpdateOverdueInvoices,
  Invoice,
} from './src/server/db';
import { clearDemoData, seedDemoData } from './src/server/seed';
import { generateInvoicePdf, generateReceiptPdf } from './src/server/pdf';
import { createAccount, getSessionUser, login, revokeSession } from './src/server/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '4mb' }));

// Enable CORS for development and local testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const sessionCookieName = 'invoiceflow_session';

function readSessionToken(req: Request) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  return cookie?.slice(sessionCookieName.length + 1);
}

function setSessionCookie(res: Response, token: string) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`);
}

app.post('/api/auth/signup/', (req: Request, res: Response) => {
  const businessName = typeof req.body.business_name === 'string' ? req.body.business_name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (businessName.length < 2 || businessName.length > 120) {
    return res.status(400).json({ error: 'Business name must be between 2 and 120 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }

  try {
    const session = createAccount(businessName, email, password);
    withWorkspaceDatabase(getWorkspaceDatabase(session.user.workspace_id), () => {
      if (getSettings().business_name === 'Acme Digital Solutions Ltd') {
        updateSettings({ business_name: businessName.trim() });
      }
    });
    setSessionCookie(res, session.token);
    res.status(201).json({ user: session.user });
  } catch (err: any) {
    if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

app.post('/api/auth/login/', (req: Request, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const session = login(email, password);
  if (!session) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  setSessionCookie(res, session.token);
  res.json({ user: session.user });
});

app.get('/api/auth/me/', (req: Request, res: Response) => {
  res.json({ user: getSessionUser(readSessionToken(req)) });
});

app.post('/api/auth/logout/', (req: Request, res: Response) => {
  revokeSession(readSessionToken(req));
  res.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ message: 'Signed out.' });
});

app.use('/api', (req: Request, res: Response, next) => {
  const user = getSessionUser(readSessionToken(req));
  if (!user) {
    return res.status(401).json({ error: 'Sign in to access this workspace.' });
  }
  const workspaceDatabase = getWorkspaceDatabase(user.workspace_id);
  withWorkspaceDatabase(workspaceDatabase, () => next());
});

// ==========================================
// SETTINGS ENDPOINTS
// ==========================================
app.get('/api/settings/', (req: Request, res: Response) => {
  try {
    const settings = getSettings();
    const nextInvoiceNumber = getNextInvoiceNumberPreview();
    res.json({
      ...settings,
      next_invoice_number: nextInvoiceNumber,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/', (req: Request, res: Response) => {
  try {
    const { logo, logo_position, vat_number } = req.body;
    if (logo !== undefined) {
      if (typeof logo !== 'string') {
        return res.status(400).json({ error: 'Logo must be a PNG or JPEG image.' });
      }
      if (logo) {
        const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo);
        if (!match) {
          return res.status(400).json({ error: 'Logo must be a PNG or JPEG image.' });
        }

        const image = Buffer.from(match[2], 'base64');
        const isPng = match[1] === 'png'
          && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        const isJpeg = match[1] === 'jpeg'
          && image[0] === 0xff
          && image[1] === 0xd8
          && image[image.length - 2] === 0xff
          && image[image.length - 1] === 0xd9;

        if (image.length > 2 * 1024 * 1024 || (!isPng && !isJpeg)) {
          return res.status(400).json({ error: 'Upload a valid PNG or JPEG image up to 2 MB.' });
        }
      }
    }
    if (logo_position !== undefined && !['left', 'center', 'right'].includes(logo_position)) {
      return res.status(400).json({ error: 'Logo position must be left, center, or right.' });
    }
    if (vat_number !== undefined && (typeof vat_number !== 'string' || vat_number.length > 80)) {
      return res.status(400).json({ error: 'VAT registration number must be 80 characters or fewer.' });
    }

    const updated = updateSettings(req.body);
    const nextInvoiceNumber = getNextInvoiceNumberPreview();
    res.json({
      ...updated,
      next_invoice_number: nextInvoiceNumber,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// CLIENTS ENDPOINTS (Full CRUD)
// ==========================================
app.get('/api/clients/', (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').trim().toLowerCase();
    let query = 'SELECT * FROM clients';
    let params: any[] = [];
    if (search) {
      query += ' WHERE LOWER(name) LIKE ? OR LOWER(company) LIKE ? OR LOWER(email) LIKE ?';
      const term = `%${search}%`;
      params = [term, term, term];
    }
    query += ' ORDER BY name ASC';
    const clients = db.prepare(query).all(...params) as any[];

    // Add invoice counts and total billed for each client
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as invoice_count,
        COALESCE(SUM(CASE WHEN status != 'void' THEN total ELSE 0 END), 0) as total_billed
      FROM invoices WHERE client_id = ?
    `);

    const enriched = clients.map((c) => {
      const stats = statsStmt.get(c.id) as any;
      return {
        ...c,
        invoice_count: stats?.invoice_count || 0,
        total_billed: stats?.total_billed || 0,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clients/', (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, company } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Client name is required' });
    }
    const createdAt = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO clients (name, email, phone, address, company, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), email || '', phone || '', address || '', company || '', createdAt);

    const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/clients/:id/', (req: Request, res: Response) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clients/:id/', (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, company } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Client name is required' });
    }
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    db.prepare(`
      UPDATE clients SET
        name = ?,
        email = ?,
        phone = ?,
        address = ?,
        company = ?
      WHERE id = ?
    `).run(name.trim(), email || '', phone || '', address || '', company || '', req.params.id);

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/clients/:id/', (req: Request, res: Response) => {
  try {
    const invoiceCount = (db.prepare('SELECT COUNT(*) as count FROM invoices WHERE client_id = ?').get(req.params.id) as any).count;
    if (invoiceCount > 0) {
      return res.status(400).json({
        error: `Cannot delete client because they have ${invoiceCount} linked invoice(s). Archive or void those invoices first.`,
      });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/products/', (req: Request, res: Response) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY name COLLATE NOCASE ASC').all();
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function saveProductsToCatalog(items: Array<{ description: string; unit_price: number }>, currency: string) {
  const statement = db.prepare(`
    INSERT INTO products (name, currency, unit_price, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name, currency) DO UPDATE SET
      unit_price = excluded.unit_price,
      updated_at = excluded.updated_at
  `);
  const updatedAt = new Date().toISOString();
  for (const item of items) {
    const name = item.description.trim();
    if (name) statement.run(name, currency, Number(item.unit_price), updatedAt);
  }
}

// Helper function to hydrate an invoice with items and client
function getHydratedInvoice(id: number | string): Invoice | null {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
  if (!invoice) return null;

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(invoice.client_id) as any;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC').all(invoice.id) as any[];

  return {
    ...invoice,
    client,
    items,
  };
}

// ==========================================
// INVOICES ENDPOINTS
// ==========================================
app.get('/api/invoices/', (req: Request, res: Response) => {
  try {
    autoUpdateOverdueInvoices();

    const search = (req.query.search as string || '').trim().toLowerCase();
    const status = (req.query.status as string || '').trim();
    const clientId = req.query.client as string || '';
    const startDate = req.query.start_date as string || '';
    const endDate = req.query.end_date as string || '';

    let conditions: string[] = [];
    let params: any[] = [];

    if (status && status !== 'all') {
      conditions.push('inv.status = ?');
      params.push(status);
    }

    if (clientId) {
      conditions.push('inv.client_id = ?');
      params.push(Number(clientId));
    }

    if (startDate) {
      conditions.push('inv.issue_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('inv.issue_date <= ?');
      params.push(endDate);
    }

    if (search) {
      conditions.push('(LOWER(inv.invoice_number) LIKE ? OR LOWER(cl.name) LIKE ? OR LOWER(cl.company) LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM invoices inv
      JOIN clients cl ON inv.client_id = cl.id
      ${whereClause}
    `;
    const totalCount = (db.prepare(countQuery).get(...params) as any).total;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string || '20', 10)));
    const offset = (page - 1) * pageSize;

    const listQuery = `
      SELECT 
        inv.*,
        cl.name as client_name,
        cl.company as client_company,
        cl.email as client_email
      FROM invoices inv
      JOIN clients cl ON inv.client_id = cl.id
      ${whereClause}
      ORDER BY inv.id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(listQuery).all(...params, pageSize, offset) as any[];

    // Hydrate each row with items
    const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC');
    const results = rows.map((r) => {
      const items = itemsStmt.all(r.id);
      return {
        ...r,
        client: {
          id: r.client_id,
          name: r.client_name,
          company: r.client_company,
          email: r.client_email,
        },
        items,
      };
    });

    res.json({
      count: totalCount,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(totalCount / pageSize) || 1,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Invoice: CRITICAL CORE REQUIREMENT: Automatically assigns sequential number!
app.post('/api/invoices/', (req: Request, res: Response) => {
  try {
    const {
      client_id,
      issue_date,
      due_date,
      status = 'draft',
      currency = 'USD',
      tax_rate = 0,
      discount_type = 'percentage',
      discount_value = 0,
      notes = '',
      terms = '',
      items = [],
    } = req.body;

    // 1. Validation
    if (!client_id) {
      return res.status(400).json({ error: 'Client selection is required.' });
    }
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id);
    if (!client) {
      return res.status(400).json({ error: 'Selected client does not exist.' });
    }

    if (!issue_date) {
      return res.status(400).json({ error: 'Issue date is required.' });
    }
    if (!due_date) {
      return res.status(400).json({ error: 'Due date is required.' });
    }
    if (new Date(due_date) < new Date(issue_date)) {
      return res.status(400).json({ error: 'Due date cannot be earlier than issue date.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invoice must contain at least one line item.' });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || !item.description.trim()) {
        return res.status(400).json({ error: `Line item #${i + 1} requires a description.` });
      }
      if (item.quantity === undefined || Number(item.quantity) <= 0) {
        return res.status(400).json({ error: `Line item #${i + 1} quantity must be greater than 0.` });
      }
      if (item.unit_price === undefined || Number(item.unit_price) < 0) {
        return res.status(400).json({ error: `Line item #${i + 1} unit price cannot be negative.` });
      }
    }

    // 2. Server-side totals calculation
    let subtotal = 0;
    const computedItems = items.map((it: any) => {
      const qty = Number(it.quantity);
      const price = Number(it.unit_price);
      const line_total = Math.round(qty * price * 100) / 100;
      subtotal += line_total;
      return {
        description: it.description.trim(),
        quantity: qty,
        unit_price: price,
        line_total,
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;

    let discountAmount = 0;
    const discVal = Number(discount_value) || 0;
    if (discount_type === 'percentage') {
      discountAmount = Math.round(((subtotal * discVal) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, discVal);
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxRateNum = Number(tax_rate) || 0;
    if (taxRateNum > 0 && !getSettings().vat_number.trim()) {
      return res.status(400).json({ error: 'Add the ZIMRA VAT registration number in Settings before charging VAT.' });
    }
    const taxAmount = Math.round(((taxableAmount * taxRateNum) / 100) * 100) / 100;
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    // Determine initial status (auto-overdue if past due date and sent)
    let finalStatus = status;
    const today = new Date().toISOString().split('T')[0];
    if (finalStatus === 'sent' && due_date < today) {
      finalStatus = 'overdue';
    }

    // 3. ATOMIC NUMBER GENERATION & INSERTION
    // The user NEVER inputs invoice_number. Generated strictly server-side.
    const invoiceNumber = generateNextInvoiceNumber(issue_date);
    const createdAt = new Date().toISOString();
    const paidAt = finalStatus === 'paid' ? (req.body?.paid_at || createdAt) : null;

    const insertResult = db.prepare(`
      INSERT INTO invoices (
        invoice_number, client_id, issue_date, due_date, status, currency,
        tax_rate, discount_type, discount_value, notes, terms,
        subtotal, tax_amount, total, created_at, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceNumber,
      Number(client_id),
      issue_date,
      due_date,
      finalStatus,
      currency,
      taxRateNum,
      discount_type,
      discVal,
      notes,
      terms,
      subtotal,
      taxAmount,
      total,
      createdAt,
      paidAt
    );

    const invoiceId = Number(insertResult.lastInsertRowid);

    // Insert items
    const insertItemStmt = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of computedItems) {
      insertItemStmt.run(invoiceId, item.description, item.quantity, item.unit_price, item.line_total);
    }
    saveProductsToCatalog(computedItems, currency);

    const created = getHydratedInvoice(invoiceId);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/invoices/:id/', (req: Request, res: Response) => {
  try {
    autoUpdateOverdueInvoices();
    const invoice = getHydratedInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Invoice: Invoice number is READ-ONLY and immutable!
app.put('/api/invoices/:id/', (req: Request, res: Response) => {
  try {
    const existing = getHydratedInvoice(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (existing.status === 'void') {
      return res.status(400).json({ error: 'Voided invoices cannot be modified.' });
    }

    const {
      client_id = existing.client_id,
      issue_date = existing.issue_date,
      due_date = existing.due_date,
      status = existing.status,
      currency = existing.currency,
      tax_rate = existing.tax_rate,
      discount_type = existing.discount_type,
      discount_value = existing.discount_value,
      notes = existing.notes,
      terms = existing.terms,
      items = existing.items,
    } = req.body;

    if (new Date(due_date) < new Date(issue_date)) {
      return res.status(400).json({ error: 'Due date cannot be earlier than issue date.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invoice must contain at least one line item.' });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || !item.description.trim()) {
        return res.status(400).json({ error: `Line item #${i + 1} requires a description.` });
      }
      if (item.quantity === undefined || Number(item.quantity) <= 0) {
        return res.status(400).json({ error: `Line item #${i + 1} quantity must be greater than 0.` });
      }
      if (item.unit_price === undefined || Number(item.unit_price) < 0) {
        return res.status(400).json({ error: `Line item #${i + 1} unit price cannot be negative.` });
      }
    }

    let subtotal = 0;
    const computedItems = items.map((it: any) => {
      const qty = Number(it.quantity);
      const price = Number(it.unit_price);
      const line_total = Math.round(qty * price * 100) / 100;
      subtotal += line_total;
      return {
        description: it.description.trim(),
        quantity: qty,
        unit_price: price,
        line_total,
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;

    let discountAmount = 0;
    const discVal = Number(discount_value) || 0;
    if (discount_type === 'percentage') {
      discountAmount = Math.round(((subtotal * discVal) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, discVal);
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxRateNum = Number(tax_rate) || 0;
    if (taxRateNum > 0 && !getSettings().vat_number.trim()) {
      return res.status(400).json({ error: 'Add the ZIMRA VAT registration number in Settings before charging VAT.' });
    }
    const taxAmount = Math.round(((taxableAmount * taxRateNum) / 100) * 100) / 100;
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
    const paidAt = status === 'paid'
      ? (req.body?.paid_at || (existing.status === 'paid' && existing.paid_at ? existing.paid_at : new Date().toISOString()))
      : null;

    // Note: invoice_number is intentionally NEVER updated from req.body
    db.prepare(`
      UPDATE invoices SET
        client_id = ?,
        issue_date = ?,
        due_date = ?,
        status = ?,
        currency = ?,
        tax_rate = ?,
        discount_type = ?,
        discount_value = ?,
        notes = ?,
        terms = ?,
        subtotal = ?,
        tax_amount = ?,
        total = ?,
        paid_at = ?
      WHERE id = ?
    `).run(
      Number(client_id),
      issue_date,
      due_date,
      status,
      currency,
      taxRateNum,
      discount_type,
      discVal,
      notes,
      terms,
      subtotal,
      taxAmount,
      total,
      paidAt,
      existing.id
    );

    // Replace items
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(existing.id);
    const insertItemStmt = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of computedItems) {
      insertItemStmt.run(existing.id, item.description, item.quantity, item.unit_price, item.line_total);
    }
    saveProductsToCatalog(computedItems, currency);

    const updated = getHydratedInvoice(existing.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Void Invoice: Does NOT delete or reuse invoice number
app.post('/api/invoices/:id/void/', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    db.prepare("UPDATE invoices SET status = 'void' WHERE id = ?").run(req.params.id);
    const updated = getHydratedInvoice(req.params.id);
    res.json({ message: 'Invoice marked as void', invoice: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Mark Paid
app.post('/api/invoices/:id/mark-paid/', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (existing.status === 'void') {
      return res.status(400).json({ error: 'Voided invoices cannot be marked as paid.' });
    }
    const paidAt = req.body?.paid_at || (existing.status === 'paid' && existing.paid_at ? existing.paid_at : new Date().toISOString());
    db.prepare("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?").run(paidAt, req.params.id);
    const updated = getHydratedInvoice(req.params.id);
    res.json({ message: 'Invoice marked as paid', invoice: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Mark Sent
app.post('/api/invoices/:id/mark-sent/', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const today = new Date().toISOString().split('T')[0];
    const newStatus = existing.due_date < today ? 'overdue' : 'sent';
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, req.params.id);
    const updated = getHydratedInvoice(req.params.id);
    res.json({ message: 'Invoice marked as sent', invoice: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Download PDF
app.get('/api/invoices/:id/pdf/', (req: Request, res: Response) => {
  try {
    const invoice = getHydratedInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const settings = getSettings();
    generateInvoicePdf(invoice, settings, res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices/:id/receipt/', (req: Request, res: Response) => {
  try {
    const invoice = getHydratedInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (invoice.status !== 'paid') {
      return res.status(409).json({ error: 'A receipt is available only after the invoice is marked as paid.' });
    }
    if (!invoice.paid_at) {
      const paidDate = new Date().toISOString();
      db.prepare('UPDATE invoices SET paid_at = ? WHERE id = ?').run(paidDate, invoice.id);
      invoice.paid_at = paidDate;
    }
    generateReceiptPdf(invoice, getSettings(), res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DASHBOARD ENDPOINT
// ==========================================
app.get('/api/dashboard/', (req: Request, res: Response) => {
  try {
    autoUpdateOverdueInvoices();

    // Summary Metrics
    const metrics = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN status != 'void' THEN total ELSE 0 END), 0) as total_invoiced,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN total ELSE 0 END), 0) as total_overdue_amount,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN status != 'void' THEN 1 END) as active_invoices_count,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count
      FROM invoices
    `).get() as any;

    // Monthly breakdown (last 6 months)
    const monthlyRows = db.prepare(`
      SELECT 
        substr(issue_date, 1, 7) as month,
        SUM(CASE WHEN status != 'void' THEN total ELSE 0 END) as invoiced,
        SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as paid
      FROM invoices
      WHERE issue_date IS NOT NULL AND status != 'void'
      GROUP BY substr(issue_date, 1, 7)
      ORDER BY month ASC
      LIMIT 12
    `).all() as any[];

    // Recent 5 invoices
    const recentInvoicesRaw = db.prepare(`
      SELECT 
        inv.*,
        cl.name as client_name,
        cl.company as client_company
      FROM invoices inv
      JOIN clients cl ON inv.client_id = cl.id
      ORDER BY inv.id DESC
      LIMIT 5
    `).all() as any[];

    const recent_invoices = recentInvoicesRaw.map((r) => ({
      ...r,
      client: {
        id: r.client_id,
        name: r.client_name,
        company: r.client_company,
      },
    }));

    const nextInvoiceNumber = getNextInvoiceNumberPreview();

    res.json({
      summary: {
        total_invoiced: metrics.total_invoiced,
        total_paid: metrics.total_paid,
        outstanding: metrics.total_outstanding,
        overdue_amount: metrics.total_overdue_amount,
        overdue_count: metrics.overdue_count,
        active_invoices_count: metrics.active_invoices_count,
        draft_count: metrics.draft_count,
      },
      monthly_revenue: monthlyRows,
      recent_invoices,
      next_invoice_number: nextInvoiceNumber,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clear-demo/', (req: Request, res: Response) => {
  try {
    clearDemoData();
    res.json({ message: 'All clients, invoices, line items, and numbering history have been cleared.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Demo Reset Endpoint
app.post('/api/reset-demo/', (req: Request, res: Response) => {
  try {
    seedDemoData(true);
    res.json({ message: 'Demo data re-seeded successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// VITE CLIENT MOUNTING (DEV / PROD)
// ==========================================
async function start() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT) || 3000;

  if (!isProd) {
    const hmrPort = Number(process.env.VITE_HMR_PORT) || 24678;
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: hmrPort, clientPort: hmrPort },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`InvoiceFlow server running on http://0.0.0.0:${port}`);
  });
}

start();

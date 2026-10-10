import { db, getSettings } from './db';

export function seedDemoData(force = false) {
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM invoices').get() as any).count;
  if (existingCount > 0 && !force) {
    return;
  }

  // Clear existing if force
  if (force) {
    db.exec(`
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM clients;
      DELETE FROM invoice_counters;
    `);
  }

  const currentYear = new Date().getFullYear();

  // Ensure settings
  getSettings();

  // Create 5 realistic clients
  const insertClient = db.prepare(`
    INSERT INTO clients (name, email, phone, address, company, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const clientsData = [
    {
      name: 'Marcus Vance',
      email: 'm.vance@nexustechlabs.com',
      phone: '+1 (415) 890-1200',
      address: '100 Montgomery St, Suite 1800, San Francisco, CA 94104',
      company: 'Nexus Tech Labs Inc.',
      created_at: `${currentYear}-01-10T09:00:00Z`,
    },
    {
      name: 'Elena Rostova',
      email: 'elena@cloudscale-ops.io',
      phone: '+1 (206) 450-9321',
      address: '400 Pine Street, 12th Floor, Seattle, WA 98101',
      company: 'CloudScale Infrastructure LLC',
      created_at: `${currentYear}-01-15T11:30:00Z`,
    },
    {
      name: 'Sarah Jenkins',
      email: 'sjenkins@horizonmediagroup.net',
      phone: '+1 (212) 330-8740',
      address: '350 5th Avenue, Suite 4400, New York, NY 10118',
      company: 'Horizon Media Group',
      created_at: `${currentYear}-02-01T14:15:00Z`,
    },
    {
      name: 'David Chen',
      email: 'dchen@beaconbiohealth.org',
      phone: '+1 (617) 720-4100',
      address: '75 Cambridge Parkway, Cambridge, MA 02142',
      company: 'Beacon BioHealth Solutions',
      created_at: `${currentYear}-02-10T10:00:00Z`,
    },
    {
      name: 'Amina Patel',
      email: 'amina@apexlogisticsglobal.com',
      phone: '+1 (312) 550-6211',
      address: '233 S Wacker Dr, Suite 5200, Chicago, IL 60606',
      company: 'Apex Logistics Global',
      created_at: `${currentYear}-03-01T16:45:00Z`,
    },
  ];

  const clientIds: number[] = [];
  for (const c of clientsData) {
    const res = insertClient.run(c.name, c.email, c.phone, c.address, c.company, c.created_at);
    clientIds.push(Number(res.lastInsertRowid));
  }

  // Set counter for currentYear to 12
  db.prepare(`
    INSERT INTO invoice_counters (year, last_number)
    VALUES (?, ?)
    ON CONFLICT(year) DO UPDATE SET last_number = 12
  `).run(currentYear, 12);

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (invoice_number, client_id, issue_date, due_date, status, currency, tax_rate, discount_type, discount_value, notes, terms, subtotal, tax_amount, total, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seedInvoices = [
    {
      num: 1,
      clientIdx: 0,
      issueDate: `${currentYear}-01-15`,
      dueDate: `${currentYear}-02-14`,
      status: 'paid',
      taxRate: 10,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'Initial SaaS Architecture Phase 1 delivery.',
      terms: 'Net 30. Payment received via Wire.',
      items: [
        { desc: 'Cloud Architecture Discovery & Planning', qty: 25, price: 150 },
        { desc: 'Multi-Tenant Database Schema Implementation', qty: 30, price: 160 },
      ],
    },
    {
      num: 2,
      clientIdx: 1,
      issueDate: `${currentYear}-01-20`,
      dueDate: `${currentYear}-02-04`,
      status: 'paid',
      taxRate: 8.5,
      discountType: 'fixed',
      discountVal: 200,
      notes: 'Kubernetes Cluster Hardening & CI/CD pipeline modernization.',
      terms: 'Net 15 days.',
      items: [
        { desc: 'Production Kubernetes Cluster Audit', qty: 1, price: 3200 },
        { desc: 'GitOps Pipeline Automation (ArgoCD)', qty: 20, price: 175 },
        { desc: 'Prometheus & Grafana Alerting Setup', qty: 12, price: 150 },
      ],
    },
    {
      num: 3,
      clientIdx: 2,
      issueDate: `${currentYear}-02-01`,
      dueDate: `${currentYear}-03-03`,
      status: 'paid',
      taxRate: 8.875,
      discountType: 'percentage',
      discountVal: 5,
      notes: 'Brand Guidelines & Digital Asset Design Kit.',
      terms: 'Net 30 days.',
      items: [
        { desc: 'Enterprise Design System Components', qty: 35, price: 120 },
        { desc: 'Figma Library Documentation', qty: 10, price: 110 },
      ],
    },
    {
      num: 4,
      clientIdx: 3,
      issueDate: `${currentYear}-02-15`,
      dueDate: `${currentYear}-03-01`,
      status: 'paid',
      taxRate: 6.25,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'HIPAA Compliance Security Assessment & Encryption Protocol.',
      terms: 'Net 14 days.',
      items: [
        { desc: 'PHI Data Pipeline Compliance Audit', qty: 40, price: 195 },
        { desc: 'KMS Key Rotation & Cryptographic Review', qty: 15, price: 210 },
      ],
    },
    {
      num: 5,
      clientIdx: 4,
      issueDate: `${currentYear}-03-01`,
      dueDate: `${currentYear}-03-31`,
      status: 'paid',
      taxRate: 10,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'Fleet Tracking Telemetry Ingestion Engine.',
      terms: 'Net 30 days.',
      items: [
        { desc: 'Kafka Event Streaming Ingestion Layer', qty: 32, price: 180 },
        { desc: 'High-throughput Geofence Calculation Worker', qty: 16, price: 175 },
      ],
    },
    {
      num: 6,
      clientIdx: 0,
      issueDate: `${currentYear}-03-10`,
      dueDate: `${currentYear}-04-09`,
      status: 'sent',
      taxRate: 10,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'Sprint 5 Deliverables: User Authentication & RBAC.',
      terms: 'Net 30 days.',
      items: [
        { desc: 'OAuth2 & SSO Federation Integration', qty: 24, price: 165 },
        { desc: 'Role-Based Access Control Permissions Matrix', qty: 18, price: 160 },
      ],
    },
    {
      num: 7,
      clientIdx: 1,
      issueDate: `${currentYear}-02-20`,
      dueDate: `${currentYear}-03-06`, // Past due!
      status: 'overdue',
      taxRate: 8.5,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'Emergency Incident Response & Database Recovery.',
      terms: 'Net 14 days. Past due - second reminder sent.',
      items: [
        { desc: '24/7 Priority Emergency SRE Callout', qty: 16, price: 250 },
        { desc: 'Post-Mortem Root Cause Analysis Report', qty: 8, price: 175 },
      ],
    },
    {
      num: 8,
      clientIdx: 2,
      issueDate: `${currentYear}-02-25`,
      dueDate: `${currentYear}-03-11`, // Past due!
      status: 'overdue',
      taxRate: 8.875,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'Interactive Marketing Campaign Microsite.',
      terms: 'Net 14 days. Past due.',
      items: [
        { desc: 'WebGL 3D Interactive Showcase Page', qty: 45, price: 150 },
        { desc: 'Responsive Mobile Optimization & CDN Deployment', qty: 12, price: 140 },
      ],
    },
    {
      num: 9,
      clientIdx: 3,
      issueDate: `${currentYear}-03-20`,
      dueDate: `${currentYear}-04-19`,
      status: 'sent',
      taxRate: 6.25,
      discountType: 'percentage',
      discountVal: 5,
      notes: 'Clinical Trial Analytics Dashboard Enhancement.',
      terms: 'Net 30 days.',
      items: [
        { desc: 'Cohort Statistical Visualization Widgets', qty: 22, price: 185 },
        { desc: 'Automated PDF Export Report Generation', qty: 14, price: 160 },
      ],
    },
    {
      num: 10,
      clientIdx: 4,
      issueDate: `${currentYear}-03-25`,
      dueDate: `${currentYear}-04-24`,
      status: 'draft',
      taxRate: 10,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'Internal draft: Route Optimization Engine v2.',
      terms: 'Net 30 days upon final approval.',
      items: [
        { desc: 'Heuristic Dispatch Optimizer Module', qty: 15, price: 190 },
      ],
    },
    {
      num: 11,
      clientIdx: 1,
      issueDate: `${currentYear}-01-10`,
      dueDate: `${currentYear}-01-24`,
      status: 'void',
      taxRate: 8.5,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'VOID: Superseded by revised scope agreement in INV-2026-0002. Number retained for audit compliance.',
      terms: 'Voided - Do not remit.',
      items: [
        { desc: 'Preliminary Container Migration Scoping', qty: 10, price: 150 },
      ],
    },
    {
      num: 12,
      clientIdx: 0,
      issueDate: `${currentYear}-03-28`,
      dueDate: `${currentYear}-04-27`,
      status: 'sent',
      taxRate: 10,
      discountType: 'percentage',
      discountVal: 0,
      notes: 'API Gateway Rate Limiting & Throttling System.',
      terms: 'Net 30 days.',
      items: [
        { desc: 'Redis Token Bucket Rate Limiter', qty: 20, price: 175 },
        { desc: 'Telemetry & Webhook Event Relay', qty: 16, price: 160 },
      ],
    },
  ];

  for (const inv of seedInvoices) {
    const padded = String(inv.num).padStart(4, '0');
    const invoiceNumber = `INV-${currentYear}-${padded}`;
    const clientId = clientIds[inv.clientIdx];

    let subtotal = 0;
    for (const item of inv.items) {
      subtotal += item.qty * item.price;
    }

    let discountAmount = 0;
    if (inv.discountType === 'percentage') {
      discountAmount = (subtotal * inv.discountVal) / 100;
    } else {
      discountAmount = inv.discountVal;
    }
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = (taxableAmount * inv.taxRate) / 100;
    const total = taxableAmount + taxAmount;

    const res = insertInvoice.run(
      invoiceNumber,
      clientId,
      inv.issueDate,
      inv.dueDate,
      inv.status,
      'USD',
      inv.taxRate,
      inv.discountType,
      inv.discountVal,
      inv.notes,
      inv.terms,
      subtotal,
      taxAmount,
      total,
      `${inv.issueDate}T10:00:00Z`
    );

    const invId = Number(res.lastInsertRowid);
    for (const item of inv.items) {
      insertItem.run(invId, item.desc, item.qty, item.price, item.qty * item.price);
    }
  }
}

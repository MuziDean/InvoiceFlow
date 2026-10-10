# InvoiceFlow

**InvoiceFlow** is a professional billing and invoice management web application featuring a **guaranteed collision-free, automatic sequential invoice numbering engine**. 

---

## ⚡ Core Guarantee: Automatic Sequential Numbering

Every new invoice created automatically receives a unique, sequential invoice number (e.g., `INV-2026-0001`, `INV-2026-0002`, ...). **The user never types an invoice number manually.**

- **Server-Side Generation**: Assigned strictly upon invoice creation on the backend. The frontend displays the number as read-only and immutable.
- **Atomic Concurrency Protection**: Implemented using a dedicated `InvoiceCounter` model inside `transaction.atomic()` with `select_for_update()`. Simultaneous creation requests will never collide or produce duplicates.
- **Configurable Format in Settings**:
  - Prefix (default: `INV`)
  - Include Year (default: `Yes`, counter resets to 1 each calendar year)
  - Zero-Padding Length (default: `4` digits, e.g., `0001`)
  - Separator (default: `-`)
- **No Reuse on Void / Delete**: Deleting or voiding an invoice preserves audit trail integrity. The number is never released or reused for subsequent invoices.
- **Automatic Overdue Tracking**: Invoices past their due date and not paid are automatically marked as `overdue`.

---

## 📁 Project Structure

```
invoiceflow/
├── backend/                  (Django 5 + Django REST Framework)
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/               (settings, urls, wsgi)
│   └── invoices/             (models, serializers, views, urls, admin, tests, management/commands/seed_demo.py)
├── frontend/                 (React 19 + Vite + Tailwind CSS)
│   ├── package.json
│   ├── vite.config.js
│   └── src/                  (components, pages, api client, utils)
└── README.md                 (Full setup and client demo script)
```

---

## 🚀 Setup & Execution Guide

### 1. Backend Setup (Django + DRF)

Open a terminal and navigate to the backend directory:

```bash
cd invoiceflow/backend

# 1. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run database migrations
python manage.py makemigrations invoices
python manage.py migrate

# 4. Populate realistic demo dataset (5 clients, 12 invoices, business settings)
python manage.py seed_demo

# 5. Create an administrative superuser (optional, for Django admin)
python manage.py createsuperuser

# 6. Run the backend development server on port 8000
python manage.py runserver 8000
```

The Django REST API will be live at `http://127.0.0.1:8000/api/` and the Django Admin panel at `http://127.0.0.1:8000/admin/`.

---

### 2. Frontend Setup (React + Vite + Tailwind CSS)

Open a second terminal window and navigate to the frontend directory:

```bash
cd invoiceflow/frontend

# 1. Install Node dependencies
npm install

# 2. Start the Vite development server (port 5173)
npm run dev
```

Open your browser to **`http://localhost:5173`**. The Vite development server automatically proxies all `/api/*` calls to `http://localhost:8000`.

---

### 3. Running Backend Unit Tests

Verify sequential numbering, annual reset, concurrency guarantees, and immutability:

```bash
cd invoiceflow/backend
python manage.py test invoices
```

Tests included:
1. `test_sequential_numbering`: Verifies `INV-2026-0001`, `INV-2026-0002`, `INV-2026-0003` progression.
2. `test_year_reset`: Verifies counter resets to `1` when year changes from `2025` to `2026`.
3. `test_no_duplicates_under_concurrent_creation`: Spawns 15 simultaneous threads issuing creation calls and verifies zero duplicates or collisions.
4. `test_invoice_number_cannot_be_edited_via_api`: Proves `invoice_number` is read-only and ignores attempts to alter it via PUT/PATCH.
5. `test_void_does_not_free_or_reuse_number`: Confirms voiding an invoice does not reuse its number.

---

## 🎬 Client Demo Script (Walkthrough)

Use this 5-minute script to demonstrate the auto-numbering features to a client or stakeholder:

### Step 1: Overview Dashboard & Live Sequence Preview
1. Open the app at `http://localhost:5173`.
2. Notice the top banner: **"Next Auto-Assigned Number: INV-2026-0013"**.
3. Point out that the demo database currently has 12 invoices (`INV-2026-0001` through `INV-2026-0012`) with realistic statuses (Paid, Sent, Overdue, Void, Draft).

### Step 2: Create a New Invoice (Auto-Number Generation)
1. Click **"New Invoice"** (in sidebar or dashboard).
2. Point out the notice: *"Invoice number will be assigned automatically upon creation"*.
3. Notice there is **no field for invoice number**—the user cannot type or mistype it.
4. Select client **"Nexus Tech Labs"** (or click *"+ New Client"* to add one inline).
5. Add line items:
   - "Full-Stack Web Application Demo": Qty `1`, Unit Price `$3,500.00`.
   - "API Security Audit": Qty `10`, Unit Price `$150.00`.
6. Notice the live subtotal, tax, and grand total calculating dynamically.
7. Click **"Create Invoice & Assign Number"**.
8. **Result**: A celebration modal pops up proudly displaying:
   > **Assigned Invoice Number: `INV-2026-0013`**
9. Look back at the sidebar: the counter has automatically advanced to show **`Next: INV-2026-0014`**.

### Step 3: Immutability & Void Protection
1. Click **"View & Print"** to inspect the invoice.
2. Point out that the invoice number is completely **read-only**.
3. Click **"Download PDF"** to open the server-generated official commercial invoice PDF.
4. Go to the Invoices list. Click the **Void** button (ban icon) on any invoice.
5. Confirm the void. Note that the status changes to *Voided*, but the invoice record and its assigned number **remain permanently in the sequence**.
6. Create another invoice: the counter increments sequentially to `INV-2026-0014`—**it never reuses the voided number**.

### Step 4: Live Format Customization in Settings
1. Navigate to **"Settings & Format"**.
2. Show the **Interactive Live Preview** box.
3. Change the prefix from `INV` to `BILL`.
4. Change the separator from `-` to `/`.
5. Change the padding from `4` to `5`.
6. Watch the live preview update in real-time to: **`BILL/2026/00014`**.
7. Click **"Save Configuration"**. Any invoice created from now on will automatically adopt the new format.

---

## 🛠️ API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/` | KPI cards, monthly revenue metrics, recent invoices |
| `GET` | `/api/settings/` | Business profile and current numbering settings |
| `PUT` | `/api/settings/` | Update business details and numbering format |
| `GET` | `/api/clients/` | List clients with search and billing aggregates |
| `POST` | `/api/clients/` | Create a new client |
| `GET` | `/api/invoices/` | List invoices (search, status filter, client filter, pagination) |
| `POST` | `/api/invoices/` | **Creates invoice & auto-assigns next sequential number** |
| `GET` | `/api/invoices/{id}/` | Retrieve single invoice details with line items |
| `PUT` | `/api/invoices/{id}/` | Update invoice (invoice_number is immutable) |
| `POST` | `/api/invoices/{id}/mark-paid/` | Update status to 'paid' |
| `POST` | `/api/invoices/{id}/mark-sent/` | Update status to 'sent' |
| `POST` | `/api/invoices/{id}/void/` | Marks status as 'void' (does not free up number) |
| `GET` | `/api/invoices/{id}/pdf/` | Returns downloadable official PDF |

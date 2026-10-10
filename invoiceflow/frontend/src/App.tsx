import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ToastProvider, useToast } from './components/Toast';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesListPage } from './pages/InvoicesListPage';
import { InvoiceFormPage } from './pages/InvoiceFormPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardData, Invoice } from './types';
import { api } from './api/client';

function AppContent() {
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);

  // Detail / Edit View State
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const loadDashboard = async () => {
    try {
      setLoadingDashboard(true);
      const data = await api.getDashboard();
      setDashboardData(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleOpenCreateInvoice = () => {
    setEditingInvoice(null);
    setCurrentTab('create-invoice');
  };

  const handleViewInvoice = (id: number) => {
    setViewInvoiceId(id);
    setCurrentTab('invoice-detail');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setCurrentTab('create-invoice');
  };

  const handleInvoiceCreated = (invoice: Invoice) => {
    loadDashboard();
  };

  const handleResetDemo = async () => {
    if (confirm('Reset database to the pristine 12-invoice demo state? Any newly added invoices will be replaced with the demo seed data.')) {
      try {
        await api.resetDemo();
        showToast('Demo data re-seeded successfully! Counter set to INV-2026-0012.', 'success');
        await loadDashboard();
        setCurrentTab('dashboard');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <div className="print:hidden">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setViewInvoiceId(null);
            setEditingInvoice(null);
            setCurrentTab(tab);
          }}
          nextInvoiceNumber={dashboardData?.next_invoice_number}
          onOpenCreateInvoice={handleOpenCreateInvoice}
          onResetDemo={handleResetDemo}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {currentTab === 'dashboard' && (
          <DashboardPage
            data={dashboardData}
            loading={loadingDashboard}
            onNavigateToTab={(tab) => setCurrentTab(tab)}
            onOpenCreateInvoice={handleOpenCreateInvoice}
            onViewInvoice={handleViewInvoice}
            onRefresh={loadDashboard}
          />
        )}

        {currentTab === 'invoices' && (
          <InvoicesListPage
            onOpenCreateInvoice={handleOpenCreateInvoice}
            onViewInvoice={handleViewInvoice}
          />
        )}

        {currentTab === 'create-invoice' && (
          <InvoiceFormPage
            invoiceToEdit={editingInvoice}
            onCancel={() => setCurrentTab('invoices')}
            onInvoiceCreated={handleInvoiceCreated}
            onViewInvoice={handleViewInvoice}
          />
        )}

        {currentTab === 'invoice-detail' && viewInvoiceId && (
          <InvoiceDetailPage
            invoiceId={viewInvoiceId}
            onBack={() => setCurrentTab('invoices')}
            onEdit={handleEditInvoice}
          />
        )}

        {currentTab === 'clients' && <ClientsPage />}

        {currentTab === 'settings' && (
          <SettingsPage
            onSettingsUpdated={loadDashboard}
            onResetDemo={handleResetDemo}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

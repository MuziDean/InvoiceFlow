import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ToastProvider, useToast } from './components/Toast';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesListPage } from './pages/InvoicesListPage';
import { InvoiceFormPage } from './pages/InvoiceFormPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthenticatedUser, DashboardData, Invoice } from './types';
import { api } from './api/client';
import { AuthPage } from './pages/AuthPage';

function AppContent() {
  const { showToast } = useToast();
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
    let active = true;
    api.getCurrentUser()
      .then(({ user }) => {
        if (active) setAuthUser(user);
      })
      .catch(() => {
        if (active) setAuthUser(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (authUser) {
      loadDashboard();
    } else {
      setDashboardData(null);
    }
  }, [authUser?.id]);

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

  const handleClearDemoData = async () => {
    if (confirm('Permanently clear all clients, invoices, line items, and numbering history? Business profile settings will be kept.')) {
      try {
        const result = await api.clearDemoData();
        showToast(result.message, 'success');
        await loadDashboard();
        setCurrentTab('dashboard');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await api.signOut();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAuthUser(null);
      setViewInvoiceId(null);
      setEditingInvoice(null);
      setCurrentTab('dashboard');
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm text-slate-500">Checking your session...</div>;
  }

  if (!authUser) {
    return <AuthPage onAuthenticated={setAuthUser} />;
  }

  return (
    <div className="flex min-h-screen overflow-x-clip bg-slate-50 text-slate-900 font-sans">
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
          onClearDemoData={handleClearDemoData}
          userEmail={authUser.email}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-14 pb-24 md:pt-0 md:pb-0">
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
            onClearDemoData={handleClearDemoData}
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

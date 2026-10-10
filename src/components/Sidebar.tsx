import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  PlusCircle,
  Hash,
  ShieldCheck,
  Trash2,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  nextInvoiceNumber?: string;
  onOpenCreateInvoice: () => void;
  onClearDemoData?: () => void;
  userEmail: string;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  nextInvoiceNumber,
  onOpenCreateInvoice,
  onClearDemoData,
  userEmail,
  onSignOut,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Settings & Format', icon: Settings },
  ];

  return (
    <>
    <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="InvoiceFlow logo" className="w-9 h-9 rounded-lg object-contain shadow-sm" />
          <div>
            <div className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
              <span>InvoiceFlow</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Auto-Numbered Invoicing</p>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-4">
        <button
          onClick={onOpenCreateInvoice}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Next Sequential Invoice Number Card */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-blue-400" />
              <span>Next In Sequence</span>
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Atomic
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-white tracking-wide bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-center">
            {nextInvoiceNumber || 'INV-2026-0013'}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            Auto-assigned server-side inside atomic transaction with zero duplicates.
          </p>
        </div>

        {onClearDemoData && (
          <button
            onClick={onClearDemoData}
            className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 py-1.5 px-2 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear all clients and invoices while keeping business settings"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Demo Data</span>
          </button>
        )}
      </div>

      <div className="border-t border-slate-800 p-3 flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-full bg-slate-700 text-slate-100 flex items-center justify-center text-xs font-bold">
          {userEmail.slice(0, 1).toUpperCase()}
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={userEmail}>{userEmail}</span>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="shrink-0 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
    <header className="md:hidden fixed inset-x-0 top-0 z-40 h-14 bg-slate-900 text-white border-b border-slate-800 px-3 flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <img src="/logo.svg" alt="" className="w-8 h-8 shrink-0 rounded-md" />
        <span className="truncate text-sm font-bold">InvoiceFlow</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenCreateInvoice}
          aria-label="New invoice"
          title="New invoice"
          className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <PlusCircle className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
    <nav aria-label="Main navigation" className="md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-800 bg-slate-900 text-slate-400 pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentTab(item.id)}
            aria-pressed={isActive}
            className={`min-w-0 min-h-16 flex flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="max-w-full truncate">{item.label === 'Settings & Format' ? 'Settings' : item.label}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
};

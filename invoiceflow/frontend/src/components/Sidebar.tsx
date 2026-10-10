import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  PlusCircle,
  Hash,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  nextInvoiceNumber?: string;
  onOpenCreateInvoice: () => void;
  onResetDemo?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  nextInvoiceNumber,
  onOpenCreateInvoice,
  onResetDemo,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Settings & Format', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            IF
          </div>
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

        {onResetDemo && (
          <button
            onClick={onResetDemo}
            className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 py-1.5 px-2 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset to 12 sample seed invoices"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Demo Seed Data</span>
          </button>
        )}
      </div>
    </aside>
  );
};

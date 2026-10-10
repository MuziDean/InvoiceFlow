import React, { useState } from 'react';
import { ArrowRight, Building2, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { api } from '../api/client';
import { AuthenticatedUser } from '../types';

interface AuthPageProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const result = mode === 'signup'
        ? await api.signUp({ business_name: businessName, email, password })
        : await api.signIn({ email, password });
      onAuthenticated(result.user);
    } catch (submitError: any) {
      setError(submitError.message || 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/bg1.png')" }}
    >
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-7 sm:p-9">
        <header className="mb-7">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.svg" alt="InvoiceFlow logo" className="w-10 h-10 rounded-lg object-contain" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">InvoiceFlow</h1>
              <p className="text-xs text-slate-500">Private business workspace</p>
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your workspace'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'signin' ? 'Use your email and password to continue.' : 'Your clients and invoices will be kept separate.'}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-slate-100 rounded-lg" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => { setMode('signin'); setError(''); }}
            className={`py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => { setMode('signup'); setError(''); }}
            className={`py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="business-name" className="block text-xs font-semibold text-slate-700 mb-1.5">Business name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  id="business-name"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={120}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="account-email" className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="account-password" className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                id="account-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-md disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
};
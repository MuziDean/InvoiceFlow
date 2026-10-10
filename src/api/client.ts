import {
  BusinessSettings,
  Client,
  AuthenticatedUser,
  DashboardData,
  Invoice,
  InvoicesResponse,
  Product,
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    credentials: 'same-origin',
    ...options,
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data as T;
}

export const api = {
  getCurrentUser: () => request<{ user: AuthenticatedUser | null }>('/auth/me/'),
  signUp: (data: { business_name: string; email: string; password: string }) =>
    request<{ user: AuthenticatedUser }>('/auth/signup/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  signIn: (data: { email: string; password: string }) =>
    request<{ user: AuthenticatedUser }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  signOut: () => request<{ message: string }>('/auth/logout/', { method: 'POST' }),

  // Settings
  getSettings: () => request<BusinessSettings>('/settings/'),
  updateSettings: (settings: Partial<BusinessSettings>) =>
    request<BusinessSettings>('/settings/', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Clients
  getClients: (search?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<Client[]>(`/clients/${qs}`);
  },
  getProducts: () => request<Product[]>('/products/'),
  getClient: (id: number | string) => request<Client>(`/clients/${id}/`),
  createClient: (data: Partial<Client>) =>
    request<Client>('/clients/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateClient: (id: number | string, data: Partial<Client>) =>
    request<Client>(`/clients/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteClient: (id: number | string) =>
    request<void>(`/clients/${id}/`, {
      method: 'DELETE',
    }),

  // Invoices
  getInvoices: (params?: {
    search?: string;
    status?: string;
    client?: string | number;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.append('search', params.search);
    if (params?.status && params.status !== 'all') sp.append('status', params.status);
    if (params?.client) sp.append('client', String(params.client));
    if (params?.start_date) sp.append('start_date', params.start_date);
    if (params?.end_date) sp.append('end_date', params.end_date);
    if (params?.page) sp.append('page', String(params.page));
    if (params?.page_size) sp.append('page_size', String(params.page_size));
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return request<InvoicesResponse>(`/invoices/${qs}`);
  },
  getInvoice: (id: number | string) => request<Invoice>(`/invoices/${id}/`),
  createInvoice: (data: any) =>
    request<Invoice>('/invoices/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInvoice: (id: number | string, data: any) =>
    request<Invoice>(`/invoices/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  voidInvoice: (id: number | string) =>
    request<{ message: string; invoice: Invoice }>(`/invoices/${id}/void/`, {
      method: 'POST',
    }),
  markPaid: (id: number | string) =>
    request<{ message: string; invoice: Invoice }>(`/invoices/${id}/mark-paid/`, {
      method: 'POST',
    }),
  markSent: (id: number | string) =>
    request<{ message: string; invoice: Invoice }>(`/invoices/${id}/mark-sent/`, {
      method: 'POST',
    }),
  getPdfUrl: (id: number | string) => `${API_BASE}/invoices/${id}/pdf/`,
  getReceiptUrl: (id: number | string) => `${API_BASE}/invoices/${id}/receipt/`,

  // Dashboard
  getDashboard: () => request<DashboardData>('/dashboard/'),

  // Reset Demo Data
  resetDemo: () =>
    request<{ message: string }>('/reset-demo/', {
      method: 'POST',
    }),
  clearDemoData: () =>
    request<{ message: string }>('/clear-demo/', {
      method: 'POST',
    }),
};

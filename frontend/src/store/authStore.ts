import { create } from 'zustand';

interface User { id: number; email: string; full_name: string | null; role: string; }

interface AuthState {
  user: User | null; token: string | null; isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => { try { const s = localStorage.getItem('bcl_user'); return s ? JSON.parse(s) : null; } catch { return null; } })(),
  token: localStorage.getItem('bcl_token'),
  isAuthenticated: !!localStorage.getItem('bcl_token'),
  setAuth: (user, token) => {
    localStorage.setItem('bcl_token', token);
    localStorage.setItem('bcl_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('bcl_token'); localStorage.removeItem('bcl_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

import { create } from 'zustand';

interface User { id: number; email: string; full_name: string | null; role: string; }

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  initialized: false,

  setAuth: (user, token) => {
    localStorage.setItem('bcl_token', token);
    localStorage.setItem('bcl_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('bcl_token');
    localStorage.removeItem('bcl_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  initialize: async () => {
    const token = localStorage.getItem('bcl_token');
    if (!token) {
      set({ initialized: true, isAuthenticated: false, user: null, token: null });
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user: User = await res.json();
        set({ user, token, isAuthenticated: true, initialized: true });
      } else {
        // Token is expired, revoked, or account disabled — force logout
        localStorage.removeItem('bcl_token');
        localStorage.removeItem('bcl_user');
        set({ user: null, token: null, isAuthenticated: false, initialized: true });
      }
    } catch {
      // Network error — keep the cached token/user so the app can attempt to load
      // API calls will fail with 401 if the token is actually invalid, which will
      // redirect to login via the axios interceptor
      const cachedUser = (() => {
        try { const s = localStorage.getItem('bcl_user'); return s ? JSON.parse(s) : null; }
        catch { return null; }
      })();
      set({ user: cachedUser, token, isAuthenticated: !!cachedUser, initialized: true });
    }
  },
}));

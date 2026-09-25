import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../api/client';

interface User {
  id: string;
  email: string;
  full_name?: string;
  email_verified: boolean;
  role: string;
  auth_provider?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (access: string, refresh: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MOCK = import.meta.env.VITE_MOCK === 'true';

const MOCK_USER: User = {
  id: 'mock-user-1',
  email: 'aditi.sharma@example.com',
  full_name: 'Aditi Sharma',
  email_verified: true,
  role: 'admin', // set to 'admin' so you can preview the Admin Panel too
  auth_provider: 'email',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    if (MOCK) { setUser(MOCK_USER); setLoading(false); return; }
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUser(await res.json());
    } catch { /* network issue */ }
    setLoading(false);
  }, []);

  // On mount: if refresh token exists, attempt to restore session
  useEffect(() => {
    if (MOCK) { setLoading(false); return; } // mock mode: only log in via the login form
    const refresh = getRefreshToken();
    if (!refresh) { setLoading(false); return; }
    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setTokens(data.access_token, data.refresh_token);
          return fetchMe();
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fetchMe]);

  const login = useCallback(async (access: string, refresh: string) => {
    setTokens(access, refresh);
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(() => {
    setUser(null);
    clearTokens();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

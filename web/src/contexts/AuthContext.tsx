import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Member } from '../api/client';
import { login as apiLogin } from '../api/client';

const TOKEN_KEY = 'horizen_admin_token';
const MEMBER_KEY = 'horizen_admin_member';

interface AuthContextValue {
  token: string | null;
  member: Member | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [member, setMember] = useState<Member | null>(() => {
    const stored = localStorage.getItem(MEMBER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { token: t, member: m } = await apiLogin(email, password);
      if (m.role !== 'admin') {
        throw new Error('Access denied. Admin login required.');
      }
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
      setToken(t);
      setMember(m);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MEMBER_KEY);
    setToken(null);
    setMember(null);
  }, []);

  const value: AuthContextValue = {
    token,
    member,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

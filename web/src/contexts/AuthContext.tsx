import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Member } from '../api/client';
import { login as apiLogin } from '../api/client';

interface AuthContextValue {
  token: string | null;
  member: Member | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { token: t, member: m } = await apiLogin(email, password);
      if (m.role !== 'admin') {
        throw new Error('Access denied. Admin login required.');
      }
      setToken(t);
      setMember(m);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
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

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, Member } from '../lib/api';

const TOKEN_KEY = 'gymapp_token';
const MEMBER_KEY = 'gymapp_member';

export interface AuthRequest {
  email: string;
  password: string;
  type: 'login' | 'register';
  name?: string;
}

interface AuthState {
  member: Member | null;
  token: string | null;
  isLoading: boolean;
  authRequest: AuthRequest | null;
  authError: string | null;
  hasCompletedWelcome: boolean;
  avatarVersion: number;
}

interface AuthContextValue extends AuthState {
  getAvatarUrl: (url: string | null | undefined) => string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuthRequest: (req: AuthRequest | null) => void;
  executeAuthRequest: (req: AuthRequest) => Promise<void>;
  clearAuthError: () => void;
  completeWelcome: () => void;
  updateMember: (member: Member) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    member: null,
    token: null,
    isLoading: true,
    authRequest: null,
    authError: null,
    hasCompletedWelcome: false,
    avatarVersion: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedMember] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(MEMBER_KEY),
        ]);
        if (storedToken && storedMember) {
          setState((s) => ({
            ...s,
            token: storedToken,
            member: JSON.parse(storedMember) as Member,
            isLoading: false,
          }));
        } else {
          setState((s) => ({ ...s, isLoading: false }));
        }
      } catch {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const persistAuth = async (member: Member, token: string) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(MEMBER_KEY, JSON.stringify(member)),
    ]);
    setState((s) => ({ ...s, member, token, isLoading: false }));
  };

  const clearAuth = async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(MEMBER_KEY),
    ]);
    setState((s) => ({ ...s, member: null, token: null, isLoading: false }));
  };

  const login = async (email: string, password: string) => {
    const { member, token } = await apiLogin({ email, password });
    await persistAuth(member, token);
  };

  const register = async (email: string, password: string, name: string) => {
    const { member, token } = await apiRegister({ email, password, name });
    await persistAuth(member, token);
  };

  const logout = async () => {
    await clearAuth();
    setState((s) => ({ ...s, hasCompletedWelcome: false }));
  };

  const setAuthRequest = (authRequest: AuthRequest | null) => {
    setState((s) => ({ ...s, authRequest }));
  };

  const executeAuthRequest = async (req: AuthRequest) => {
    setState((s) => ({ ...s, authError: null }));
    try {
      if (req.type === 'login') {
        const { member, token } = await apiLogin({ email: req.email, password: req.password });
        await persistAuth(member, token);
      } else {
        const { member, token } = await apiRegister({
          email: req.email,
          password: req.password,
          name: req.name ?? '',
        });
        await persistAuth(member, token);
      }
      setState((s) => ({ ...s, authRequest: null, authError: null }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setState((s) => ({ ...s, authError: message, authRequest: null }));
      throw err;
    }
  };

  const clearAuthError = () => {
    setState((s) => ({ ...s, authError: null }));
  };

  const completeWelcome = () => {
    setState((s) => ({ ...s, hasCompletedWelcome: true }));
  };

  const updateMember = async (member: Member) => {
    await AsyncStorage.setItem(MEMBER_KEY, JSON.stringify(member));
    setState((s) => ({ ...s, member, avatarVersion: s.avatarVersion + 1 }));
  };

  const getAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${state.avatarVersion}`;
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        getAvatarUrl,
        login,
        register,
        logout,
        setAuthRequest,
        executeAuthRequest,
        clearAuthError,
        completeWelcome,
        updateMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

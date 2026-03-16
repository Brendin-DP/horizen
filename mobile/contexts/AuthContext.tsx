import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, register as apiRegister, Member } from '../lib/api';

const TOKEN_KEY = 'gymapp_token';
const MEMBER_KEY = 'gymapp_member';

interface AuthState {
  member: Member | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    member: null,
    token: null,
    isLoading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedMember] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(MEMBER_KEY),
        ]);
        if (storedToken && storedMember) {
          setState({
            token: storedToken,
            member: JSON.parse(storedMember) as Member,
            isLoading: false,
          });
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
    setState({ member, token, isLoading: false });
  };

  const clearAuth = async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(MEMBER_KEY),
    ]);
    setState({ member: null, token: null, isLoading: false });
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
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
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

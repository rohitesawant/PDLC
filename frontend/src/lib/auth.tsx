import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setToken, getToken, type AuthUser } from './api';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'unauthenticated'; user: null }
  | { status: 'authenticated'; user: AuthUser };

type Ctx = {
  state: AuthState;
  user: AuthUser | null;
  requestOtp: (phone: string) => Promise<{ expires_in: number; dev_otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState({ status: 'unauthenticated', user: null });
      return;
    }
    authApi.me()
      .then(({ user }) => setState({ status: 'authenticated', user }))
      .catch(() => {
        setToken(null);
        setState({ status: 'unauthenticated', user: null });
      });
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const res = await authApi.requestOtp(phone);
    return { expires_in: res.expires_in, dev_otp: res.dev_otp };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const res = await authApi.verifyOtp(phone, otp);
    setToken(res.token);
    setState({ status: 'authenticated', user: res.user });
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setToken(null);
    setState({ status: 'unauthenticated', user: null });
  }, []);

  const value = useMemo<Ctx>(() => ({
    state,
    user: state.status === 'authenticated' ? state.user : null,
    requestOtp,
    verifyOtp,
    logout,
  }), [state, requestOtp, verifyOtp, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

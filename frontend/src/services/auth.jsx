/**
 * SmartPark - authentication context.
 * Keeps the JWT + watchman profile in React state and localStorage.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, setUnauthorizedHandler, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.user());
  const [token, setToken] = useState(() => tokenStore.get());
  const [checking, setChecking] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  // A 401 from any request means the session is gone.
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  // Re-validate a stored token on boot so a stale session lands on /login.
  useEffect(() => {
    const stored = tokenStore.get();
    if (!stored) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        tokenStore.setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    tokenStore.set(res.token);
    tokenStore.setUser(res.user);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      checking,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
    }),
    [user, token, checking, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

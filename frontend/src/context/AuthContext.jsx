import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setTokens, clearTokens, setAuthFailureHandler } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    clearTokens();
    setUser(null);
  }, []);

  // Set auth failure handler (e.g. expired refresh token)
  useEffect(() => {
    setAuthFailureHandler(() => {
      setUser(null);
    });
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('pl_access_token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(res => { if (res.data?.user) setUser(res.data.user); })
      .catch(() => { clearTokens(); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setTokens(res.data.access_token, res.data.refresh_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    return res;
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

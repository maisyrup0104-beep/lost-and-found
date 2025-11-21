// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/apiClient';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // undefined = loading; null = not logged; user object = logged
  const [user, setUser] = useState(undefined);
  const nav = useNavigate();

  function saveToken(token) {
    try {
      if (typeof window !== 'undefined' && token) {
        window.localStorage.setItem('LAF__token', token);
      }
    } catch (e) { /* ignore */ }
  }
  function clearToken() {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem('LAF__token');
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api.getMe();
        if (!mounted) return;
        const u = data.user || data;
        setUser(u || null);
        // if server returns token alongside user (rare), save it
        if (data && data.token) saveToken(data.token);
      } catch (e) {
        // If getMe fails but token exists in storage, still clear user => require explicit login
        try {
          const t = (typeof window !== 'undefined') ? window.localStorage.getItem('LAF__token') : null;
          if (t) {
            // token present but /auth/me failed — keep user null so app will redirect to login
            console.warn('getMe failed but token exists locally. Server may have rejected token.');
          }
        } catch (err) { /* ignore */ }
        if (!mounted) return;
        setUser(null);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  async function login(payload) {
    const data = await api.login(payload);
    // server expected to return { ok, token, user }
    const u = (data && data.user) ? data.user : (data || null);
    const token = data && data.token ? data.token : null;
    if (token) saveToken(token);
    setUser(u);
    return u;
  }

  async function register(payload) {
    const data = await api.register(payload);
    const u = (data && data.user) ? data.user : (data || null);
    const token = data && data.token ? data.token : null;
    if (token) saveToken(token);
    setUser(u);
    return u;
  }

  async function logout() {
    try {
      await api.logout().catch(() => {});
    } catch (e) {
      console.warn('logout err', e);
    } finally {
      clearToken();
      const from = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '/dashboard';
      setUser(null);
      nav('/login', { state: { from } });
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
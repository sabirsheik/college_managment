import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.me()
      .then((response) => { if (active) setUser(response.data.user); })
      .catch((error) => {
        if (active && error.status !== 401) console.error('Session lookup failed:', error.message);
        if (active) setUser(null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function login(credentials) {
    await api.login(credentials);
    const response = await api.me();
    setUser(response.data.user);
    return response.data.user;
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    can: (permission) => Boolean(user && (
      user.role === 'SUPER_ADMIN' || user.permissions.includes(permission)
    ))
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}

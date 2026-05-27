import { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Verifica sessão ao montar — equivalente ao auth.js legado
  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Chamado após POST /auth/login bem-sucedido para atualizar o estado
  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  // POST /auth/logout → limpa estado → redireciona para login
  const logout = useCallback(() => {
    fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => {
        setUser(null);
        window.location.href = '/app/login';
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

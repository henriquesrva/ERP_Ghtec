import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * Login.jsx — migrado de public/login.html
 * Preserva: visual, POST /auth/login, erros, redirect após login.
 */
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate      = useNavigate();
  const { user, login } = useAuth();

  // Se já está logado, vai direto para o dashboard
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Preencha usuário e senha.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (res.ok) {
        login(data.user);
        navigate('/', { replace: true });
      } else {
        setError(data.message || 'Usuário ou senha incorretos.');
      }
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--color-bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '16px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/assets/logoGHTEC.png"
            alt="GHTec"
            style={{ height: '56px', width: 'auto', marginBottom: '12px' }}
          />
          <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '2px' }}>
            Sistema de Propostas Comerciais
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 24px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>
            Entrar
          </h2>

          {error && (
            <div className="msg error" style={{ marginBottom: '14px' }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: '14px' }}>
              <label>Usuário</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                disabled={submitting}
              />
            </div>

            <div className="field" style={{ marginBottom: '14px' }}>
              <label>Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 'var(--radius)',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                background: 'var(--color-primary)',
                color: '#fff',
                opacity: submitting ? 0.5 : 1,
                marginTop: '4px',
                transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

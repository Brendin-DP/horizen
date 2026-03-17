import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundDark,
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: colors.white,
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          border: `1px solid ${colors.border}`,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24, color: colors.textPrimary }}>
          Horizen Gym
        </h1>
        <p style={{ margin: '0 0 24px', color: colors.textMuted, fontSize: 14 }}>
          Back Office
        </p>
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                backgroundColor: colors.accent,
                color: colors.primary,
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 16,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 16,
            }}
          />
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: 12,
              marginBottom: 24,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 16,
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: 14,
              backgroundColor: colors.primary,
              color: colors.white,
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { ApiError } from '../../api/errors';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const memberships = await login({ email, password });

      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      if (memberships.length === 1) {
        navigate(`/orgs/${memberships[0].organizationId}/dashboard`, { replace: true });
      } else if (memberships.length > 1) {
        navigate('/select-org', { replace: true });
      } else {
        setError('No active organization memberships found for this account.');
      }
    } catch (err) {
      if (ApiError.isApiError(err)) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '1rem' }}>
      <h1>Sign In to ReconcileX</h1>
      <p>Enter your credentials to access your organization workspace.</p>

      {error && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem', border: '1px solid red', padding: '0.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="login-email" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="login-password" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '0.6rem' }}>
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link to="/register">Create new account & organization</Link>
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/invitations/accept">Have an invite code?</Link>
      </div>
    </div>
  );
};

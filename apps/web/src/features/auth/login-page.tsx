import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { ApiError } from '../../api/errors';
import { LogoIcon, CheckCircleIcon, ArrowRightIcon, AlertCircleIcon } from '../../shared/components/icons';

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
    <div className="rx-auth-shell">
      {/* Editorial Left Hero Panel (Reference 3) */}
      <div className="rx-auth-visual">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
          <LogoIcon size={36} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Reconcile<span style={{ color: 'var(--rx-lime)' }}>X</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-inverse-muted)', letterSpacing: '0.05em' }}>
              ENTERPRISE RECONCILIATION
            </div>
          </div>
        </div>

        <div style={{ margin: 'auto 0', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--rx-radius-full)',
              backgroundColor: 'rgba(242, 245, 0, 0.12)',
              border: '1px solid rgba(242, 245, 0, 0.25)',
              color: 'var(--rx-lime)',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
            }}
          >
            <span>Multi-Source Automated Ingestion</span>
          </div>

          <h2
            style={{
              fontSize: '2.5rem',
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#FFFFFF',
              marginBottom: '1.25rem',
            }}
          >
            Precision financial reconciliation at scale.
          </h2>

          <p style={{ fontSize: '1.05rem', color: '#B3B8AF', lineHeight: 1.6, maxWidth: '480px', marginBottom: '2rem' }}>
            Compare internal orders, payment gateway settlements, and bank statements automatically. Detect discrepancies and resolve exceptions with complete audit trails.
          </p>

          {/* Product Scenario Card Preview (PRD based) */}
          <div
            style={{
              backgroundColor: 'rgba(39, 43, 38, 0.8)',
              border: '1px solid var(--rx-dark-border)',
              borderRadius: 'var(--rx-radius-lg)',
              padding: '1.25rem',
              backdropFilter: 'blur(10px)',
              maxWidth: '460px',
            }}
          >
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--rx-lime)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Live Matching Pipeline
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#D4D8CF' }}>Internal Order ORD-10291</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>₹1,500.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#D4D8CF' }}>Gateway Txn TXN-82921</span>
                <span style={{ color: '#FFFFFF', fontWeight: 600 }}>₹1,500.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.2rem' }}>
                <span style={{ color: 'var(--rx-lime)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircleIcon size={14} /> Confidence Score: 100%
                </span>
                <span style={{ backgroundColor: 'rgba(21, 128, 61, 0.25)', color: '#4ADE80', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                  EXACT MATCH
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-inverse-muted)', zIndex: 1 }}>
          Secure, tenant-isolated enterprise financial platform.
        </div>
      </div>

      {/* Form Right Panel (Reference 3 & 1) */}
      <div className="rx-auth-content">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            Sign In to ReconcileX
          </h1>
          <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.95rem' }}>
            Enter your credentials to access your organization workspace.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--rx-danger-bg)',
              border: '1px solid var(--rx-danger-border)',
              borderRadius: 'var(--rx-radius-md)',
              color: 'var(--rx-danger)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="login-email" className="rx-label">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="rx-input"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label htmlFor="login-password" className="rx-label" style={{ margin: 0 }}>
                Password
              </label>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', textDecoration: 'underline' }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="rx-input"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rx-btn rx-btn-dark rx-btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'} <ArrowRightIcon size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--rx-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
          <div>
            Don't have an account?{' '}
            <Link to="/register" style={{ fontWeight: 700, color: 'var(--rx-text-primary)', textDecoration: 'underline' }}>
              Create new account & organization
            </Link>
          </div>
          <div>
            Invited by a team administrator?{' '}
            <Link to="/invitations/accept" style={{ color: 'var(--rx-text-secondary)', textDecoration: 'underline' }}>
              Accept invitation token
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

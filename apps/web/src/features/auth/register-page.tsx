import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { ApiError } from '../../api/errors';
import { LogoIcon, CheckCircleIcon, ArrowRightIcon, AlertCircleIcon } from '../../shared/components/icons';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetails(null);

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (orgName.trim().length < 2) {
      setError('Organization name must be at least 2 characters.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { orgId } = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        orgName: orgName.trim(),
      });

      navigate(`/orgs/${orgId}/dashboard`, { replace: true });
    } catch (err) {
      if (ApiError.isApiError(err)) {
        setError(err.message);
        if (Array.isArray(err.details)) {
          setDetails(err.details as string[]);
        }
      } else {
        setError('Registration failed. Please try again.');
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
            <span>Tenant-Isolated Workspaces</span>
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
            Deploy automated reconciliation for your team.
          </h2>

          <p style={{ fontSize: '1.05rem', color: '#B3B8AF', lineHeight: 1.6, maxWidth: '480px', marginBottom: '2rem' }}>
            Get started with instant multi-tenant organization provisioning. Manage financial data sources, invite team analysts, and run pairwise matching engines with full RBAC.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#D4D8CF', fontSize: '0.875rem' }}>
              <CheckCircleIcon size={16} style={{ color: 'var(--rx-lime)', flexShrink: 0 }} />
              <span>Full cryptographic JWT session management</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#D4D8CF', fontSize: '0.875rem' }}>
              <CheckCircleIcon size={16} style={{ color: 'var(--rx-lime)', flexShrink: 0 }} />
              <span>Granular RBAC: Admin, Finance Manager, Analyst, Auditor</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#D4D8CF', fontSize: '0.875rem' }}>
              <CheckCircleIcon size={16} style={{ color: 'var(--rx-lime)', flexShrink: 0 }} />
              <span>Immutable compliance audit logging</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-inverse-muted)', zIndex: 1 }}>
          ISO-ready financial data integrity & privacy architecture.
        </div>
      </div>

      {/* Form Right Panel (Reference 3 & 1) */}
      <div className="rx-auth-content">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            Create ReconcileX Account
          </h1>
          <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.95rem' }}>
            Register as an administrator of a new organization.
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
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <AlertCircleIcon size={16} /> Error: {error}
            </div>
            {details && (
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}>
                {details.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label htmlFor="reg-name" className="rx-label">
              Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              required
              minLength={2}
              placeholder="Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="rx-input"
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="rx-label">
              Work Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              required
              placeholder="alex@acmecorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="rx-input"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="rx-label">
              Password (min 8 characters)
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="rx-input"
            />
          </div>

          <div>
            <label htmlFor="reg-org" className="rx-label">
              Organization Name
            </label>
            <input
              id="reg-org"
              type="text"
              required
              minLength={2}
              placeholder="Acme Financial Services"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
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
            {isSubmitting ? 'Creating account...' : 'Create Account & Organization'}{' '}
            <ArrowRightIcon size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--rx-border)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 700, color: 'var(--rx-text-primary)', textDecoration: 'underline' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

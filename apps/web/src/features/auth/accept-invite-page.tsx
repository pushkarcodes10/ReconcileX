import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';
import { LogoIcon, AlertCircleIcon, ArrowRightIcon, CheckCircleIcon } from '../../shared/components/icons';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(initialToken);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Invitation token is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.acceptInvitation({
        token: token.trim(),
        name: name.trim() ? name.trim() : undefined,
        password: password ? password : undefined,
      });
      setSuccess(true);
    } catch (err) {
      if (ApiError.isApiError(err)) {
        setError(err.message);
      } else {
        setError('Failed to accept invitation. The invitation may be expired or invalid.');
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
              TEAM INVITATION
            </div>
          </div>
        </div>

        <div style={{ margin: 'auto 0', zIndex: 1 }}>
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
            Join your organization on ReconcileX.
          </h2>

          <p style={{ fontSize: '1.05rem', color: '#B3B8AF', lineHeight: 1.6, maxWidth: '480px', marginBottom: '2rem' }}>
            Collaborate on transaction matching, review potential discrepancy candidates, and escalate exceptions with assigned teammates.
          </p>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-inverse-muted)', zIndex: 1 }}>
          Multi-Tenant Role-Based Access Control
        </div>
      </div>

      {/* Form Right Panel (Reference 3 & 1) */}
      <div className="rx-auth-content">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            Accept Organization Invitation
          </h1>
          <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.95rem' }}>
            Join your team on ReconcileX using the invitation token provided by your admin.
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

        {success ? (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--rx-success-bg)',
              border: '1px solid var(--rx-success-border)',
              borderRadius: 'var(--rx-radius-lg)',
              color: 'var(--rx-success)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              <CheckCircleIcon size={20} /> Invitation Accepted!
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#166534' }}>
              You have successfully joined the organization. Please sign in with your credentials to enter the workspace.
            </p>
            <Link to="/login" className="rx-btn rx-btn-dark rx-btn-lg" style={{ display: 'inline-flex' }}>
              Proceed to Sign In <ArrowRightIcon size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="invite-token" className="rx-label">
                Invitation Token
              </label>
              <input
                id="invite-token"
                type="text"
                required
                placeholder="Paste invitation token..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isSubmitting}
                className="rx-input"
              />
            </div>

            <div>
              <label htmlFor="invite-name" className="rx-label">
                Your Name (required if new user)
              </label>
              <input
                id="invite-name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="rx-input"
              />
            </div>

            <div>
              <label htmlFor="invite-password" className="rx-label">
                Password (required if new user, min 8 characters)
              </label>
              <input
                id="invite-password"
                type="password"
                minLength={8}
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
              {isSubmitting ? 'Accepting...' : 'Accept Invitation'} <ArrowRightIcon size={16} />
            </button>
          </form>
        )}

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--rx-border)', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ color: 'var(--rx-text-primary)', fontWeight: 600 }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

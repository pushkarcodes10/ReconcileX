import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';
import { LogoIcon, AlertCircleIcon, ArrowRightIcon, ArrowLeftIcon, CheckCircleIcon } from '../../shared/components/icons';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setResetToken(null);

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.requestPasswordReset({ email });
      setMessage(res.message || 'If an account exists, a password reset token has been generated.');
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
    } catch (err) {
      if (ApiError.isApiError(err)) {
        setError(err.message);
      } else {
        setError('Failed to process password reset request.');
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
              ACCOUNT RECOVERY
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
            Secure, tokenized credential recovery.
          </h2>

          <p style={{ fontSize: '1.05rem', color: '#B3B8AF', lineHeight: 1.6, maxWidth: '480px', marginBottom: '2rem' }}>
            Account security is paramount in financial systems. Password resets require verified email tokens that expire automatically.
          </p>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-inverse-muted)', zIndex: 1 }}>
          ReconcileX Security Center & Identity Governance
        </div>
      </div>

      {/* Form Right Panel (Reference 3 & 1) */}
      <div className="rx-auth-content">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            Reset Password
          </h1>
          <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.95rem' }}>
            Enter your email to receive a password reset token.
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

        {message && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--rx-success-bg)',
              border: '1px solid var(--rx-success-border)',
              borderRadius: 'var(--rx-radius-md)',
              color: 'var(--rx-success)',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              <CheckCircleIcon size={18} /> {message}
            </div>
            {resetToken && (
              <div style={{ marginTop: '0.75rem', backgroundColor: '#FFFFFF', padding: '0.85rem', borderRadius: 'var(--rx-radius-sm)', border: '1px solid var(--rx-border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--rx-text-secondary)', textTransform: 'uppercase' }}>
                  Generated Token:
                </span>
                <div style={{ marginTop: '0.25rem', wordBreak: 'break-all' }}>
                  <code style={{ fontSize: '0.85rem', color: 'var(--rx-text-primary)' }}>{resetToken}</code>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <Link
                    to={`/reset-password?token=${encodeURIComponent(resetToken)}`}
                    className="rx-btn rx-btn-dark rx-btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Proceed to Reset Password with this Token <ArrowRightIcon size={14} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="reset-email" className="rx-label">
              Email Address
            </label>
            <input
              id="reset-email"
              type="email"
              required
              placeholder="operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {isSubmitting ? 'Requesting...' : 'Request Password Reset'} <ArrowRightIcon size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--rx-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
          <div>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-primary)', fontWeight: 600 }}>
              <ArrowLeftIcon size={14} /> Back to Sign In
            </Link>
          </div>
          <div>
            Already have a token?{' '}
            <Link to="/reset-password" style={{ color: 'var(--rx-text-secondary)', textDecoration: 'underline' }}>
              Reset password directly here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

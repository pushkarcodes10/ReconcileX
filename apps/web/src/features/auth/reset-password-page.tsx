import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';
import { LogoIcon, AlertCircleIcon, ArrowRightIcon, CheckCircleIcon } from '../../shared/components/icons';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token.trim()) {
      setError('Password reset token is required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.confirmPasswordReset({
        token: token.trim(),
        newPassword,
      });
      setSuccessMessage(res.message || 'Password reset successfully! You can now sign in.');
    } catch (err) {
      if (ApiError.isApiError(err)) {
        setError(err.message);
      } else {
        setError('Failed to reset password. The token may be invalid or expired.');
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
            Create your new secure password.
          </h2>

          <p style={{ fontSize: '1.05rem', color: '#B3B8AF', lineHeight: 1.6, maxWidth: '480px', marginBottom: '2rem' }}>
            Ensure your password is at least 8 characters with a mix of numbers and symbols to meet audit compliance standards.
          </p>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-inverse-muted)', zIndex: 1 }}>
          ReconcileX Platform Compliance Standards
        </div>
      </div>

      {/* Form Right Panel (Reference 3 & 1) */}
      <div className="rx-auth-content">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            Set New Password
          </h1>
          <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.95rem' }}>
            Enter the reset token and your new account password.
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

        {successMessage && (
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
              <CheckCircleIcon size={18} /> {successMessage}
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Link to="/login" className="rx-btn rx-btn-dark rx-btn-sm">
                Proceed to Sign In <ArrowRightIcon size={14} />
              </Link>
            </div>
          </div>
        )}

        {!successMessage && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="confirm-token" className="rx-label">
                Reset Token
              </label>
              <input
                id="confirm-token"
                type="text"
                required
                placeholder="Paste token received..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isSubmitting}
                className="rx-input"
              />
            </div>

            <div>
              <label htmlFor="new-password" className="rx-label">
                New Password (min 8 characters)
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              {isSubmitting ? 'Resetting...' : 'Confirm New Password'} <ArrowRightIcon size={16} />
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

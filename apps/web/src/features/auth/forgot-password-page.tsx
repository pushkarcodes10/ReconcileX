import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';

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
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '1rem' }}>
      <h1>Reset Password</h1>
      <p>Enter your email to receive a password reset token.</p>

      {error && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem', border: '1px solid red', padding: '0.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {message && (
        <div style={{ color: 'green', marginBottom: '1rem', border: '1px solid green', padding: '0.5rem' }}>
          <p>{message}</p>
          {resetToken && (
            <div style={{ marginTop: '0.5rem', background: '#f5f5f5', padding: '0.5rem', wordBreak: 'break-all' }}>
              <strong>Generated Reset Token:</strong>
              <div><code>{resetToken}</code></div>
              <div style={{ marginTop: '0.5rem' }}>
                <Link to={`/reset-password?token=${encodeURIComponent(resetToken)}`}>
                  Proceed to Reset Password with this Token &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="reset-email" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Email Address
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '0.6rem' }}>
          {isSubmitting ? 'Requesting...' : 'Request Password Reset'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link to="/login">Back to Sign In</Link>
        <Link to="/reset-password">Already have a token? Reset password here</Link>
      </div>
    </div>
  );
};

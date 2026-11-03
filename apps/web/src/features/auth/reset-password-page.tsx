import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';

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
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '1rem' }}>
      <h1>Set New Password</h1>
      <p>Enter the reset token and your new account password.</p>

      {error && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem', border: '1px solid red', padding: '0.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div style={{ color: 'green', marginBottom: '1rem', border: '1px solid green', padding: '0.5rem' }}>
          <p>{successMessage}</p>
          <div style={{ marginTop: '0.5rem' }}>
            <Link to="/login">Proceed to Sign In &rarr;</Link>
          </div>
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="confirm-token" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Reset Token
            </label>
            <input
              id="confirm-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="new-password" style={{ display: 'block', marginBottom: '0.25rem' }}>
              New Password (min 8 characters)
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '0.6rem' }}>
            {isSubmitting ? 'Resetting...' : 'Confirm New Password'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Link to="/login">Back to Sign In</Link>
      </div>
    </div>
  );
};

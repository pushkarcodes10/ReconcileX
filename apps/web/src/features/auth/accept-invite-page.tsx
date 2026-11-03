import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/endpoints/auth';
import { ApiError } from '../../api/errors';

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
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '1rem' }}>
      <h1>Accept Organization Invitation</h1>
      <p>Join your team on ReconcileX using the invitation token.</p>

      {error && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem', border: '1px solid red', padding: '0.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success ? (
        <div style={{ color: 'green', border: '1px solid green', padding: '1rem' }}>
          <h3>Invitation Accepted!</h3>
          <p>
            You have successfully joined the organization. Please sign in with your account to access your workspace.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/login">Sign In &rarr;</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="invite-token" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Invitation Token
            </label>
            <input
              id="invite-token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="invite-name" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Your Name (required if new user)
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="invite-password" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Password (required if new user, min 8 characters)
            </label>
            <input
              id="invite-password"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '0.6rem' }}>
            {isSubmitting ? 'Accepting...' : 'Accept Invitation'}
          </button>
        </form>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Link to="/login">Back to Sign In</Link>
      </div>
    </div>
  );
};

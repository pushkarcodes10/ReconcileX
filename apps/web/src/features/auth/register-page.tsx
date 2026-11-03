import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { ApiError } from '../../api/errors';

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
    <div style={{ maxWidth: '400px', margin: '3rem auto', padding: '1rem' }}>
      <h1>Create ReconcileX Account</h1>
      <p>Register as an administrator of a new organization.</p>

      {error && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem', border: '1px solid red', padding: '0.5rem' }}>
          <strong>Error:</strong> {error}
          {details && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {details.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="reg-name" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="reg-email" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Work Email Address
          </label>
          <input
            id="reg-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="reg-password" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Password (min 8 characters)
          </label>
          <input
            id="reg-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="reg-org" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Organization Name
          </label>
          <input
            id="reg-org"
            type="text"
            required
            minLength={2}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={isSubmitting}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '0.6rem' }}>
          {isSubmitting ? 'Creating account...' : 'Create Account & Organization'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem' }}>
        <p>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

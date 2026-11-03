import React from 'react';
import { ApiError } from '../../api/errors';
import { AlertCircleIcon, RefreshIcon, DatabaseIcon } from './icons';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading financial records...' }) => (
  <div
    style={{
      padding: '3.5rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      color: 'var(--rx-text-secondary)',
    }}
  >
    <div
      style={{
        width: '32px',
        height: '32px',
        border: '3px solid var(--rx-border)',
        borderTopColor: 'var(--rx-dark)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>{message}</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({
  title = 'No records found',
  description = 'There are no items matching this criteria at this time.',
  action,
  icon,
}) => (
  <div
    className="rx-card"
    style={{
      padding: '3.5rem 2rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--rx-surface)',
      border: '1px dashed var(--rx-border)',
      margin: '1rem 0',
    }}
  >
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: 'var(--rx-radius-full)',
        backgroundColor: 'var(--rx-surface-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--rx-text-muted)',
        marginBottom: '1rem',
      }}
    >
      {icon || <DatabaseIcon size={24} />}
    </div>
    <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>{title}</h3>
    <p style={{ margin: '0 0 1.25rem', color: 'var(--rx-text-secondary)', maxWidth: '420px', fontSize: '0.875rem' }}>
      {description}
    </p>
    {action}
  </div>
);

export const ErrorState: React.FC<{
  error: unknown;
  onRetry?: () => void;
}> = ({ error, onRetry }) => {
  let title = 'An error occurred';
  let message = 'Failed to load data.';
  let details: string[] | null = null;
  let requestId: string | null = null;

  if (ApiError.isApiError(error)) {
    title = `Error: ${error.code} (${error.status})`;
    message = error.message;
    requestId = error.requestId;
    if (Array.isArray(error.details)) {
      details = error.details;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div
      role="alert"
      className="rx-card"
      style={{
        padding: '1.25rem 1.5rem',
        margin: '1rem 0',
        border: '1px solid var(--rx-danger-border)',
        backgroundColor: 'var(--rx-danger-bg)',
        color: 'var(--rx-danger)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <AlertCircleIcon size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 0.25rem', color: '#991B1B', fontWeight: 700 }}>{title}</h4>
          <p style={{ margin: '0 0 0.5rem', color: '#7F1D1D', fontSize: '0.875rem' }}>{message}</p>
          {requestId && (
            <p style={{ fontSize: '0.75rem', color: '#B91C1C', margin: '0 0 0.5rem' }}>
              Request ID: <code style={{ backgroundColor: '#FEE2E2', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{requestId}</code>
            </p>
          )}
          {details && details.length > 0 && (
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}>
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="rx-btn rx-btn-sm"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#991B1B',
                border: '1px solid #FCA5A5',
                marginTop: '0.5rem',
              }}
            >
              <RefreshIcon size={13} /> Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

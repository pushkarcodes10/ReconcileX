import React from 'react';
import { ApiError } from '../../api/errors';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>
    <p>{message}</p>
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
}> = ({
  title = 'No records found',
  description = 'There are no items to display at this time.',
  action,
}) => (
  <div style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1px dashed #ccc', margin: '1rem 0' }}>
    <h3 style={{ margin: '0 0 0.5rem' }}>{title}</h3>
    <p style={{ margin: '0 0 1rem', color: '#666' }}>{description}</p>
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
      style={{
        padding: '1.5rem',
        margin: '1rem 0',
        border: '1px solid #d32f2f',
        backgroundColor: '#fff5f5',
        color: '#c62828',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem' }}>{title}</h3>
      <p style={{ margin: '0 0 0.5rem' }}>{message}</p>
      {requestId && (
        <p style={{ fontSize: '0.8rem', color: '#777', margin: '0 0 0.5rem' }}>
          Request ID: <code>{requestId}</code>
        </p>
      )}
      {details && details.length > 0 && (
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: '0.5rem', padding: '0.4rem 0.8rem' }}>
          Try Again
        </button>
      )}
    </div>
  );
};

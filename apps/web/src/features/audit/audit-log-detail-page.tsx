import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api/endpoints/audit';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { formatDateTime } from '../../shared/lib/date';

export const AuditLogDetailPage: React.FC = () => {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();

  const { data: log, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-log', orgId, id],
    queryFn: () => auditApi.getById(orgId!, id!),
    enabled: !!orgId && !!id,
  });

  if (isLoading) return <LoadingState message="Loading audit record..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!log) return <p>Audit record not found.</p>;

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/audit`}>&larr; Back to Audit Trail</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Audit Entry: {log.action}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>
            ID: <code>{log.id}</code> | Recorded at: {formatDateTime(log.createdAt)}
          </div>
        </div>
      </div>

      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>Event Context & Metadata</h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', width: '200px' }}><strong>Action:</strong></td>
              <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{log.action}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Target Entity:</strong></td>
              <td style={{ padding: '0.5rem' }}>
                <code>{log.entityType}</code> (ID: <code>{log.entityId}</code>)
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Actor / User:</strong></td>
              <td style={{ padding: '0.5rem' }}>
                {log.actor ? (
                  <span><strong>{log.actor.name}</strong> ({log.actor.email})</span>
                ) : (
                  <code>{log.actorId}</code>
                )}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>IP Address:</strong></td>
              <td style={{ padding: '0.5rem' }}><code>{log.ipAddress || '—'}</code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>User Agent:</strong></td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#555' }}>
                {log.userAgent || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Structured Payload Metadata */}
      {log.metadata && (
        <section style={{ border: '1px solid #eee', padding: '1rem' }}>
          <h4>Payload Snapshot / State Changes</h4>
          <pre style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', overflowX: 'auto', fontSize: '0.85rem' }}>
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};

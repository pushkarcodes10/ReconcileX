import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api/endpoints/audit';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { formatDateTime } from '../../shared/lib/date';
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
} from '../../shared/components/icons';

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
    <div style={{ maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/audit`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Audit Trail
        </Link>
      </div>

      {/* Header (Reference 1) */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--rx-radius-md)',
              backgroundColor: 'var(--rx-dark)',
              color: 'var(--rx-lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheckIcon size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
              Audit Entry: {log.action}
            </h1>
            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
              System ID: <code>{log.id}</code> | Recorded: {formatDateTime(log.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Structured Event Metadata Table (Reference 4) */}
      <section className="rx-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 700 }}>
          Event Context & Security Metadata
        </h3>

        <div className="rx-table-container">
          <table className="rx-table">
            <tbody>
              <tr>
                <td style={{ width: '220px', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Action Code</td>
                <td><strong style={{ color: 'var(--rx-text-primary)' }}>{log.action}</strong></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Target Entity</td>
                <td>
                  <code>{log.entityType}</code> (ID: <code>{log.entityId}</code>)
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Actor / Operator</td>
                <td>
                  {log.actor ? (
                    <span><strong>{log.actor.name}</strong> ({log.actor.email})</span>
                  ) : (
                    <code>{log.actorId}</code>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Originating IP Address</td>
                <td><code>{log.ipAddress || '—'}</code></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>User Agent</td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                  {log.userAgent || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Structured Payload Metadata */}
      {log.metadata && (
        <section className="rx-card" style={{ padding: '1.75rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>
            Payload Snapshot / State Changes
          </h4>
          <pre
            style={{
              backgroundColor: 'var(--rx-surface-subtle)',
              border: '1px solid var(--rx-border)',
              padding: '1rem',
              borderRadius: 'var(--rx-radius-md)',
              overflowX: 'auto',
              fontSize: '0.8125rem',
              margin: 0,
            }}
          >
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};

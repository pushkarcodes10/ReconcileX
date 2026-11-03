import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api/endpoints/audit';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';
import { AuditLog } from '../../api/types';
import {
  ShieldCheckIcon,
  UserIcon,
  XIcon,
} from '../../shared/components/icons';

export const AuditLogsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Quick inspection drawer state (Reference 4 requirement)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', orgId, page, actionFilter, entityTypeFilter, startDate, endDate],
    queryFn: () =>
      auditApi.list(orgId!, {
        page,
        limit: 20,
        action: actionFilter.trim() || undefined,
        entityType: entityTypeFilter.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Audit Trail & Compliance
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            Immutable chronological record of administrative actions, data ingestions, and exception status changes.
          </p>
        </div>
      </div>

      {/* Filter Toolbar (Reference 4) */}
      <div className="rx-card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div>
            <label className="rx-label">Action Filter</label>
            <input
              type="text"
              placeholder="e.g. EXCEPTION_RESOLVED"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          <div>
            <label className="rx-label">Entity Type</label>
            <input
              type="text"
              placeholder="e.g. EXCEPTION, RUN"
              value={entityTypeFilter}
              onChange={(e) => {
                setEntityTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          <div>
            <label className="rx-label">Date From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          <div>
            <label className="rx-label">Date To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ fontSize: '0.8125rem' }}
            />
          </div>

          {(actionFilter || entityTypeFilter || startDate || endDate) && (
            <div>
              <button
                onClick={() => {
                  setActionFilter('');
                  setEntityTypeFilter('');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="rx-btn rx-btn-ghost rx-btn-sm"
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Information-dense Audit Table (Reference 4) */}
      {isLoading ? (
        <LoadingState message="Loading immutable audit trail..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Audit Records Found"
          description="No audit log entries match the selected filters."
          icon={<ShieldCheckIcon size={24} />}
        />
      ) : (
        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Actor</th>
                <th style={{ textAlign: 'right' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr
                  key={log.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedLog(log)}
                >
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--rx-text-primary)' }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <code className="rx-col-code" style={{ backgroundColor: 'var(--rx-surface-subtle)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      {log.entityType}
                    </code>
                  </td>
                  <td>
                    <code className="rx-col-code">{log.entityId.slice(0, 8)}...</code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                      <UserIcon size={13} style={{ color: 'var(--rx-text-muted)' }} />
                      <span>{log.actor?.name || log.actor?.email || log.actorId.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="rx-btn rx-btn-secondary rx-btn-sm"
                      >
                        Inspect
                      </button>
                      <Link
                        to={`/orgs/${orgId}/audit/${log.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rx-btn rx-btn-ghost rx-btn-sm"
                      >
                        View &rarr;
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Audit Event Detail Drawer (Reference 4 requirement) */}
      {selectedLog && (
        <div className="rx-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="rx-modal-card rx-animate-fade-in" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--rx-text-muted)' }}>
                  Audit Event Drawer
                </span>
                <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  {selectedLog.action}
                </h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="rx-btn rx-btn-ghost rx-btn-sm">
                <XIcon size={16} />
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)', width: '140px' }}>Recorded At:</td>
                  <td style={{ padding: '0.5rem 0' }}>{formatDateTime(selectedLog.createdAt)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>Target Entity:</td>
                  <td style={{ padding: '0.5rem 0' }}>
                    <code>{selectedLog.entityType}</code> (ID: <code>{selectedLog.entityId}</code>)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>Actor:</td>
                  <td style={{ padding: '0.5rem 0' }}>
                    {selectedLog.actor ? `${selectedLog.actor.name} (${selectedLog.actor.email})` : selectedLog.actorId}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>IP Address:</td>
                  <td style={{ padding: '0.5rem 0' }}><code>{selectedLog.ipAddress || '—'}</code></td>
                </tr>
              </tbody>
            </table>

            {selectedLog.metadata && (
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--rx-text-secondary)' }}>
                  Payload / State Snapshot:
                </span>
                <pre
                  style={{
                    backgroundColor: 'var(--rx-surface-subtle)',
                    border: '1px solid var(--rx-border)',
                    padding: '0.85rem',
                    borderRadius: 'var(--rx-radius-md)',
                    overflowX: 'auto',
                    fontSize: '0.8rem',
                    marginTop: '0.4rem',
                    maxHeight: '200px',
                  }}
                >
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedLog(null)} className="rx-btn rx-btn-secondary">
                Close
              </button>
              <Link to={`/orgs/${orgId}/audit/${selectedLog.id}`} className="rx-btn rx-btn-dark">
                Open Full Audit Record &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

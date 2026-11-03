import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api/endpoints/audit';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';

export const AuditLogsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Audit Trail & Compliance</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Immutable chronological record of administrative actions, data ingestions, and exception status changes.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div
        style={{
          border: '1px solid #eee',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Action</label>
          <input
            type="text"
            placeholder="e.g. EXCEPTION_RESOLVED"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Entity Type</label>
          <input
            type="text"
            placeholder="e.g. EXCEPTION, RUN"
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Date From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Date To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            style={{ width: '100%', padding: '0.35rem' }}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading audit logs..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No Audit Records Found" description="No audit log entries match the selected filters." />
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.6rem' }}>Timestamp</th>
                <th style={{ padding: '0.6rem' }}>Action</th>
                <th style={{ padding: '0.6rem' }}>Entity Type</th>
                <th style={{ padding: '0.6rem' }}>Entity ID</th>
                <th style={{ padding: '0.6rem' }}>Actor</th>
                <th style={{ padding: '0.6rem' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDateTime(log.createdAt)}</td>
                  <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>{log.action}</td>
                  <td style={{ padding: '0.6rem' }}><code>{log.entityType}</code></td>
                  <td style={{ padding: '0.6rem' }}><code>{log.entityId.slice(0, 8)}...</code></td>
                  <td style={{ padding: '0.6rem' }}>
                    {log.actor?.name || log.actor?.email || <code>{log.actorId.slice(0, 8)}</code>}
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    <Link to={`/orgs/${orgId}/audit/${log.id}`}>View &rarr;</Link>
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
    </div>
  );
};

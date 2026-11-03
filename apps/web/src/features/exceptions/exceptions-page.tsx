import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { exceptionsApi } from '../../api/endpoints/exceptions';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDateTime } from '../../shared/lib/date';
import { ExceptionStatus } from '../../api/types';
import {
  AlertOctagonIcon,
  SearchIcon,
  UserIcon,
  ArrowRightIcon,
} from '../../shared/components/icons';

export const ExceptionsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ExceptionStatus | ''>(
    (searchParams.get('status') as ExceptionStatus) || ''
  );
  const [runId] = useState(searchParams.get('runId') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exceptions', orgId, page, status, runId, searchTerm],
    queryFn: () =>
      exceptionsApi.list(orgId!, {
        page,
        limit: 15,
        status: (status as ExceptionStatus) || undefined,
        runId: runId || undefined,
        q: searchTerm.trim() || undefined,
      }),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  const statusPills: { label: string; value: ExceptionStatus | '' }[] = [
    { label: 'All Exceptions', value: '' },
    { label: 'Open', value: 'OPEN' },
    { label: 'Assigned', value: 'ASSIGNED' },
    { label: 'Under Review', value: 'UNDER_REVIEW' },
    { label: 'Escalated', value: 'ESCALATED' },
    { label: 'Resolved', value: 'RESOLVED' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Exceptions Management
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            Investigate, assign, collaborate, and resolve discrepancies flagged during reconciliation.
          </p>
        </div>
      </div>

      {/* Reference 4 Filter & Search Toolbar */}
      <div className="rx-card" style={{ padding: '1rem 1.25rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {statusPills.map((pill) => (
              <button
                key={pill.label}
                onClick={() => {
                  setStatus(pill.value);
                  setPage(1);
                }}
                className={`rx-filter-pill ${status === pill.value ? 'active' : ''}`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="rx-search-box" style={{ minWidth: '260px' }}>
            <SearchIcon size={14} />
            <input
              type="text"
              placeholder="Search external ID or reference..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ padding: '0.45rem 0.75rem 0.45rem 2.2rem', fontSize: '0.8125rem' }}
            />
          </div>
        </div>
      </div>

      {/* Reference 4 Professional Exception Work Queue Table */}
      {isLoading ? (
        <LoadingState message="Loading exceptions work queue..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Exceptions Found"
          description="There are currently no reconciliation exceptions matching the selected filters."
          icon={<AlertOctagonIcon size={24} />}
        />
      ) : (
        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Exception ID</th>
                <th>Status</th>
                <th>Transaction External ID</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Assignee</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((ex) => (
                <tr key={ex.id}>
                  <td>
                    <code className="rx-col-code">{ex.id.slice(0, 8)}...</code>
                  </td>
                  <td>
                    <StatusBadge status={ex.status} />
                  </td>
                  <td>
                    <code className="rx-col-code" style={{ fontWeight: 600 }}>
                      {ex.transaction?.externalId || ex.transactionId.slice(0, 8)}
                    </code>
                  </td>
                  <td className="rx-col-amount" style={{ color: 'var(--rx-text-primary)' }}>
                    {formatAmountMinor(ex.transaction?.amountMinor, ex.transaction?.currency)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
                      <UserIcon size={13} style={{ color: ex.assigneeName ? 'var(--rx-text-primary)' : 'var(--rx-text-muted)' }} />
                      <span style={{ color: ex.assigneeName ? 'var(--rx-text-primary)' : 'var(--rx-text-muted)', fontWeight: ex.assigneeName ? 600 : 400 }}>
                        {ex.assigneeName || 'Unassigned'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                    {formatDateTime(ex.createdAt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/orgs/${orgId}/exceptions/${ex.id}`}
                      className="rx-btn rx-btn-secondary rx-btn-sm"
                      style={{ display: 'inline-flex' }}
                    >
                      Open Review <ArrowRightIcon size={13} />
                    </Link>
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

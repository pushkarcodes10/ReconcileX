import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { ApiError } from '../../api/errors';
import { DataSourceStatus } from '../../api/types';
import {
  ArrowLeftIcon,
  DatabaseIcon,
  AlertCircleIcon,
  UploadIcon,
  ReceiptIcon,
} from '../../shared/components/icons';

export const DataSourceDetailPage: React.FC = () => {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();
  const { permissions } = useOrg();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);

  const { data: dataSource, isLoading, error, refetch } = useQuery({
    queryKey: ['data-source', orgId, id],
    queryFn: () => dataSourcesApi.getById(orgId!, id!),
    enabled: !!orgId && !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: DataSourceStatus) =>
      dataSourcesApi.update(orgId!, id!, { status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-source', orgId, id] });
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to update data source status.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => dataSourcesApi.delete(orgId!, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
      navigate(`/orgs/${orgId}/data-sources`);
    },
    onError: (err: any) => {
      setActionError(
        ApiError.isApiError(err)
          ? err.message
          : 'Cannot delete data source. Transactions may be associated with it.'
      );
    },
  });

  if (isLoading) return <LoadingState message="Loading data source details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!dataSource) return <p>Data source not found.</p>;

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/data-sources`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Data Sources
        </Link>
      </div>

      {/* Header and Actions (Reference 1) */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
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
                <DatabaseIcon size={18} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{dataSource.name}</h1>
            </div>

            <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <span>Type: <strong style={{ color: 'var(--rx-text-primary)' }}>{dataSource.type}</strong></span>
              <span style={{ color: 'var(--rx-border)' }}>•</span>
              <span>Direction: <strong style={{ color: 'var(--rx-text-primary)' }}>{dataSource.direction || 'NEUTRAL'}</strong></span>
              <span style={{ color: 'var(--rx-border)' }}>•</span>
              <StatusBadge status={dataSource.status} />
            </div>
          </div>

          {permissions.canWriteDataSources && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {dataSource.status === 'ACTIVE' ? (
                <button
                  onClick={() => updateStatusMutation.mutate('INACTIVE')}
                  disabled={updateStatusMutation.isPending}
                  className="rx-btn rx-btn-secondary rx-btn-sm"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => updateStatusMutation.mutate('ACTIVE')}
                  disabled={updateStatusMutation.isPending}
                  className="rx-btn rx-btn-lime rx-btn-sm"
                >
                  Activate Feed
                </button>
              )}

              {permissions.canDeleteDataSources && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this data source? This action cannot be undone.')) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="rx-btn rx-btn-danger rx-btn-sm"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--rx-danger-bg)',
            border: '1px solid var(--rx-danger-border)',
            borderRadius: 'var(--rx-radius-md)',
            color: 'var(--rx-danger)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
          <div><strong>Error:</strong> {actionError}</div>
        </div>
      )}

      {/* Column Mappings Configuration Section */}
      <section className="rx-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700 }}>
          Column Mappings Configuration
        </h3>
        <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Expected CSV header column names required during CSV batch ingestion.
        </p>

        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Standard Field</th>
                <th>Mapped CSV Header</th>
                <th>Requirement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>External Transaction ID</strong></td>
                <td><code className="rx-col-code">{dataSource.columnMapping?.external_id}</code></td>
                <td><span style={{ color: 'var(--rx-danger)', fontWeight: 600, fontSize: '0.75rem' }}>Required</span></td>
              </tr>
              <tr>
                <td><strong>Amount</strong></td>
                <td><code className="rx-col-code">{dataSource.columnMapping?.amount}</code></td>
                <td><span style={{ color: 'var(--rx-danger)', fontWeight: 600, fontSize: '0.75rem' }}>Required</span></td>
              </tr>
              <tr>
                <td><strong>Transaction Date</strong></td>
                <td><code className="rx-col-code">{dataSource.columnMapping?.date}</code></td>
                <td><span style={{ color: 'var(--rx-danger)', fontWeight: 600, fontSize: '0.75rem' }}>Required</span></td>
              </tr>
              <tr>
                <td><strong>Currency</strong></td>
                <td><code className="rx-col-code">{dataSource.columnMapping?.currency}</code></td>
                <td><span style={{ color: 'var(--rx-danger)', fontWeight: 600, fontSize: '0.75rem' }}>Required</span></td>
              </tr>
              {dataSource.columnMapping?.reference && (
                <tr>
                  <td><strong>Reference / Memo</strong></td>
                  <td><code className="rx-col-code">{dataSource.columnMapping?.reference}</code></td>
                  <td><span style={{ color: 'var(--rx-text-muted)', fontSize: '0.75rem' }}>Optional</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick Action Cards (Reference 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {permissions.canUploadCsv && (
          <Link
            to={`/orgs/${orgId}/imports/new`}
            className="rx-card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
              backgroundColor: 'var(--rx-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UploadIcon size={18} style={{ color: 'var(--rx-text-primary)' }} />
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--rx-text-primary)' }}>Upload CSV Batch</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Ingest file into this source</div>
              </div>
            </div>
            <span style={{ color: 'var(--rx-text-muted)' }}>&rarr;</span>
          </Link>
        )}

        <Link
          to={`/orgs/${orgId}/transactions?sourceId=${dataSource.id}`}
          className="rx-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textDecoration: 'none',
            backgroundColor: 'var(--rx-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ReceiptIcon size={18} style={{ color: 'var(--rx-text-primary)' }} />
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--rx-text-primary)' }}>View Transactions</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Filtered to this data source</div>
            </div>
          </div>
          <span style={{ color: 'var(--rx-text-muted)' }}>&rarr;</span>
        </Link>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { ApiError } from '../../api/errors';
import { DataSourceStatus } from '../../api/types';

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
      // Handles 409 Conflict if transactions are tied to this data source
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
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/data-sources`}>&larr; Back to Data Sources</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{dataSource.name}</h1>
          <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Type: <strong>{dataSource.type}</strong></span> |
            <span>Direction: <strong>{dataSource.direction || 'NEUTRAL'}</strong></span> |
            <StatusBadge status={dataSource.status} />
          </div>
        </div>

        {permissions.canWriteDataSources && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {dataSource.status === 'ACTIVE' ? (
              <button
                onClick={() => updateStatusMutation.mutate('INACTIVE')}
                disabled={updateStatusMutation.isPending}
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => updateStatusMutation.mutate('ACTIVE')}
                disabled={updateStatusMutation.isPending}
              >
                Activate
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
                style={{ color: 'red' }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.75rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* Column Mappings Inspection */}
      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>Column Mappings Configuration</h3>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Expected CSV header column names required during CSV import:
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', width: '200px' }}><strong>External ID:</strong></td>
              <td style={{ padding: '0.5rem' }}><code>{dataSource.columnMapping?.external_id}</code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Amount:</strong></td>
              <td style={{ padding: '0.5rem' }}><code>{dataSource.columnMapping?.amount}</code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Date:</strong></td>
              <td style={{ padding: '0.5rem' }}><code>{dataSource.columnMapping?.date}</code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Currency:</strong></td>
              <td style={{ padding: '0.5rem' }}><code>{dataSource.columnMapping?.currency}</code></td>
            </tr>
            {dataSource.columnMapping?.reference && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}><strong>Reference:</strong></td>
                <td style={{ padding: '0.5rem' }}><code>{dataSource.columnMapping?.reference}</code></td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Quick Action Links */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        {permissions.canUploadCsv && (
          <Link to={`/orgs/${orgId}/imports/new`}>+ Upload CSV to this Data Source</Link>
        )}
        <Link to={`/orgs/${orgId}/transactions?sourceId=${dataSource.id}`}>
          View Associated Transactions &rarr;
        </Link>
      </div>
    </div>
  );
};

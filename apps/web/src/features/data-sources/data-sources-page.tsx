import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApi, CreateDataSourceDto } from '../../api/endpoints/data-sources';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { DataSourceType } from '../../api/types';
import { ApiError } from '../../api/errors';

export const DataSourcesPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { permissions } = useOrg();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for creating a new data source
  const [name, setName] = useState('');
  const [type, setType] = useState<DataSourceType>('INTERNAL_ORDERS');
  const [direction, setDirection] = useState<'INBOUND' | 'OUTBOUND' | 'NEUTRAL'>('INBOUND');
  const [colExtId, setColExtId] = useState('id');
  const [colAmount, setColAmount] = useState('amount');
  const [colDate, setColDate] = useState('date');
  const [colCurrency, setColCurrency] = useState('currency');
  const [colRef, setColRef] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateDataSourceDto) => dataSourcesApi.create(orgId!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources', orgId] });
      setIsCreating(false);
      setName('');
      setFormError(null);
    },
    onError: (err: any) => {
      if (ApiError.isApiError(err)) {
        setFormError(err.message);
      } else {
        setFormError('Failed to create data source.');
      }
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Data source name is required.');
      return;
    }
    if (!colExtId || !colAmount || !colDate || !colCurrency) {
      setFormError('Required column mappings: External ID, Amount, Date, and Currency must be specified.');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      type,
      direction,
      columnMapping: {
        external_id: colExtId.trim(),
        amount: colAmount.trim(),
        date: colDate.trim(),
        currency: colCurrency.trim(),
        reference: colRef.trim() ? colRef.trim() : undefined,
      },
    });
  };

  if (!orgId) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Data Sources</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Configure source definitions, column mappings, and file ingestion channels.
          </p>
        </div>
        {permissions.canWriteDataSources && !isCreating && (
          <button onClick={() => setIsCreating(true)} style={{ padding: '0.5rem 1rem' }}>
            + New Data Source
          </button>
        )}
      </div>

      {/* New Data Source Form */}
      {isCreating && (
        <div style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3>Configure New Data Source</h3>

          {formError && (
            <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.5rem', marginBottom: '1rem' }}>
              <strong>Error:</strong> {formError}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Data Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe Gateway, Internal Ledger"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Source Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as DataSourceType)}
                  style={{ width: '100%', padding: '0.4rem' }}
                >
                  <option value="INTERNAL_ORDERS">INTERNAL_ORDERS</option>
                  <option value="PAYMENT_GATEWAY">PAYMENT_GATEWAY</option>
                  <option value="BANK">BANK</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>Direction</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  style={{ width: '100%', padding: '0.4rem' }}
                >
                  <option value="INBOUND">INBOUND</option>
                  <option value="OUTBOUND">OUTBOUND</option>
                  <option value="NEUTRAL">NEUTRAL</option>
                </select>
              </div>
            </div>

            <fieldset style={{ border: '1px solid #eee', padding: '1rem', marginBottom: '1rem' }}>
              <legend>CSV Column Mapping (Header Names in CSV)</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>External ID *</label>
                  <input
                    type="text"
                    required
                    value={colExtId}
                    onChange={(e) => setColExtId(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Amount *</label>
                  <input
                    type="text"
                    required
                    value={colAmount}
                    onChange={(e) => setColAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Date *</label>
                  <input
                    type="text"
                    required
                    value={colDate}
                    onChange={(e) => setColDate(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Currency *</label>
                  <input
                    type="text"
                    required
                    value={colCurrency}
                    onChange={(e) => setColCurrency(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Reference (optional)</label>
                  <input
                    type="text"
                    value={colRef}
                    onChange={(e) => setColRef(e.target.value)}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
              </div>
            </fieldset>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" disabled={createMutation.isPending} style={{ padding: '0.5rem 1rem' }}>
                {createMutation.isPending ? 'Saving...' : 'Save Data Source'}
              </button>
              <button type="button" onClick={() => setIsCreating(false)} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Data Sources List */}
      {isLoading ? (
        <LoadingState message="Loading data sources..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Data Sources Configured"
          description="Create your first data source to begin importing transaction CSVs."
          action={
            permissions.canWriteDataSources ? (
              <button onClick={() => setIsCreating(true)}>Create Data Source</button>
            ) : undefined
          }
        />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '0.6rem' }}>Name</th>
              <th style={{ padding: '0.6rem' }}>Type</th>
              <th style={{ padding: '0.6rem' }}>Status</th>
              <th style={{ padding: '0.6rem' }}>Direction</th>
              <th style={{ padding: '0.6rem' }}>Required Columns</th>
              <th style={{ padding: '0.6rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((ds) => (
              <tr key={ds.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.6rem' }}>
                  <strong>{ds.name}</strong>
                </td>
                <td style={{ padding: '0.6rem' }}>{ds.type}</td>
                <td style={{ padding: '0.6rem' }}>
                  <StatusBadge status={ds.status} />
                </td>
                <td style={{ padding: '0.6rem' }}>{ds.direction || '—'}</td>
                <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
                  id: <code>{ds.columnMapping?.external_id}</code> | amt: <code>{ds.columnMapping?.amount}</code> | date:{' '}
                  <code>{ds.columnMapping?.date}</code>
                </td>
                <td style={{ padding: '0.6rem' }}>
                  <Link to={`/orgs/${orgId}/data-sources/${ds.id}`}>View & Manage &rarr;</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

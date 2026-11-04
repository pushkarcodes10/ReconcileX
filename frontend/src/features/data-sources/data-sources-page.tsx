import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApi, CreateDataSourceDto } from '../../api/endpoints/data-sources';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { DataSourceType } from '../../api/types';
import { ApiError } from '../../api/errors';
import {
  DatabaseIcon,
  PlusIcon,
  ArrowRightIcon,
  AlertCircleIcon,
} from '../../shared/components/icons';

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

  const totalSources = data?.total ?? 0;
  const activeSources = data?.items?.filter((d) => d.status === 'ACTIVE').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Data Sources
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            Configure source definitions, column mappings, and file ingestion channels.
          </p>
        </div>
        {permissions.canWriteDataSources && !isCreating && (
          <button onClick={() => setIsCreating(true)} className="rx-btn rx-btn-lime">
            <PlusIcon size={16} /> New Data Source
          </button>
        )}
      </div>

      {/* Summary KPI Cards (Reference 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Configured Sources</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-lime)', margin: '0.35rem 0' }}>{totalSources}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Active pipelines: {activeSources}</div>
        </div>

        <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#1A2917' }}>Supported Feeds</div>
          <div className="rx-bento-val" style={{ color: '#0F290D', margin: '0.35rem 0' }}>3 Formats</div>
          <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>Orders, Gateway settlements, Bank statements</div>
        </div>

        <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: 'var(--rx-text-secondary)' }}>Ingestion Protocol</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-text-primary)', margin: '0.35rem 0' }}>CSV Sync</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Header-mapped schema validation</div>
        </div>
      </div>

      {/* New Data Source Modal / Workspace Form (Reference 1) */}
      {isCreating && (
        <div className="rx-card rx-animate-fade-in" style={{ padding: '1.75rem', border: '1px solid var(--rx-dark)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Configure New Data Source</h3>
            <button onClick={() => setIsCreating(false)} className="rx-btn rx-btn-ghost rx-btn-sm">
              Cancel
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--rx-danger-bg)',
                border: '1px solid var(--rx-danger-border)',
                borderRadius: 'var(--rx-radius-md)',
                color: 'var(--rx-danger)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircleIcon size={16} />
              <div><strong>Error:</strong> {formError}</div>
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="rx-label">Data Source Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe Gateway, Internal Orders"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rx-input"
                />
              </div>

              <div>
                <label className="rx-label">Source Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as DataSourceType)}
                  className="rx-select"
                >
                  <option value="INTERNAL_ORDERS">INTERNAL_ORDERS (ERP / E-Commerce)</option>
                  <option value="PAYMENT_GATEWAY">PAYMENT_GATEWAY (Stripe / Razorpay)</option>
                  <option value="BANK">BANK (Statement feed)</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="rx-label">Direction *</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  className="rx-select"
                >
                  <option value="INBOUND">INBOUND (Credits / Inflows)</option>
                  <option value="OUTBOUND">OUTBOUND (Debits / Payouts)</option>
                  <option value="NEUTRAL">NEUTRAL</option>
                </select>
              </div>
            </div>

            {/* Column Mapping Section */}
            <div
              style={{
                backgroundColor: 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-lg)',
                padding: '1.25rem',
                border: '1px solid var(--rx-border)',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>CSV Header Mapping</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)' }}>
                  (Enter exact CSV column header names)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label className="rx-label">External ID Column *</label>
                  <input
                    type="text"
                    required
                    value={colExtId}
                    onChange={(e) => setColExtId(e.target.value)}
                    placeholder="id"
                    className="rx-input"
                  />
                </div>
                <div>
                  <label className="rx-label">Amount Column *</label>
                  <input
                    type="text"
                    required
                    value={colAmount}
                    onChange={(e) => setColAmount(e.target.value)}
                    placeholder="amount"
                    className="rx-input"
                  />
                </div>
                <div>
                  <label className="rx-label">Date Column *</label>
                  <input
                    type="text"
                    required
                    value={colDate}
                    onChange={(e) => setColDate(e.target.value)}
                    placeholder="date"
                    className="rx-input"
                  />
                </div>
                <div>
                  <label className="rx-label">Currency Column *</label>
                  <input
                    type="text"
                    required
                    value={colCurrency}
                    onChange={(e) => setColCurrency(e.target.value)}
                    placeholder="currency"
                    className="rx-input"
                  />
                </div>
                <div>
                  <label className="rx-label">Reference Column (Optional)</label>
                  <input
                    type="text"
                    value={colRef}
                    onChange={(e) => setColRef(e.target.value)}
                    placeholder="reference"
                    className="rx-input"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" disabled={createMutation.isPending} className="rx-btn rx-btn-dark">
                {createMutation.isPending ? 'Saving...' : 'Save Data Source'}
              </button>
              <button type="button" onClick={() => setIsCreating(false)} className="rx-btn rx-btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Data Sources List (Reference 4 Table style) */}
      {isLoading ? (
        <LoadingState message="Loading data sources..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Data Sources Configured"
          description="Create your first data source to begin importing transaction CSVs."
          icon={<DatabaseIcon size={24} />}
          action={
            permissions.canWriteDataSources ? (
              <button onClick={() => setIsCreating(true)} className="rx-btn rx-btn-lime">
                <PlusIcon size={14} /> Create Data Source
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Source Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Direction</th>
                <th>Mapped Columns</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((ds) => (
                <tr key={ds.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <DatabaseIcon size={16} style={{ color: 'var(--rx-text-secondary)' }} />
                      <strong style={{ fontWeight: 700 }}>{ds.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--rx-radius-sm)', backgroundColor: 'var(--rx-surface-muted)', fontWeight: 600 }}>
                      {ds.type}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={ds.status} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)', fontWeight: 500 }}>
                      {ds.direction || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.75rem', fontFamily: 'var(--rx-font-mono)' }}>
                      <span style={{ backgroundColor: 'var(--rx-surface-subtle)', border: '1px solid var(--rx-border)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                        id: {ds.columnMapping?.external_id || (ds.columnMapping as any)?.externalId}
                      </span>
                      <span style={{ backgroundColor: 'var(--rx-surface-subtle)', border: '1px solid var(--rx-border)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                        amt: {ds.columnMapping?.amount}
                      </span>
                      <span style={{ backgroundColor: 'var(--rx-surface-subtle)', border: '1px solid var(--rx-border)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                        date: {ds.columnMapping?.date || (ds.columnMapping as any)?.transaction_date || (ds.columnMapping as any)?.transactionDate}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/orgs/${orgId}/data-sources/${ds.id}`}
                      className="rx-btn rx-btn-secondary rx-btn-sm"
                      style={{ display: 'inline-flex' }}
                    >
                      View & Manage <ArrowRightIcon size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationApi, CreateReconciliationRunDto } from '../../api/endpoints/reconciliation';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { ApiError } from '../../api/errors';
import { generateIdempotencyKey } from '../../shared/lib/idempotency';
import {
  ArrowLeftIcon,
  AlertCircleIcon,
  DatabaseIcon,
  CalendarIcon,
  SlidersIcon,
} from '../../shared/components/icons';

export const NewReconciliationRunPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sourceA, setSourceA] = useState('');
  const [sourceB, setSourceB] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Optional matching engine configuration
  const [showConfig, setShowConfig] = useState(false);
  const [dateWindowDays, setDateWindowDays] = useState(2);
  const [potentialThreshold, setPotentialThreshold] = useState(60);
  const [exactThreshold] = useState(100);

  const [idempotencyKey] = useState(() => generateIdempotencyKey());
  const [error, setError] = useState<string | null>(null);

  // Fetch active data sources for selection
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  const createRunMutation = useMutation({
    mutationFn: (dto: CreateReconciliationRunDto) =>
      reconciliationApi.createRun(orgId!, dto, idempotencyKey),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-runs', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
      navigate(`/orgs/${orgId}/reconciliation/${res.runId}`);
    },
    onError: (err: any) => {
      if (ApiError.isApiError(err)) {
        setError(err.message);
      } else {
        setError('Failed to initiate reconciliation run. Please check parameters.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceA || !sourceB) {
      setError('Please select two distinct data sources for pairwise reconciliation.');
      return;
    }
    if (sourceA === sourceB) {
      setError('Data Source A and Data Source B must be different.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Both Date From and Date To are required.');
      return;
    }
    if (new Date(dateFrom) > new Date(dateTo)) {
      setError('Date From cannot be later than Date To.');
      return;
    }

    createRunMutation.mutate({
      sourceA,
      sourceB,
      dateFrom,
      dateTo,
      config: showConfig
        ? {
            dateWindowDays,
            potentialThreshold,
            exactThreshold,
          }
        : undefined,
    });
  };

  if (!orgId) return null;

  const sourceAName = sources?.items.find((s) => s.id === sourceA)?.name;
  const sourceBName = sources?.items.find((s) => s.id === sourceB)?.name;

  return (
    <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/reconciliation`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Reconciliation
        </Link>
      </div>

      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Start Pairwise Reconciliation Run
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
          Compare two transaction sources within a specified date window to discover exact and potential matches.
        </p>
      </div>

      {/* Guided Step Workflow Indicators (Reference 1 & 3) */}
      <div
        className="rx-card"
        style={{
          padding: '1.25rem',
          backgroundColor: '#FFFFFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: sourceA && sourceB ? 'var(--rx-lime)' : 'var(--rx-surface-muted)', color: 'var(--rx-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
            1
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Select Sources</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-secondary)' }}>Pairwise comparison</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: dateFrom && dateTo ? 'var(--rx-lime)' : 'var(--rx-surface-muted)', color: 'var(--rx-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
            2
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Date Range</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-secondary)' }}>Matching window</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: showConfig ? 'var(--rx-lime)' : 'var(--rx-surface-muted)', color: 'var(--rx-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
            3
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Parameters</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-secondary)' }}>Engine thresholds</div>
          </div>
        </div>
      </div>

      {error && (
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
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {/* Step-based Structured Form (Reference 1) */}
      <form onSubmit={handleSubmit} className="rx-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Step 1: Pairwise Sources */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <DatabaseIcon size={16} style={{ color: 'var(--rx-text-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>1. Pairwise Data Sources</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label htmlFor="source-a" className="rx-label">
                Data Source A (e.g. Internal Ledger / Orders) *
              </label>
              <select
                id="source-a"
                required
                value={sourceA}
                onChange={(e) => setSourceA(e.target.value)}
                disabled={sourcesLoading || createRunMutation.isPending}
                className="rx-select"
              >
                <option value="">-- Select Source A --</option>
                {sources?.items.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="source-b" className="rx-label">
                Data Source B (e.g. Bank / Payment Gateway) *
              </label>
              <select
                id="source-b"
                required
                value={sourceB}
                onChange={(e) => setSourceB(e.target.value)}
                disabled={sourcesLoading || createRunMutation.isPending}
                className="rx-select"
              >
                <option value="">-- Select Source B --</option>
                {sources?.items.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Date Window */}
        <div style={{ borderTop: '1px solid var(--rx-border-subtle)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CalendarIcon size={16} style={{ color: 'var(--rx-text-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>2. Reconciliation Date Window</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label htmlFor="date-from" className="rx-label">
                Date From *
              </label>
              <input
                id="date-from"
                type="date"
                required
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={createRunMutation.isPending}
                className="rx-input"
              />
            </div>

            <div>
              <label htmlFor="date-to" className="rx-label">
                Date To *
              </label>
              <input
                id="date-to"
                type="date"
                required
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={createRunMutation.isPending}
                className="rx-input"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Engine Thresholds & Parameters */}
        <div style={{ borderTop: '1px solid var(--rx-border-subtle)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SlidersIcon size={16} style={{ color: 'var(--rx-text-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>3. Advanced Matching Parameters</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="rx-btn rx-btn-ghost rx-btn-sm"
              style={{ color: 'var(--rx-text-primary)', fontWeight: 600 }}
            >
              {showConfig ? '▲ Hide Advanced Parameters' : '▼ Configure Thresholds'}
            </button>
          </div>

          {showConfig && (
            <div
              style={{
                backgroundColor: 'var(--rx-surface-subtle)',
                padding: '1.25rem',
                borderRadius: 'var(--rx-radius-lg)',
                border: '1px solid var(--rx-border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <label className="rx-label">Date Tolerance Window (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={dateWindowDays}
                  onChange={(e) => setDateWindowDays(Number(e.target.value))}
                  className="rx-input"
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)' }}>Default: ±2 days</span>
              </div>

              <div>
                <label className="rx-label">Potential Match Threshold (%)</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={potentialThreshold}
                  onChange={(e) => setPotentialThreshold(Number(e.target.value))}
                  className="rx-input"
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)' }}>Minimum score for potential match</span>
              </div>

              <div>
                <label className="rx-label">Exact Match Threshold (%)</label>
                <input
                  type="number"
                  min="100"
                  max="100"
                  value={exactThreshold}
                  disabled
                  className="rx-input"
                  style={{ backgroundColor: 'var(--rx-surface-muted)', color: 'var(--rx-text-secondary)' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)' }}>Fixed at 100% (Strict parity)</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Configuration Review Summary */}
        {(sourceA || sourceB || dateFrom || dateTo) && (
          <div
            style={{
              backgroundColor: 'var(--rx-dark)',
              color: '#FFFFFF',
              borderRadius: 'var(--rx-radius-lg)',
              padding: '1.25rem 1.5rem',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--rx-lime)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Execution Summary
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <span style={{ color: '#A3A8A0' }}>Pair: </span>
                <strong style={{ color: '#FFFFFF' }}>{sourceAName || '—'}</strong> vs{' '}
                <strong style={{ color: '#FFFFFF' }}>{sourceBName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#A3A8A0' }}>Window: </span>
                <strong style={{ color: '#FFFFFF' }}>{dateFrom || '—'}</strong> to{' '}
                <strong style={{ color: '#FFFFFF' }}>{dateTo || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#A3A8A0' }}>Tolerance: </span>
                <strong style={{ color: 'var(--rx-lime)' }}>±{dateWindowDays} days</strong>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={createRunMutation.isPending || !sourceA || !sourceB || !dateFrom || !dateTo}
          className="rx-btn rx-btn-dark rx-btn-lg"
          style={{ width: '100%' }}
        >
          {createRunMutation.isPending ? 'Executing Reconciliation Run...' : 'Execute Reconciliation Run'}
        </button>
      </form>
    </div>
  );
};

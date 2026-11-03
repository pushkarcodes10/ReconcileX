import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reconciliationApi, CreateReconciliationRunDto } from '../../api/endpoints/reconciliation';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { ApiError } from '../../api/errors';
import { generateIdempotencyKey } from '../../shared/lib/idempotency';

export const NewReconciliationRunPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sourceA, setSourceA] = useState('');
  const [sourceB, setSourceB] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Optional matching config
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

  return (
    <div style={{ maxWidth: '650px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/reconciliation`}>&larr; Back to Reconciliation</Link>
      </div>

      <h1>Start Pairwise Reconciliation Run</h1>
      <p style={{ color: '#666' }}>
        Compare two transaction sources within a specified date window to discover exact and potential matches.
      </p>

      {error && (
        <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.75rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label htmlFor="source-a" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Data Source A (e.g. Internal Ledger) *
            </label>
            <select
              id="source-a"
              required
              value={sourceA}
              onChange={(e) => setSourceA(e.target.value)}
              disabled={sourcesLoading || createRunMutation.isPending}
              style={{ width: '100%', padding: '0.45rem' }}
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
            <label htmlFor="source-b" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Data Source B (e.g. Bank / Payment Gateway) *
            </label>
            <select
              id="source-b"
              required
              value={sourceB}
              onChange={(e) => setSourceB(e.target.value)}
              disabled={sourcesLoading || createRunMutation.isPending}
              style={{ width: '100%', padding: '0.45rem' }}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label htmlFor="date-from" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Date From *
            </label>
            <input
              id="date-from"
              type="date"
              required
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={createRunMutation.isPending}
              style={{ width: '100%', padding: '0.4rem' }}
            />
          </div>

          <div>
            <label htmlFor="date-to" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Date To *
            </label>
            <input
              id="date-to"
              type="date"
              required
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={createRunMutation.isPending}
              style={{ width: '100%', padding: '0.4rem' }}
            />
          </div>
        </div>

        {/* Optional Matching Engine Parameters */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0 }}
          >
            {showConfig ? '▲ Hide Advanced Matching Parameters' : '▼ Advanced Matching Parameters'}
          </button>

          {showConfig && (
            <fieldset style={{ border: '1px solid #ddd', padding: '1rem', marginTop: '0.5rem' }}>
              <legend>Engine Thresholds</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Date Window (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={dateWindowDays}
                    onChange={(e) => setDateWindowDays(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Potential Threshold (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={potentialThreshold}
                    onChange={(e) => setPotentialThreshold(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem' }}>Exact Threshold (%)</label>
                  <input
                    type="number"
                    min="100"
                    max="100"
                    value={exactThreshold}
                    disabled
                    style={{ width: '100%', padding: '0.3rem' }}
                  />
                </div>
              </div>
            </fieldset>
          )}
        </div>

        <button
          type="submit"
          disabled={createRunMutation.isPending || !sourceA || !sourceB || !dateFrom || !dateTo}
          style={{ padding: '0.6rem 1.5rem' }}
        >
          {createRunMutation.isPending ? 'Executing Reconciliation Run...' : 'Execute Reconciliation Run'}
        </button>
      </form>
    </div>
  );
};

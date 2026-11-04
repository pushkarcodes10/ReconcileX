import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '../../api/endpoints/transactions';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatAmountMinor, toAmountMinor } from '../../shared/lib/amount';
import { formatDate, formatDateTime } from '../../shared/lib/date';
import { TransactionStatus, Transaction } from '../../api/types';
import { useOrg } from '../../org/org-provider';
import {
  SearchIcon,
  ReceiptIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  XIcon,
  CameraIcon,
} from '../../shared/components/icons';

export const TransactionsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const { permissions } = useOrg();

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sourceId, setSourceId] = useState(searchParams.get('sourceId') || '');
  const [status, setStatus] = useState<TransactionStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick Inspection Drawer state
  const [inspectTxn, setInspectTxn] = useState<Transaction | null>(null);

  // 1. Data sources query for filter
  const { data: dataSources } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  // 2. Transactions query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', orgId, page, limit, sourceId, status, dateFrom, dateTo, amountInput, searchTerm],
    queryFn: () =>
      transactionsApi.list(orgId!, {
        page,
        limit,
        sourceId: sourceId || undefined,
        status: (status as TransactionStatus) || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        amount: amountInput ? toAmountMinor(amountInput) : undefined,
        q: searchTerm.trim() || undefined,
      }),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  const quickStatusFilters: { label: string; value: TransactionStatus | '' }[] = [
    { label: 'All Records', value: '' },
    { label: 'Matched', value: 'MATCHED' },
    { label: 'Potential Match', value: 'POTENTIAL_MATCH' },
    { label: 'Unmatched', value: 'UNMATCHED' },
    { label: 'Exception', value: 'EXCEPTION' },
    { label: 'Imported', value: 'IMPORTED' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Title & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Transactions Explorer
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            Read-only financial transaction records across all ingested data sources.
          </p>
        </div>

        {permissions.canUploadCsv && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link
              to={`/orgs/${orgId}/transactions/screenshot`}
              className="rx-btn rx-btn-lime"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
            >
              <CameraIcon size={16} /> Upload Screenshot Receipt
            </Link>
          </div>
        )}
      </div>

      {/* Reference 4 Filter & Search Toolbar */}
      <div className="rx-card" style={{ padding: '1rem 1.25rem', backgroundColor: '#FFFFFF' }}>
        {/* Status Pill Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '1px solid var(--rx-border-subtle)', paddingBottom: '0.85rem' }}>
          {quickStatusFilters.map((pill) => (
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

        {/* Detailed Controls: Data Source, Dates, Amount, Search */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.85rem',
            alignItems: 'end',
          }}
        >
          <div>
            <label className="rx-label">Data Source</label>
            <select
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setPage(1);
              }}
              className="rx-select"
              style={{ padding: '0.45rem 2rem 0.45rem 0.75rem', fontSize: '0.8125rem' }}
            >
              <option value="">All Sources</option>
              {dataSources?.items.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="rx-label">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}
            />
          </div>

          <div>
            <label className="rx-label">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem' }}
            />
          </div>

          <div>
            <label className="rx-label">Amount Filter</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 1500.00"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setPage(1);
              }}
              className="rx-input"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8125rem' }}
            />
          </div>

          <div>
            <label className="rx-label">Search (External ID / Ref)</label>
            <div className="rx-search-box" style={{ width: '100%' }}>
              <SearchIcon size={14} />
              <input
                type="text"
                placeholder="ORD-10291, TXN..."
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
      </div>

      {/* Reference 4 Professional Financial Data Table */}
      {isLoading ? (
        <LoadingState message="Loading financial transactions..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Transactions Found"
          description="No financial transactions match the selected filter parameters."
          icon={<ReceiptIcon size={24} />}
        />
      ) : (
        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>External ID</th>
                <th>Transaction Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Reference / Memo</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((txn) => (
                <tr
                  key={txn.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setInspectTxn(txn)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: txn.amountMinor >= 0 ? '#EAF7EE' : '#FEECEB',
                          color: txn.amountMinor >= 0 ? 'var(--rx-success)' : 'var(--rx-danger)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {txn.amountMinor >= 0 ? <ArrowDownLeftIcon size={13} /> : <ArrowUpRightIcon size={13} />}
                      </span>
                      <code className="rx-col-code" style={{ fontWeight: 600 }}>{txn.externalId}</code>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                    {formatDate(txn.transactionDate)}
                  </td>
                  <td className="rx-col-amount" style={{ color: txn.amountMinor < 0 ? 'var(--rx-danger)' : 'var(--rx-text-primary)' }}>
                    {formatAmountMinor(txn.amountMinor, txn.currency)}
                  </td>
                  <td>
                    <StatusBadge status={txn.status} />
                  </td>
                  <td style={{ color: 'var(--rx-text-secondary)', fontSize: '0.8125rem' }}>
                    {txn.reference || '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectTxn(txn);
                        }}
                        className="rx-btn rx-btn-secondary rx-btn-sm"
                        title="Quick Preview"
                      >
                        Inspect
                      </button>
                      <Link
                        to={`/orgs/${orgId}/transactions/${txn.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rx-btn rx-btn-ghost rx-btn-sm"
                        title="Full Record"
                      >
                        Details &rarr;
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

      {/* Transaction Quick Inspection Drawer (Reference 4 requirement) */}
      {inspectTxn && (
        <div className="rx-modal-overlay" onClick={() => setInspectTxn(null)}>
          <div className="rx-modal-card rx-animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--rx-text-muted)' }}>
                  Transaction Inspector
                </span>
                <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                  {inspectTxn.externalId}
                </h3>
              </div>
              <button onClick={() => setInspectTxn(null)} className="rx-btn rx-btn-ghost rx-btn-sm">
                <XIcon size={16} />
              </button>
            </div>

            <div style={{ backgroundColor: 'var(--rx-surface-subtle)', padding: '1rem', borderRadius: 'var(--rx-radius-md)', marginBottom: '1.25rem', border: '1px solid var(--rx-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--rx-text-secondary)', fontSize: '0.85rem' }}>Formatted Amount:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--rx-font-mono)' }}>
                  {formatAmountMinor(inspectTxn.amountMinor, inspectTxn.currency)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--rx-text-secondary)' }}>Status:</span>
                <StatusBadge status={inspectTxn.status} />
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)', width: '140px' }}>Internal ID:</td>
                  <td style={{ padding: '0.5rem 0' }}><code>{inspectTxn.id}</code></td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>Date:</td>
                  <td style={{ padding: '0.5rem 0' }}>{formatDateTime(inspectTxn.transactionDate)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>Reference:</td>
                  <td style={{ padding: '0.5rem 0' }}>{inspectTxn.reference || '—'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>Minor Units:</td>
                  <td style={{ padding: '0.5rem 0' }}><code>{inspectTxn.amountMinor}</code> {inspectTxn.currency}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--rx-border-subtle)' }}>
                  <td style={{ padding: '0.5rem 0', color: 'var(--rx-text-secondary)' }}>Data Source:</td>
                  <td style={{ padding: '0.5rem 0' }}><code>{inspectTxn.dataSourceId}</code></td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setInspectTxn(null)} className="rx-btn rx-btn-secondary">
                Close
              </button>
              <Link
                to={`/orgs/${orgId}/transactions/${inspectTxn.id}`}
                className="rx-btn rx-btn-dark"
              >
                Open Full Record &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

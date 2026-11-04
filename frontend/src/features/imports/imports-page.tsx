import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { importsApi } from '../../api/endpoints/imports';
import { dataSourcesApi } from '../../api/endpoints/data-sources';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';
import { ImportStatus } from '../../api/types';
import {
  FileSpreadsheetIcon,
  PlusIcon,
  ArrowRightIcon,
  AlertOctagonIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from '../../shared/components/icons';

export const ImportsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { permissions } = useOrg();

  const [activeTab, setActiveTab] = useState<'imports' | 'duplicates'>('imports');
  const [page, setPage] = useState(1);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ImportStatus | ''>('');

  // 1. Data Sources query for filter dropdown
  const { data: dataSources } = useQuery({
    queryKey: ['data-sources', orgId],
    queryFn: () => dataSourcesApi.list(orgId!, { page: 1, limit: 100 }),
    enabled: !!orgId,
  });

  // 2. Imports list query
  const {
    data: importsData,
    isLoading: importsLoading,
    error: importsError,
    refetch: refetchImports,
  } = useQuery({
    queryKey: ['imports', orgId, page, selectedSourceId, selectedStatus],
    queryFn: () =>
      importsApi.listImports(orgId!, {
        page,
        limit: 15,
        dataSourceId: selectedSourceId || undefined,
        status: (selectedStatus as ImportStatus) || undefined,
      }),
    enabled: !!orgId && activeTab === 'imports',
    refetchInterval: (query) => {
      const items = query.state.data?.items;
      const hasActive = items?.some(
        (i) => i.status === 'QUEUED' || i.status === 'PROCESSING'
      );
      return hasActive ? 2500 : false;
    },
  });

  // 3. Duplicate Candidates query (Quarantine)
  const {
    data: duplicatesData,
    isLoading: duplicatesLoading,
    error: duplicatesError,
    refetch: refetchDuplicates,
  } = useQuery({
    queryKey: ['duplicate-candidates', orgId, page, selectedSourceId],
    queryFn: () =>
      importsApi.listDuplicateCandidates(orgId!, {
        page,
        limit: 20,
        dataSourceId: selectedSourceId || undefined,
      }),
    enabled: !!orgId && activeTab === 'duplicates',
  });

  if (!orgId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header & Upload CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Imports & Ingestion
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            CSV batch ingestion history, row error audits, and duplicate quarantine.
          </p>
        </div>
        {permissions.canUploadCsv && (
          <Link to={`/orgs/${orgId}/imports/new`} className="rx-btn rx-btn-lime">
            <PlusIcon size={16} /> Upload New CSV
          </Link>
        )}
      </div>

      {/* Styled Tabs (Reference 1 & 4) */}
      <div className="rx-tabs">
        <button
          onClick={() => {
            setActiveTab('imports');
            setPage(1);
          }}
          className={`rx-tab-btn ${activeTab === 'imports' ? 'active' : ''}`}
        >
          <FileSpreadsheetIcon size={16} />
          <span>Import Batches</span>
          {importsData && <span className="rx-tab-counter">{importsData.total}</span>}
        </button>

        <button
          onClick={() => {
            setActiveTab('duplicates');
            setPage(1);
          }}
          className={`rx-tab-btn ${activeTab === 'duplicates' ? 'active' : ''}`}
        >
          <AlertOctagonIcon size={16} />
          <span>Duplicate Candidates Quarantine (Read-Only)</span>
          {duplicatesData && <span className="rx-tab-counter">{duplicatesData.total}</span>}
        </button>
      </div>

      {/* Filter Toolbar (Reference 4) */}
      <div className="rx-card" style={{ padding: '1rem 1.25rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rx-text-secondary)' }}>
              Data Source:
            </span>
            <select
              value={selectedSourceId}
              onChange={(e) => {
                setSelectedSourceId(e.target.value);
                setPage(1);
              }}
              className="rx-select"
              style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8125rem' }}
            >
              <option value="">All Data Sources</option>
              {dataSources?.items.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.type})
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'imports' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rx-text-secondary)' }}>
                Status:
              </span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setPage(1);
                }}
                className="rx-select"
                style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8125rem' }}
              >
                <option value="">All Statuses</option>
                <option value="QUEUED">QUEUED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          )}

          {(selectedSourceId || selectedStatus) && (
            <button
              onClick={() => {
                setSelectedSourceId('');
                setSelectedStatus('');
                setPage(1);
              }}
              className="rx-btn rx-btn-ghost rx-btn-sm"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Tab Content: Imports */}
      {activeTab === 'imports' && (
        <div>
          {importsLoading ? (
            <LoadingState message="Loading imports list..." />
          ) : importsError ? (
            <ErrorState error={importsError} onRetry={() => refetchImports()} />
          ) : !importsData || importsData.items.length === 0 ? (
            <EmptyState
              title="No Imports Found"
              description="No CSV files have been imported for this filter selection."
              icon={<FileSpreadsheetIcon size={24} />}
              action={
                permissions.canUploadCsv ? (
                  <Link to={`/orgs/${orgId}/imports/new`} className="rx-btn rx-btn-lime">
                    Upload CSV Now
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="rx-table-container">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>Import ID</th>
                    <th>Status</th>
                    <th>Total Records</th>
                    <th>Valid Imported</th>
                    <th>Invalid (Errors)</th>
                    <th>Duplicates</th>
                    <th>Created At</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {importsData.items.map((imp) => (
                    <tr key={imp.id}>
                      <td>
                        <code className="rx-col-code">{imp.id.slice(0, 8)}...</code>
                      </td>
                      <td>
                        <StatusBadge status={imp.status} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{imp.totalRecords ?? imp.rowCount ?? 0}</td>
                      <td style={{ color: 'var(--rx-success)', fontWeight: 600 }}>{imp.validRecords ?? imp.validCount ?? 0}</td>
                      <td style={{ color: (imp.invalidRecords ?? imp.invalidCount ?? 0) > 0 ? 'var(--rx-danger)' : 'var(--rx-text-secondary)', fontWeight: (imp.invalidRecords ?? imp.invalidCount ?? 0) > 0 ? 700 : 500 }}>
                        {imp.invalidRecords ?? imp.invalidCount ?? 0}
                      </td>
                      <td style={{ color: (imp.duplicateRecords ?? imp.duplicateCount ?? 0) > 0 ? 'var(--rx-warning)' : 'var(--rx-text-secondary)', fontWeight: (imp.duplicateRecords ?? imp.duplicateCount ?? 0) > 0 ? 700 : 500 }}>
                        {imp.duplicateRecords ?? imp.duplicateCount ?? 0}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                        {formatDateTime(imp.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/orgs/${orgId}/imports/${imp.id}`}
                          className="rx-btn rx-btn-secondary rx-btn-sm"
                          style={{ display: 'inline-flex' }}
                        >
                          View & Errors <ArrowRightIcon size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={page}
                totalPages={importsData.totalPages}
                total={importsData.total}
                limit={importsData.limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Duplicate Candidates Quarantine */}
      {activeTab === 'duplicates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              backgroundColor: 'var(--rx-pale-yellow-light)',
              border: '1px solid var(--rx-pale-yellow)',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--rx-radius-md)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#423E07',
            }}
          >
            <AlertCircleIcon size={16} />
            <div>
              <strong>Quarantine Notice:</strong> The backend stores potential duplicate transaction candidates for
              quarantine review. Per current API capabilities, this list is read-only.
            </div>
          </div>

          {duplicatesLoading ? (
            <LoadingState message="Loading duplicate candidates..." />
          ) : duplicatesError ? (
            <ErrorState error={duplicatesError} onRetry={() => refetchDuplicates()} />
          ) : !duplicatesData || duplicatesData.items.length === 0 ? (
            <EmptyState
              title="No Duplicate Candidates Found"
              description="No duplicate transaction candidates are flagged in the quarantine."
              icon={<CheckCircleIcon size={24} />}
            />
          ) : (
            <div className="rx-table-container">
              <table className="rx-table">
                <thead>
                  <tr>
                    <th>Candidate ID</th>
                    <th>Transaction ID</th>
                    <th>Duplicate Of ID</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Reasons</th>
                    <th>Flagged At</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicatesData.items.map((dup) => (
                    <tr key={dup.id}>
                      <td><code className="rx-col-code">{dup.id.slice(0, 8)}</code></td>
                      <td><code className="rx-col-code">{dup.transactionId.slice(0, 8)}</code></td>
                      <td><code className="rx-col-code">{dup.duplicateOfId.slice(0, 8)}</code></td>
                      <td><StatusBadge status={dup.status} /></td>
                      <td style={{ fontWeight: 700 }}>{dup.confidenceScore ?? '—'}%</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                        {dup.reasons?.join(', ') || '—'}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                        {formatDateTime(dup.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={page}
                totalPages={duplicatesData.totalPages}
                total={duplicatesData.total}
                limit={duplicatesData.limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

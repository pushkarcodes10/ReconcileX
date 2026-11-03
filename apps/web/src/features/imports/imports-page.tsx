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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Imports & Ingestion</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            CSV batch ingestion history, row error audits, and duplicate quarantine.
          </p>
        </div>
        {permissions.canUploadCsv && (
          <Link to={`/orgs/${orgId}/imports/new`}>
            <button style={{ padding: '0.5rem 1rem' }}>+ Upload New CSV</button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #ccc', marginBottom: '1.5rem' }}>
        <button
          onClick={() => {
            setActiveTab('imports');
            setPage(1);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderBottom: activeTab === 'imports' ? '3px solid black' : 'none',
            fontWeight: activeTab === 'imports' ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Import Batches
        </button>
        <button
          onClick={() => {
            setActiveTab('duplicates');
            setPage(1);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderBottom: activeTab === 'duplicates' ? '3px solid black' : 'none',
            fontWeight: activeTab === 'duplicates' ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Duplicate Candidates Quarantine (Read-Only)
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <label>
          Data Source:{' '}
          <select
            value={selectedSourceId}
            onChange={(e) => {
              setSelectedSourceId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Data Sources</option>
            {dataSources?.items.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>
        </label>

        {activeTab === 'imports' && (
          <label>
            Status:{' '}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">QUEUED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </label>
        )}
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
              action={
                permissions.canUploadCsv ? (
                  <Link to={`/orgs/${orgId}/imports/new`}>
                    <button>Upload CSV Now</button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '0.6rem' }}>Import ID</th>
                    <th style={{ padding: '0.6rem' }}>Status</th>
                    <th style={{ padding: '0.6rem' }}>Records</th>
                    <th style={{ padding: '0.6rem' }}>Valid</th>
                    <th style={{ padding: '0.6rem' }}>Invalid</th>
                    <th style={{ padding: '0.6rem' }}>Duplicates</th>
                    <th style={{ padding: '0.6rem' }}>Created At</th>
                    <th style={{ padding: '0.6rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {importsData.items.map((imp) => (
                    <tr key={imp.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.6rem' }}>
                        <code>{imp.id.slice(0, 8)}...</code>
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <StatusBadge status={imp.status} />
                      </td>
                      <td style={{ padding: '0.6rem' }}>{imp.totalRecords}</td>
                      <td style={{ padding: '0.6rem', color: 'green' }}>{imp.validRecords}</td>
                      <td style={{ padding: '0.6rem', color: imp.invalidRecords > 0 ? 'red' : 'inherit' }}>
                        {imp.invalidRecords}
                      </td>
                      <td style={{ padding: '0.6rem', color: imp.duplicateRecords > 0 ? 'orange' : 'inherit' }}>
                        {imp.duplicateRecords}
                      </td>
                      <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDateTime(imp.createdAt)}</td>
                      <td style={{ padding: '0.6rem' }}>
                        <Link to={`/orgs/${orgId}/imports/${imp.id}`}>View & Errors &rarr;</Link>
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
        <div>
          <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '0.75rem', marginBottom: '1rem' }}>
            <strong>Quarantine Notice:</strong> The backend stores potential duplicate transaction candidates for
            quarantine review. Per current API capabilities, this list is read-only.
          </div>

          {duplicatesLoading ? (
            <LoadingState message="Loading duplicate candidates..." />
          ) : duplicatesError ? (
            <ErrorState error={duplicatesError} onRetry={() => refetchDuplicates()} />
          ) : !duplicatesData || duplicatesData.items.length === 0 ? (
            <EmptyState
              title="No Duplicate Candidates Found"
              description="No duplicate transaction candidates are flagged in the quarantine."
            />
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc' }}>
                    <th style={{ padding: '0.6rem' }}>Candidate ID</th>
                    <th style={{ padding: '0.6rem' }}>Transaction ID</th>
                    <th style={{ padding: '0.6rem' }}>Duplicate Of ID</th>
                    <th style={{ padding: '0.6rem' }}>Status</th>
                    <th style={{ padding: '0.6rem' }}>Confidence</th>
                    <th style={{ padding: '0.6rem' }}>Reasons</th>
                    <th style={{ padding: '0.6rem' }}>Flagged At</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicatesData.items.map((dup) => (
                    <tr key={dup.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.6rem' }}><code>{dup.id.slice(0, 8)}</code></td>
                      <td style={{ padding: '0.6rem' }}><code>{dup.transactionId.slice(0, 8)}</code></td>
                      <td style={{ padding: '0.6rem' }}><code>{dup.duplicateOfId.slice(0, 8)}</code></td>
                      <td style={{ padding: '0.6rem' }}><StatusBadge status={dup.status} /></td>
                      <td style={{ padding: '0.6rem' }}>{dup.confidenceScore ?? '—'}%</td>
                      <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{dup.reasons?.join(', ') || '—'}</td>
                      <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDateTime(dup.createdAt)}</td>
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

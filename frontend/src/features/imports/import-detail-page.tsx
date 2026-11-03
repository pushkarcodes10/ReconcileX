import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { importsApi } from '../../api/endpoints/imports';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';
import { ArrowLeftIcon, FileSpreadsheetIcon, CheckCircleIcon } from '../../shared/components/icons';

export const ImportDetailPage: React.FC = () => {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();
  const [errorPage, setErrorPage] = useState(1);

  // Import record detail
  const { data: record, isLoading: recordLoading, error: recordError, refetch } = useQuery({
    queryKey: ['import', orgId, id],
    queryFn: () => importsApi.getImportById(orgId!, id!),
    enabled: !!orgId && !!id,
  });

  // Row errors paginated query
  const { data: errorsData, isLoading: errorsLoading } = useQuery({
    queryKey: ['import-errors', orgId, id, errorPage],
    queryFn: () => importsApi.getImportErrors(orgId!, id!, { page: errorPage, limit: 20 }),
    enabled: !!orgId && !!id,
  });

  if (recordLoading) return <LoadingState message="Loading import record..." />;
  if (recordError) return <ErrorState error={recordError} onRetry={() => refetch()} />;
  if (!record) return <p>Import record not found.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/imports`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Imports
        </Link>
      </div>

      {/* Header (Reference 1) */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FileSpreadsheetIcon size={20} style={{ color: 'var(--rx-text-primary)' }} />
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Import Batch #{record.id.slice(0, 8)}
              </h1>
            </div>
            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Created at: {formatDateTime(record.createdAt)} | Full ID: <code>{record.id}</code>
            </div>
          </div>
          <div>
            <StatusBadge status={record.status} />
          </div>
        </div>
      </div>

      {/* Counters Breakdown (Reference 2 Bento Metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Total Ingested</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-lime)' }}>{record.totalRecords}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Raw rows parsed from CSV</div>
        </div>

        <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#1A2917' }}>Valid Records</div>
          <div className="rx-bento-val" style={{ color: '#0F290D' }}>{record.validRecords}</div>
          <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>Successfully inserted into ledger</div>
        </div>

        <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: 'var(--rx-danger)' }}>Invalid (Row Errors)</div>
          <div className="rx-bento-val" style={{ color: record.invalidRecords > 0 ? 'var(--rx-danger)' : 'var(--rx-text-primary)' }}>
            {record.invalidRecords}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Validation failures isolated below</div>
        </div>

        <div className="rx-bento-card rx-bento-yellow" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#383204' }}>Duplicate Candidates</div>
          <div className="rx-bento-val" style={{ color: '#383204' }}>{record.duplicateRecords}</div>
          <div style={{ fontSize: '0.75rem', color: '#595009' }}>Routed to quarantine log</div>
        </div>
      </div>

      {/* Row Errors Inspection (Reference 4) */}
      <section className="rx-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 700 }}>
          CSV Row Validation Errors ({record.invalidRecords})
        </h3>
        <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Detailed record of rows that failed schema validation (e.g., date parsing, missing required columns, malformed minor amounts).
        </p>

        {errorsLoading ? (
          <LoadingState message="Loading validation error rows..." />
        ) : !errorsData || errorsData.items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', color: 'var(--rx-text-secondary)' }}>
            <CheckCircleIcon size={20} style={{ color: 'var(--rx-success)', marginBottom: '0.5rem' }} />
            <div>No row validation errors recorded for this import batch.</div>
          </div>
        ) : (
          <div className="rx-table-container">
            <table className="rx-table">
              <thead>
                <tr>
                  <th>Row #</th>
                  <th>Field</th>
                  <th>Error Code</th>
                  <th>Raw Value</th>
                  <th>Error Message</th>
                </tr>
              </thead>
              <tbody>
                {errorsData.items.map((err, i) => (
                  <tr key={i}>
                    <td><code className="rx-col-code">{err.rowNumber}</code></td>
                    <td><code>{err.field}</code></td>
                    <td>
                      <span style={{ color: 'var(--rx-danger)', fontWeight: 700, fontSize: '0.75rem' }}>
                        {err.code}
                      </span>
                    </td>
                    <td><code className="rx-col-code">{err.rawValue || '—'}</code></td>
                    <td style={{ fontSize: '0.8125rem' }}>{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              page={errorPage}
              totalPages={errorsData.totalPages}
              total={errorsData.total}
              limit={errorsData.limit}
              onPageChange={setErrorPage}
            />
          </div>
        )}
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { importsApi } from '../../api/endpoints/imports';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';

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
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/imports`}>&larr; Back to Imports</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Import #{record.id.slice(0, 8)}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>
            Created at: {formatDateTime(record.createdAt)} | Status: <StatusBadge status={record.status} />
          </div>
        </div>
      </div>

      {/* Counters Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Total Records</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{record.totalRecords}</div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Valid Records</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'green' }}>{record.validRecords}</div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Invalid (Row Errors)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'red' }}>{record.invalidRecords}</div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Duplicate Candidates</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'orange' }}>{record.duplicateRecords}</div>
        </div>
      </div>

      {/* Row Errors Inspection */}
      <section style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        <h2>CSV Row Validation Errors ({record.invalidRecords})</h2>

        {errorsLoading ? (
          <LoadingState message="Loading validation error rows..." />
        ) : !errorsData || errorsData.items.length === 0 ? (
          <p style={{ color: '#666' }}>No row validation errors recorded for this import.</p>
        ) : (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc' }}>
                  <th style={{ padding: '0.5rem' }}>Row #</th>
                  <th style={{ padding: '0.5rem' }}>Field</th>
                  <th style={{ padding: '0.5rem' }}>Error Code</th>
                  <th style={{ padding: '0.5rem' }}>Raw Value</th>
                  <th style={{ padding: '0.5rem' }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {errorsData.items.map((err, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}><code>{err.rowNumber}</code></td>
                    <td style={{ padding: '0.5rem' }}><code>{err.field}</code></td>
                    <td style={{ padding: '0.5rem', color: 'red' }}>{err.code}</td>
                    <td style={{ padding: '0.5rem' }}><code>{err.rawValue || '—'}</code></td>
                    <td style={{ padding: '0.5rem' }}>{err.message}</td>
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

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '../../api/endpoints/jobs';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';
import { JobStatus, JobType } from '../../api/types';

export const JobsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [jobType, setJobType] = useState<JobType | ''>('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', orgId, page, status, jobType],
    queryFn: () =>
      jobsApi.list(orgId!, {
        page,
        limit: 15,
        status: (status as JobStatus) || undefined,
        jobType: (jobType as JobType) || undefined,
      }),
    enabled: !!orgId,
    // Poll list every 5s if any running or queued jobs might exist
    refetchInterval: 5000,
  });

  if (!orgId) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Background Jobs & Processing</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Monitor asynchronous pipelines, CSV import ingestion jobs, and pairwise reconciliation runs.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <label>
          Status:{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="QUEUED">QUEUED</option>
            <option value="RUNNING">RUNNING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </label>

        <label>
          Job Type:{' '}
          <select
            value={jobType}
            onChange={(e) => {
              setJobType(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="CSV_IMPORT">CSV_IMPORT</option>
            <option value="RECONCILIATION_RUN">RECONCILIATION_RUN</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <LoadingState message="Loading jobs..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No Jobs Found" description="No jobs match the selected filter criteria." />
      ) : (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.6rem' }}>Job ID</th>
                <th style={{ padding: '0.6rem' }}>Type</th>
                <th style={{ padding: '0.6rem' }}>Status</th>
                <th style={{ padding: '0.6rem' }}>Progress</th>
                <th style={{ padding: '0.6rem' }}>Message</th>
                <th style={{ padding: '0.6rem' }}>Created At</th>
                <th style={{ padding: '0.6rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem' }}><code>{job.id.slice(0, 8)}...</code></td>
                  <td style={{ padding: '0.6rem' }}><strong>{job.jobType}</strong></td>
                  <td style={{ padding: '0.6rem' }}><StatusBadge status={job.status} /></td>
                  <td style={{ padding: '0.6rem' }}>{job.progress ?? 0}%</td>
                  <td style={{ padding: '0.6rem', color: '#666' }}>{job.message || '—'}</td>
                  <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDateTime(job.createdAt)}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <Link to={`/orgs/${orgId}/jobs/${job.id}`}>Inspect Job &rarr;</Link>
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
    </div>
  );
};

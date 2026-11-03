import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '../../api/endpoints/jobs';
import { LoadingState, ErrorState, EmptyState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { Pagination } from '../../shared/components/pagination';
import { formatDateTime } from '../../shared/lib/date';
import { JobStatus, JobType } from '../../api/types';
import {
  CpuIcon,
  ArrowRightIcon,
} from '../../shared/components/icons';

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
    refetchInterval: 5000,
  });

  if (!orgId) return null;

  const totalJobs = data?.total ?? 0;
  const runningCount = data?.items?.filter((j) => j.status === 'RUNNING' || j.status === 'QUEUED').length ?? 0;
  const completedCount = data?.items?.filter((j) => j.status === 'COMPLETED').length ?? 0;
  const failedCount = data?.items?.filter((j) => j.status === 'FAILED').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Background Jobs & Processing
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
            Monitor asynchronous pipelines, CSV import ingestion jobs, and pairwise reconciliation runs.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards (Reference 2 Bento) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="rx-bento-card rx-bento-dark" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#D4D8CF' }}>Total Pipeline Tasks</div>
          <div className="rx-bento-val" style={{ color: 'var(--rx-lime)' }}>{totalJobs}</div>
          <div style={{ fontSize: '0.75rem', color: '#A3A8A0' }}>Asynchronous jobs logged</div>
        </div>

        <div className="rx-bento-card rx-bento-yellow" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#383204' }}>Active / Queued</div>
          <div className="rx-bento-val" style={{ color: '#383204' }}>{runningCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#595009' }}>In flight processing</div>
        </div>

        <div className="rx-bento-card rx-bento-sage" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: '#1A2917' }}>Completed Jobs</div>
          <div className="rx-bento-val" style={{ color: '#0F290D' }}>{completedCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#2B4228' }}>Successfully executed</div>
        </div>

        <div className="rx-bento-card rx-bento-white" style={{ padding: '1.25rem' }}>
          <div className="rx-bento-label" style={{ color: 'var(--rx-danger)' }}>Failed Jobs</div>
          <div className="rx-bento-val" style={{ color: failedCount > 0 ? 'var(--rx-danger)' : 'var(--rx-text-primary)' }}>
            {failedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Failures with stacktrace</div>
        </div>
      </div>

      {/* Filter Controls (Reference 4) */}
      <div className="rx-card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rx-text-secondary)' }}>Status:</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(1);
              }}
              className="rx-select"
              style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8125rem' }}
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">QUEUED</option>
              <option value="RUNNING">RUNNING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rx-text-secondary)' }}>Job Type:</span>
            <select
              value={jobType}
              onChange={(e) => {
                setJobType(e.target.value as any);
                setPage(1);
              }}
              className="rx-select"
              style={{ padding: '0.4rem 2rem 0.4rem 0.75rem', fontSize: '0.8125rem' }}
            >
              <option value="">All Types</option>
              <option value="CSV_IMPORT">CSV_IMPORT</option>
              <option value="RECONCILIATION_RUN">RECONCILIATION_RUN</option>
            </select>
          </div>

          {(status || jobType) && (
            <button
              onClick={() => {
                setStatus('');
                setJobType('');
                setPage(1);
              }}
              className="rx-btn rx-btn-ghost rx-btn-sm"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Professional Job Table (Reference 4) */}
      {isLoading ? (
        <LoadingState message="Loading background jobs..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="No Jobs Found"
          description="No jobs match the selected filter criteria."
          icon={<CpuIcon size={24} />}
        />
      ) : (
        <div className="rx-table-container">
          <table className="rx-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Pipeline Type</th>
                <th>Status</th>
                <th style={{ width: '160px' }}>Progress</th>
                <th>Current Stage / Message</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((job) => (
                <tr key={job.id}>
                  <td><code className="rx-col-code">{job.id.slice(0, 8)}...</code></td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{job.jobType}</span>
                  </td>
                  <td><StatusBadge status={job.status} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          flex: 1,
                          height: '6px',
                          backgroundColor: 'var(--rx-surface-muted)',
                          borderRadius: 'var(--rx-radius-full)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(job.progress ?? 0, 100)}%`,
                            height: '100%',
                            backgroundColor: job.status === 'FAILED' ? 'var(--rx-danger)' : job.status === 'COMPLETED' ? 'var(--rx-success)' : 'var(--rx-dark)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '32px', textAlign: 'right' }}>
                        {job.progress ?? 0}%
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                    {job.message || '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                    {formatDateTime(job.createdAt)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/orgs/${orgId}/jobs/${job.id}`}
                      className="rx-btn rx-btn-secondary rx-btn-sm"
                      style={{ display: 'inline-flex' }}
                    >
                      Inspect <ArrowRightIcon size={13} />
                    </Link>
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

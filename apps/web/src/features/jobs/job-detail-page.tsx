import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '../../api/endpoints/jobs';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatDateTime } from '../../shared/lib/date';
import {
  ArrowLeftIcon,
  CpuIcon,
  AlertCircleIcon,
} from '../../shared/components/icons';

export const JobDetailPage: React.FC = () => {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();

  // Poll ONLY while QUEUED or RUNNING! Stop immediately once terminal (COMPLETED or FAILED)
  const { data: job, isLoading, error, refetch } = useQuery({
    queryKey: ['job', orgId, id],
    queryFn: () => jobsApi.getById(orgId!, id!),
    enabled: !!orgId && !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'QUEUED' || status === 'RUNNING') {
        return 2000;
      }
      return false;
    },
  });

  if (isLoading) return <LoadingState message="Loading job details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!job) return <p>Job not found.</p>;

  return (
    <div style={{ maxWidth: '850px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/jobs`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Jobs
        </Link>
      </div>

      {/* Header (Reference 1) */}
      <div className="rx-card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--rx-radius-md)',
                  backgroundColor: 'var(--rx-dark)',
                  color: 'var(--rx-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CpuIcon size={18} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Job: {job.jobType}
              </h1>
            </div>
            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Job ID: <code>{job.id}</code>
            </div>
          </div>
          <div>
            <StatusBadge status={job.status} />
          </div>
        </div>
      </div>

      {/* Progress & Lifecycle Card */}
      <section className="rx-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 700 }}>
          Execution Progress & Stage
        </h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--rx-text-secondary)' }}>
              Current Progress
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--rx-font-mono)' }}>
              {job.progress ?? 0}%
            </span>
          </div>
          <div
            style={{
              height: '8px',
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
        </div>

        <div className="rx-table-container">
          <table className="rx-table">
            <tbody>
              <tr>
                <td style={{ width: '220px', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Status</td>
                <td><StatusBadge status={job.status} /></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Current Message</td>
                <td>{job.message || '—'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Created At</td>
                <td>{formatDateTime(job.createdAt)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Last Updated</td>
                <td>{formatDateTime(job.updatedAt)}</td>
              </tr>
              {job.referenceId && (
                <tr>
                  <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Target Reference</td>
                  <td>
                    {job.jobType === 'CSV_IMPORT' ? (
                      <Link
                        to={`/orgs/${orgId}/imports/${job.referenceId}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                      >
                        View Associated Import Record (<code>{job.referenceId.slice(0, 8)}</code>) &rarr;
                      </Link>
                    ) : job.jobType === 'RECONCILIATION_RUN' ? (
                      <Link
                        to={`/orgs/${orgId}/reconciliation/${job.referenceId}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                      >
                        View Associated Reconciliation Run (<code>{job.referenceId.slice(0, 8)}</code>) &rarr;
                      </Link>
                    ) : (
                      <code>{job.referenceId}</code>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Error Details if Failed */}
      {job.error && (
        <section
          className="rx-card"
          style={{
            padding: '1.5rem',
            border: '1px solid var(--rx-danger-border)',
            backgroundColor: 'var(--rx-danger-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--rx-danger)', fontWeight: 800, marginBottom: '0.5rem' }}>
            <AlertCircleIcon size={18} /> Job Execution Failure Details
          </div>
          <pre style={{ margin: 0, overflowX: 'auto', fontSize: '0.8125rem', color: '#7F1D1D' }}>
            {typeof job.error === 'string' ? job.error : JSON.stringify(job.error, null, 2)}
          </pre>
        </section>
      )}

      {/* Result Payload if Succeeded */}
      {job.result && (
        <section className="rx-card" style={{ padding: '1.75rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>
            Execution Output & Statistics
          </h4>
          <pre
            style={{
              backgroundColor: 'var(--rx-surface-subtle)',
              border: '1px solid var(--rx-border)',
              padding: '1rem',
              borderRadius: 'var(--rx-radius-md)',
              overflowX: 'auto',
              fontSize: '0.8125rem',
              margin: 0,
            }}
          >
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};

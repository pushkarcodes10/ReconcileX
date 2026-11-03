import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '../../api/endpoints/jobs';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatDateTime } from '../../shared/lib/date';

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
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling completely
    },
  });

  if (isLoading) return <LoadingState message="Loading job details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!job) return <p>Job not found.</p>;

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/jobs`}>&larr; Back to Jobs</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Job: {job.jobType}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>
            ID: <code>{job.id}</code> | Status: <StatusBadge status={job.status} />
          </div>
        </div>
      </div>

      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>Job Lifecycle & Status</h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', width: '200px' }}><strong>Status:</strong></td>
              <td style={{ padding: '0.5rem' }}><StatusBadge status={job.status} /></td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Progress:</strong></td>
              <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{job.progress ?? 0}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Message:</strong></td>
              <td style={{ padding: '0.5rem' }}>{job.message || '—'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Created At:</strong></td>
              <td style={{ padding: '0.5rem' }}>{formatDateTime(job.createdAt)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}><strong>Last Updated:</strong></td>
              <td style={{ padding: '0.5rem' }}>{formatDateTime(job.updatedAt)}</td>
            </tr>
            {job.referenceId && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}><strong>Target Reference:</strong></td>
                <td style={{ padding: '0.5rem' }}>
                  {job.jobType === 'CSV_IMPORT' ? (
                    <Link to={`/orgs/${orgId}/imports/${job.referenceId}`}>
                      View Associated Import Record (<code>{job.referenceId.slice(0, 8)}</code>) &rarr;
                    </Link>
                  ) : job.jobType === 'RECONCILIATION_RUN' ? (
                    <Link to={`/orgs/${orgId}/reconciliation/${job.referenceId}`}>
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
      </section>

      {/* Error Details if Failed */}
      {job.error && (
        <section style={{ border: '1px solid #d32f2f', padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: '#fff5f5' }}>
          <h4 style={{ color: '#d32f2f', margin: '0 0 0.5rem' }}>Job Execution Failure Details</h4>
          <pre style={{ margin: 0, overflowX: 'auto', fontSize: '0.85rem' }}>
            {typeof job.error === 'string' ? job.error : JSON.stringify(job.error, null, 2)}
          </pre>
        </section>
      )}

      {/* Result Payload if Succeeded */}
      {job.result && (
        <section style={{ border: '1px solid #eee', padding: '1rem' }}>
          <h4>Execution Output & Statistics</h4>
          <pre style={{ backgroundColor: '#f9f9f9', padding: '0.75rem', overflowX: 'auto', fontSize: '0.85rem' }}>
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
};

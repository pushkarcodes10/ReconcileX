import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exceptionsApi, TransitionExceptionDto } from '../../api/endpoints/exceptions';
import { organizationsApi } from '../../api/endpoints/organizations';
import { useAuth } from '../../auth/auth-provider';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { StatusBadge } from '../../shared/components/status-badge';
import { formatAmountMinor } from '../../shared/lib/amount';
import { formatDateTime, formatDate } from '../../shared/lib/date';
import { ApiError } from '../../api/errors';
import { ResolutionAction } from '../../api/types';

export const ExceptionDetailPage: React.FC = () => {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();
  const { user } = useAuth();
  const { permissions } = useOrg();
  const queryClient = useQueryClient();

  const [commentBody, setCommentBody] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionReason, setResolutionReason] = useState('');
  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>('MANUALLY_RECONCILED');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Exception Details
  const { data: ex, isLoading, error, refetch } = useQuery({
    queryKey: ['exception', orgId, id],
    queryFn: () => exceptionsApi.getById(orgId!, id!),
    enabled: !!orgId && !!id,
  });

  // 2. Fetch Members (Only for ADMIN role)
  const { data: members } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => organizationsApi.listMembers(orgId!),
    enabled: !!orgId && permissions.canAssignOtherMembers,
  });

  // Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: (dto: TransitionExceptionDto) => exceptionsApi.transitionStatus(orgId!, id!, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exception', orgId, id] });
      queryClient.invalidateQueries({ queryKey: ['exceptions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
      setShowResolveModal(false);
      setResolutionReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to transition exception status.');
    },
  });

  // Assign Mutation
  const assignMutation = useMutation({
    mutationFn: (assigneeId: string) => exceptionsApi.assign(orgId!, id!, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exception', orgId, id] });
      queryClient.invalidateQueries({ queryKey: ['exceptions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', orgId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to assign exception.');
    },
  });

  // Comment Mutation
  const commentMutation = useMutation({
    mutationFn: (body: string) => exceptionsApi.addComment(orgId!, id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exception', orgId, id] });
      setCommentBody('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to post comment.');
    },
  });

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolutionReason.trim().length < 5) {
      setActionError('Resolution reason must be at least 5 characters.');
      return;
    }

    transitionMutation.mutate({
      action: 'RESOLVE',
      resolutionReason: resolutionReason.trim(),
      resolutionAction,
    });
  };

  if (isLoading) return <LoadingState message="Loading exception record..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!ex) return <p>Exception not found.</p>;

  const isResolved = ex.status === 'RESOLVED';
  const canStartReview = !isResolved && (ex.status === 'OPEN' || ex.status === 'ASSIGNED' || ex.status === 'ESCALATED');
  const canEscalate = !isResolved && (ex.status === 'ASSIGNED' || ex.status === 'UNDER_REVIEW');
  const canResolve = !isResolved && (ex.status === 'UNDER_REVIEW' || ex.status === 'ESCALATED');
  const canReopen = isResolved;

  return (
    <div style={{ maxWidth: '850px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/orgs/${orgId}/exceptions`}>&larr; Back to Exceptions</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Exception Review: #{ex.id.slice(0, 8)}</h1>
          <div style={{ color: '#666', marginTop: '0.25rem' }}>
            Current Status: <StatusBadge status={ex.status} /> | Created: {formatDateTime(ex.createdAt)}
          </div>
        </div>
      </div>

      {actionError && (
        <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.75rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* State Machine Transition Actions */}
      {permissions.canMutateExceptions && (
        <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1.5rem', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 0.75rem' }}>Lifecycle Actions (FSM)</h4>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {canStartReview && (
              <button
                onClick={() => transitionMutation.mutate({ action: 'START_REVIEW' })}
                disabled={transitionMutation.isPending}
              >
                Start Review (Under Review)
              </button>
            )}

            {canEscalate && (
              <button
                onClick={() => transitionMutation.mutate({ action: 'ESCALATE' })}
                disabled={transitionMutation.isPending}
                style={{ color: '#d97706' }}
              >
                Escalate Exception
              </button>
            )}

            {canResolve && (
              <button
                onClick={() => setShowResolveModal(true)}
                disabled={transitionMutation.isPending}
                style={{ color: 'green', fontWeight: 'bold' }}
              >
                Resolve Exception &rarr;
              </button>
            )}

            {canReopen && (
              <button
                onClick={() => transitionMutation.mutate({ action: 'REOPEN' })}
                disabled={transitionMutation.isPending}
                style={{ color: '#b91c1c' }}
              >
                Reopen Exception
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      {showResolveModal && (
        <div style={{ border: '2px solid green', padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: '#f0fdf4' }}>
          <h3 style={{ color: 'green', margin: '0 0 0.5rem' }}>Resolve Exception</h3>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>
            Specify the formal resolution reason (min 5 characters) and choose the appropriate resolution action classification.
          </p>

          <form onSubmit={handleResolveSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="res-action" style={{ display: 'block', marginBottom: '0.25rem' }}>
                Resolution Action Classification *
              </label>
              <select
                id="res-action"
                value={resolutionAction}
                onChange={(e) => setResolutionAction(e.target.value as ResolutionAction)}
                style={{ width: '100%', padding: '0.4rem' }}
              >
                <option value="MANUALLY_RECONCILED">MANUALLY_RECONCILED</option>
                <option value="CONFIRMED_DUPLICATE">CONFIRMED_DUPLICATE</option>
                <option value="TRANSACTION_NOT_FOUND">TRANSACTION_NOT_FOUND</option>
                <option value="DATA_CORRECTION">DATA_CORRECTION</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="res-reason" style={{ display: 'block', marginBottom: '0.25rem' }}>
                Resolution Reason (min 5, max 2000 chars) *
              </label>
              <textarea
                id="res-reason"
                required
                minLength={5}
                maxLength={2000}
                rows={3}
                placeholder="Explain how this exception was investigated and resolved..."
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={transitionMutation.isPending} style={{ fontWeight: 'bold' }}>
                {transitionMutation.isPending ? 'Resolving...' : 'Confirm & Mark Resolved'}
              </button>
              <button type="button" onClick={() => setShowResolveModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Exception Detail & Assignment Section */}
      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>Details & Assignment</h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '1rem' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', width: '220px' }}><strong>Current Assignee:</strong></td>
              <td style={{ padding: '0.5rem' }}>
                {ex.assigneeName ? (
                  <span><strong>{ex.assigneeName}</strong> (ID: <code>{ex.assigneeId}</code>)</span>
                ) : (
                  <span style={{ color: '#888' }}>Unassigned</span>
                )}
              </td>
            </tr>

            {/* Assignment Controls */}
            {permissions.canMutateExceptions && !isResolved && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}><strong>Change Assignment:</strong></td>
                <td style={{ padding: '0.5rem' }}>
                  {permissions.canAssignOtherMembers && members ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        style={{ padding: '0.35rem' }}
                      >
                        <option value="">-- Select Member --</option>
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name} ({m.role})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => selectedAssignee && assignMutation.mutate(selectedAssignee)}
                        disabled={assignMutation.isPending || !selectedAssignee}
                      >
                        Assign
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => user?.id && assignMutation.mutate(user.id)}
                        disabled={assignMutation.isPending || ex.assigneeId === user?.id}
                      >
                        {ex.assigneeId === user?.id ? 'Assigned to You' : 'Assign to Myself'}
                      </button>
                      <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                        (Non-admins can self-assign)
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {/* Resolved Information */}
            {ex.resolvedAt && (
              <>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}><strong>Resolved At:</strong></td>
                  <td style={{ padding: '0.5rem' }}>{formatDateTime(ex.resolvedAt)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}><strong>Resolution Action:</strong></td>
                  <td style={{ padding: '0.5rem' }}><code>{ex.resolutionAction}</code></td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}><strong>Resolution Reason:</strong></td>
                  <td style={{ padding: '0.5rem' }}>{ex.resolutionReason}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Associated Transaction Info */}
        <h4>Flagged Transaction Information</h4>
        {ex.transaction ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.4rem', width: '220px' }}>External ID:</td>
                <td style={{ padding: '0.4rem' }}><code>{ex.transaction.externalId}</code></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.4rem' }}>Amount:</td>
                <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>
                  {formatAmountMinor(ex.transaction.amountMinor, ex.transaction.currency)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.4rem' }}>Transaction Date:</td>
                <td style={{ padding: '0.4rem' }}>{formatDate(ex.transaction.transactionDate)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.4rem' }}>Full Transaction Record:</td>
                <td style={{ padding: '0.4rem' }}>
                  <Link to={`/orgs/${orgId}/transactions/${ex.transactionId}`}>
                    Open in Transaction Explorer &rarr;
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#666' }}>Transaction ID: <code>{ex.transactionId}</code></p>
        )}
      </section>

      {/* Comments & Collaboration Timeline */}
      <section style={{ border: '1px solid #ccc', padding: '1.5rem' }}>
        <h3>Comments & Audit Collaboration</h3>

        {/* Comment Timeline */}
        {ex.comments && ex.comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {ex.comments.map((comment) => (
              <div key={comment.id} style={{ border: '1px solid #eee', padding: '0.75rem', backgroundColor: '#fcfcfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <strong>{comment.authorName || 'Team Member'}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>{formatDateTime(comment.createdAt)}</span>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>No comments recorded on this exception yet.</p>
        )}

        {/* Add Comment Box */}
        {permissions.canMutateExceptions ? (
          <div>
            <textarea
              rows={3}
              maxLength={5000}
              placeholder="Add investigation notes or commentary (max 5000 chars)..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              disabled={commentMutation.isPending}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
            />
            <button
              onClick={() => commentBody.trim() && commentMutation.mutate(commentBody.trim())}
              disabled={commentMutation.isPending || !commentBody.trim()}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: '#666' }}>
            Auditor role has read-only access. Comments are disabled.
          </p>
        )}
      </section>
    </div>
  );
};

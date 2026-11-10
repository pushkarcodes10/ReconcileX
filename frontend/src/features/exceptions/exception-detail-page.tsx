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
import {
  ArrowLeftIcon,
  AlertOctagonIcon,
  AlertCircleIcon,
  UserIcon,
  CheckCircleIcon,
  ReceiptIcon,
  CameraIcon,
  XIcon,
} from '../../shared/components/icons';
import { screenshotApi } from '../../api/endpoints/screenshot';

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

  // Screenshot preview modal state
  const [previewModalFile, setPreviewModalFile] = useState<{ url: string; filename: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleViewScreenshot = async (fileId: string, filename?: string) => {
    try {
      setPreviewLoading(true);
      const res = await screenshotApi.getFilePreviewUrl(orgId!, fileId);
      setPreviewModalFile({
        url: res.previewUrl,
        filename: filename ? `Screenshot (${filename})` : `Receipt #${fileId.slice(0, 8)}`,
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to fetch screenshot preview URL.');
    } finally {
      setPreviewLoading(false);
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Link
          to={`/orgs/${orgId}/exceptions`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--rx-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> Back to Exceptions
        </Link>
      </div>

      {/* Top Banner (Reference 1) */}
      <div className="rx-card" style={{ padding: '1.5rem 1.75rem', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--rx-radius-md)',
                  backgroundColor: 'var(--rx-danger-bg)',
                  color: 'var(--rx-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertOctagonIcon size={18} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Exception Review: #{ex.id.slice(0, 8)}
              </h1>
            </div>
            <div style={{ color: 'var(--rx-text-secondary)', marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Created: {formatDateTime(ex.createdAt)} | System ID: <code>{ex.id}</code>
            </div>
          </div>
          <div>
            <StatusBadge status={ex.status} />
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--rx-danger-bg)',
            border: '1px solid var(--rx-danger-border)',
            borderRadius: 'var(--rx-radius-md)',
            color: 'var(--rx-danger)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
          <div><strong>Error:</strong> {actionError}</div>
        </div>
      )}

      {/* Two-Part Investigation Layout (Reference 1 + Reference 4) */}
      <div className="rx-investigation-layout">
        {/* Left Column: Investigation Details, Transaction Data, Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Discrepancy Breakdown Card (Native 3-Source Reconciliation) */}
          {ex.discrepancyDetails && ex.discrepancyDetails.length > 0 && (
            <section
              className="rx-card"
              style={{
                padding: '1.75rem',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <AlertCircleIcon size={20} style={{ color: '#DC2626' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#991B1B' }}>
                  Three-Source Reconciliation Discrepancy
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {ex.discrepancyDetails.map((disc, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--rx-radius-md)',
                      border: '1px solid #FECACA',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: '0.25rem' }}>
                      {disc.type.replace('_', ' ')} • Field: {disc.field}
                    </div>
                    <div style={{ color: 'var(--rx-text-secondary)', marginBottom: '0.4rem' }}>
                      {disc.message || disc.description}
                    </div>
                    {disc.expected !== undefined && disc.actual !== undefined && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <div>Expected: <strong>{typeof disc.expected === 'number' ? formatAmountMinor(disc.expected, 'INR') : String(disc.expected)}</strong></div>
                        <div>Actual: <strong style={{ color: '#DC2626' }}>{typeof disc.actual === 'number' ? formatAmountMinor(disc.actual, 'INR') : String(disc.actual)}</strong></div>
                        {disc.difference !== undefined && (
                          <div>Difference: <strong style={{ color: '#DC2626' }}>{typeof disc.difference === 'number' ? formatAmountMinor(disc.difference, 'INR') : String(disc.difference)}</strong></div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Flagged Transaction Information Card */}
          <section className="rx-card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Flagged Transaction Information
              </h3>
              {ex.transaction && (
                <Link
                  to={`/orgs/${orgId}/transactions/${ex.transactionId}`}
                  className="rx-btn rx-btn-secondary rx-btn-sm"
                  style={{ display: 'inline-flex' }}
                >
                  <ReceiptIcon size={13} /> Explorer View &rarr;
                </Link>
              )}
            </div>

            {ex.transaction ? (
              <div className="rx-table-container">
                <table className="rx-table">
                  <tbody>
                    <tr>
                      <td style={{ width: '220px', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>External ID</td>
                      <td><code className="rx-col-code" style={{ fontWeight: 700 }}>{ex.transaction.externalId}</code></td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Discrepancy Amount</td>
                      <td style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--rx-danger)', fontFamily: 'var(--rx-font-mono)' }}>
                        {formatAmountMinor(ex.transaction.amountMinor, ex.transaction.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Transaction Date</td>
                      <td>{formatDate(ex.transaction.transactionDate)}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Transaction Status</td>
                      <td><StatusBadge status={ex.transaction.status} /></td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Data Source ID</td>
                      <td>
                        <Link to={`/orgs/${orgId}/data-sources/${ex.transaction.dataSourceId}`}>
                          <code>{ex.transaction.dataSourceId}</code> &rarr;
                        </Link>
                      </td>
                    </tr>
                    {ex.transaction.screenshotFileId && (
                      <tr>
                        <td style={{ color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Original Source Image</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleViewScreenshot(ex.transaction!.screenshotFileId!, ex.transaction!.externalId)}
                            className="rx-btn rx-btn-secondary rx-btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              backgroundColor: '#EFF6FF',
                              borderColor: '#BFDBFE',
                              color: '#1D4ED8',
                              fontWeight: 600,
                            }}
                            disabled={previewLoading}
                          >
                            <CameraIcon size={14} /> View Original Screenshot
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--rx-text-secondary)' }}>
                Transaction ID: <code>{ex.transactionId}</code>
              </p>
            )}
          </section>

          {/* Comments & Audit Collaboration Timeline */}
          <section className="rx-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 700 }}>
              Audit Comments & Investigation Notes
            </h3>

            {ex.comments && ex.comments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                {ex.comments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--rx-surface-subtle)',
                      borderRadius: 'var(--rx-radius-md)',
                      border: '1px solid var(--rx-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.85rem' }}>
                        <UserIcon size={14} style={{ color: 'var(--rx-text-secondary)' }} />
                        <span>{comment.authorName || 'Team Member'}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)' }}>
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: 'var(--rx-text-primary)' }}>
                      {comment.body}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                No investigation comments recorded on this exception yet.
              </p>
            )}

            {/* Comment Input */}
            {permissions.canMutateExceptions ? (
              <div>
                <textarea
                  rows={3}
                  maxLength={5000}
                  placeholder="Add investigation notes or commentary (max 5000 chars)..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  disabled={commentMutation.isPending}
                  className="rx-textarea"
                  style={{ marginBottom: '0.75rem' }}
                />
                <button
                  onClick={() => commentBody.trim() && commentMutation.mutate(commentBody.trim())}
                  disabled={commentMutation.isPending || !commentBody.trim()}
                  className="rx-btn rx-btn-dark"
                >
                  {commentMutation.isPending ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--rx-text-muted)', margin: 0 }}>
                Auditor role has read-only access. Comments are disabled.
              </p>
            )}
          </section>
        </div>

        {/* Right Column: Contextual Action & Resolution Panel (Reference 1) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Lifecycle State Transitions Card (FSM) */}
          <div className="rx-card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF' }}>
            <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--rx-text-secondary)' }}>
              Lifecycle Status (FSM)
            </h4>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--rx-text-secondary)' }}>Status:</span>
              <StatusBadge status={ex.status} />
            </div>

            {permissions.canMutateExceptions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {canStartReview && (
                  <button
                    onClick={() => transitionMutation.mutate({ action: 'START_REVIEW' })}
                    disabled={transitionMutation.isPending}
                    className="rx-btn rx-btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                  >
                    <span>▶ Start Review (Under Review)</span>
                  </button>
                )}

                {canEscalate && (
                  <button
                    onClick={() => transitionMutation.mutate({ action: 'ESCALATE' })}
                    disabled={transitionMutation.isPending}
                    className="rx-btn rx-btn-secondary"
                    style={{ width: '100%', justifyContent: 'flex-start', color: '#D97706' }}
                  >
                    <span>▲ Escalate to Senior Staff</span>
                  </button>
                )}

                {canResolve && (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    disabled={transitionMutation.isPending}
                    className="rx-btn rx-btn-lime"
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    <span>✔ Resolve Exception</span>
                  </button>
                )}

                {canReopen && (
                  <button
                    onClick={() => transitionMutation.mutate({ action: 'REOPEN' })}
                    disabled={transitionMutation.isPending}
                    className="rx-btn rx-btn-danger"
                    style={{ width: '100%' }}
                  >
                    <span>↺ Reopen Exception</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Assignment Management Card */}
          <div className="rx-card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF' }}>
            <h4 style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--rx-text-secondary)' }}>
              Assignment
            </h4>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)' }}>Assigned Operator:</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.2rem', color: ex.assigneeName ? 'var(--rx-text-primary)' : 'var(--rx-text-muted)' }}>
                {ex.assigneeName || 'Unassigned'}
              </div>
            </div>

            {permissions.canMutateExceptions && !isResolved && (
              <div>
                {permissions.canAssignOtherMembers && members ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      className="rx-select"
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">-- Choose Member --</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => selectedAssignee && assignMutation.mutate(selectedAssignee)}
                      disabled={assignMutation.isPending || !selectedAssignee}
                      className="rx-btn rx-btn-dark rx-btn-sm"
                    >
                      {assignMutation.isPending ? 'Assigning...' : 'Update Assignment'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => user?.id && assignMutation.mutate(user.id)}
                      disabled={assignMutation.isPending || ex.assigneeId === user?.id}
                      className="rx-btn rx-btn-secondary rx-btn-sm"
                      style={{ width: '100%' }}
                    >
                      {ex.assigneeId === user?.id ? 'Assigned to You' : 'Assign to Myself'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resolved Audit Record Card */}
          {ex.resolvedAt && (
            <div className="rx-card" style={{ padding: '1.5rem', backgroundColor: 'var(--rx-success-bg)', border: '1px solid var(--rx-success-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--rx-success)', fontWeight: 800, marginBottom: '0.75rem' }}>
                <CheckCircleIcon size={18} /> Resolution Certificate
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>
                  <span style={{ color: '#166534' }}>Action: </span>
                  <strong>{ex.resolutionAction}</strong>
                </div>
                <div>
                  <span style={{ color: '#166534' }}>Resolved At: </span>
                  <span>{formatDateTime(ex.resolvedAt)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--rx-success-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <div style={{ color: '#166534', fontWeight: 600 }}>Reason:</div>
                  <div style={{ color: '#14532D', marginTop: '0.15rem' }}>{ex.resolutionReason}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Exception Modal Dialog */}
      {showResolveModal && (
        <div className="rx-modal-overlay">
          <div className="rx-modal-card rx-animate-fade-in" style={{ border: '2px solid var(--rx-success)' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--rx-success)', fontSize: '1.25rem', fontWeight: 800 }}>
              Resolve Exception
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--rx-text-secondary)', marginBottom: '1.25rem' }}>
              Specify the formal resolution reason (min 5 characters) and choose the appropriate resolution action classification.
            </p>

            <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="res-action" className="rx-label">
                  Resolution Action Classification *
                </label>
                <select
                  id="res-action"
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value as ResolutionAction)}
                  className="rx-select"
                >
                  <option value="MANUALLY_RECONCILED">MANUALLY_RECONCILED</option>
                  <option value="CONFIRMED_DUPLICATE">CONFIRMED_DUPLICATE</option>
                  <option value="TRANSACTION_NOT_FOUND">TRANSACTION_NOT_FOUND</option>
                  <option value="DATA_CORRECTION">DATA_CORRECTION</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label htmlFor="res-reason" className="rx-label">
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
                  className="rx-textarea"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowResolveModal(false)} className="rx-btn rx-btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={transitionMutation.isPending} className="rx-btn rx-btn-lime">
                  {transitionMutation.isPending ? 'Resolving...' : 'Confirm & Mark Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* SCREENSHOT PREVIEW MODAL */}
      {previewModalFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1.5rem',
          }}
          onClick={() => setPreviewModalFile(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: '#1E293B',
              borderRadius: 'var(--rx-radius-lg)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', color: '#F8FAFC' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{previewModalFile.filename}</span>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                style={{ background: 'none', border: 'none', color: '#F8FAFC', cursor: 'pointer' }}
              >
                <XIcon size={20} />
              </button>
            </div>
            <img
              src={previewModalFile.url}
              alt="Screenshot Preview"
              style={{
                maxWidth: '85vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 'var(--rx-radius-md)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, InviteMemberDto } from '../../api/endpoints/organizations';
import { useAuth } from '../../auth/auth-provider';
import { useOrg } from '../../org/org-provider';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { formatDate } from '../../shared/lib/date';
import { ApiError } from '../../api/errors';
import { UserRole, Invitation } from '../../api/types';
import {
  BuildingIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserIcon,
  LockIcon,
  SlidersIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  IconProps,
} from '../../shared/components/icons';

type SettingsTab = 'general' | 'members' | 'roles' | 'profile' | 'security' | 'preferences';

export const SettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const { currentMembership } = useOrg();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Rename org state
  const [orgName, setOrgName] = useState('');
  const [renameSuccess, setRenameSuccess] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('ANALYST');
  const [createdInvite, setCreatedInvite] = useState<Invitation | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch organization members (ADMIN only)
  const { data: members, isLoading, error, refetch } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => organizationsApi.listMembers(orgId!),
    enabled: !!orgId,
  });

  // Rename Org Mutation
  const renameMutation = useMutation({
    mutationFn: (name: string) => organizationsApi.updateOrg(orgId!, name),
    onSuccess: () => {
      setRenameSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to rename organization.');
    },
  });

  // Invite Member Mutation
  const inviteMutation = useMutation({
    mutationFn: (dto: InviteMemberDto) => organizationsApi.inviteMember(orgId!, dto),
    onSuccess: (res) => {
      setCreatedInvite(res);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to send invitation.');
    },
  });

  // Change Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      organizationsApi.updateMemberRole(orgId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to update member role.');
    },
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => organizationsApi.removeMember(orgId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(ApiError.isApiError(err) ? err.message : 'Failed to remove member.');
    },
  });

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRenameSuccess(false);
    setActionError(null);
    if (orgName.trim().length < 2) {
      setActionError('Organization name must be at least 2 characters.');
      return;
    }
    renameMutation.mutate(orgName.trim());
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedInvite(null);
    setActionError(null);
    if (!inviteEmail.trim()) {
      setActionError('Email address is required.');
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  if (!orgId) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.FC<IconProps> }[] = [
    { id: 'general', label: 'General', icon: BuildingIcon },
    { id: 'members', label: 'Members & Invitations', icon: UsersIcon },
    { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheckIcon },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'security', label: 'Security & Auth', icon: LockIcon },
    { id: 'preferences', label: 'Preferences', icon: SlidersIcon },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Title */}
      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Organization Settings
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--rx-text-secondary)', fontSize: '0.9rem' }}>
          Manage organization profile, team members, roles, and invitation access (ADMIN only).
        </p>
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

      {/* Structured SaaS Settings Layout (Reference 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.75rem', alignItems: 'start' }}>
        {/* Secondary Settings Navigation (Reference 1 minimal list) */}
        <aside
          className="rx-card"
          style={{
            padding: '0.75rem',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setActionError(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--rx-radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? 'var(--rx-lime)' : 'transparent',
                  color: isActive ? 'var(--rx-dark)' : 'var(--rx-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--rx-transition)',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Selected Settings Section Panel (Reference 1 clean white panel) */}
        <div className="rx-card" style={{ padding: '2rem', backgroundColor: '#FFFFFF', minHeight: '480px' }}>
          {/* TAB 1: General */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Organization Details</h3>
                <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  Update your organization display name and workspace metadata.
                </p>

                {renameSuccess && (
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--rx-success-bg)', color: 'var(--rx-success)', borderRadius: 'var(--rx-radius-md)', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircleIcon size={16} /> Organization name updated successfully!
                  </div>
                )}

                <form onSubmit={handleRenameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px' }}>
                  <div>
                    <label className="rx-label">Organization Name *</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      placeholder={currentMembership?.orgName || 'New organization name...'}
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="rx-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" disabled={renameMutation.isPending} className="rx-btn rx-btn-dark">
                      {renameMutation.isPending ? 'Updating...' : 'Update Name'}
                    </button>
                    <button type="button" onClick={() => setOrgName('')} className="rx-btn rx-btn-secondary">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ borderTop: '1px solid var(--rx-border-subtle)', paddingTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700 }}>Workspace Metadata</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Organization ID</div>
                    <code style={{ fontSize: '0.8125rem' }}>{orgId}</code>
                  </div>
                  <div style={{ padding: '0.85rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Tenant Status</div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--rx-success)', fontWeight: 700 }}>ACTIVE ISOLATION</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Members & Invitations */}
          {activeTab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Invite Team Member</h3>
                <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  Issue an invitation token for a new user to join this organization.
                </p>

                {createdInvite && (
                  <div
                    style={{
                      border: '1px solid var(--rx-success-border)',
                      backgroundColor: 'var(--rx-success-bg)',
                      borderRadius: 'var(--rx-radius-lg)',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--rx-success)', fontWeight: 800, marginBottom: '0.4rem' }}>
                      <CheckCircleIcon size={18} /> Invitation Generated Successfully
                    </div>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#166534' }}>
                      Invited: <strong>{createdInvite.email}</strong> as <strong>{createdInvite.role}</strong>
                    </p>
                    <div style={{ wordBreak: 'break-all', backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: 'var(--rx-radius-sm)', border: '1px solid var(--rx-border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)', fontWeight: 600 }}>Invite Token:</div>
                      <code style={{ fontSize: '0.85rem' }}>{createdInvite.inviteToken}</code>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#14532D' }}>
                      Acceptance Link: <code>/invitations/accept?token={createdInvite.inviteToken}</code>
                    </div>
                  </div>
                )}

                <form onSubmit={handleInviteSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', maxWidth: '640px' }}>
                  <div style={{ flex: 2, minWidth: '220px' }}>
                    <label className="rx-label">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="rx-input"
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label className="rx-label">Role *</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="rx-select"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
                      <option value="ANALYST">ANALYST</option>
                      <option value="AUDITOR">AUDITOR</option>
                    </select>
                  </div>

                  <button type="submit" disabled={inviteMutation.isPending} className="rx-btn rx-btn-dark">
                    {inviteMutation.isPending ? 'Inviting...' : 'Create Invite'}
                  </button>
                </form>
              </div>

              <div style={{ borderTop: '1px solid var(--rx-border-subtle)', paddingTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>Team Directory</h4>

                {isLoading ? (
                  <LoadingState message="Loading organization members..." />
                ) : error ? (
                  <ErrorState error={error} onRetry={() => refetch()} />
                ) : !members || members.length === 0 ? (
                  <p style={{ color: 'var(--rx-text-secondary)' }}>No members found.</p>
                ) : (
                  <div className="rx-table-container">
                    <table className="rx-table">
                      <thead>
                        <tr>
                          <th>Member Name</th>
                          <th>Email Address</th>
                          <th>Role Assignment</th>
                          <th>Joined At</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.userId}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserIcon size={14} style={{ color: 'var(--rx-text-muted)' }} />
                                <strong>{member.name}</strong>
                              </div>
                            </td>
                            <td style={{ color: 'var(--rx-text-secondary)' }}>{member.email}</td>
                            <td>
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  updateRoleMutation.mutate({ userId: member.userId, role: e.target.value as UserRole })
                                }
                                disabled={updateRoleMutation.isPending}
                                className="rx-select"
                                style={{ padding: '0.25rem 1.8rem 0.25rem 0.5rem', fontSize: '0.8rem' }}
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
                                <option value="ANALYST">ANALYST</option>
                                <option value="AUDITOR">AUDITOR</option>
                              </select>
                            </td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)' }}>
                              {formatDate(member.joinedAt)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove ${member.name} from the organization?`)) {
                                    removeMemberMutation.mutate(member.userId);
                                  }
                                }}
                                disabled={removeMemberMutation.isPending}
                                className="rx-btn rx-btn-danger rx-btn-sm"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Roles & Permissions */}
          {activeTab === 'roles' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Roles & Permissions Matrix</h3>
                <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  ReconcileX provides four role tiers for separation of duties and financial compliance.
                </p>
              </div>

              <div className="rx-table-container">
                <table className="rx-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Description</th>
                      <th>Reconciliation</th>
                      <th>Exceptions</th>
                      <th>Org Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong style={{ color: 'var(--rx-text-primary)' }}>ADMIN</strong></td>
                      <td>Full organization administration, team management, and configuration.</td>
                      <td>Full access</td>
                      <td>Full assignment & resolve</td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td><strong style={{ color: 'var(--rx-text-primary)' }}>FINANCE_MANAGER</strong></td>
                      <td>Reconciliation run execution, rule configuration, exception approval.</td>
                      <td>Full access</td>
                      <td>Full assignment & resolve</td>
                      <td>No</td>
                    </tr>
                    <tr>
                      <td><strong style={{ color: 'var(--rx-text-primary)' }}>ANALYST</strong></td>
                      <td>Investigation of potential matches, notes, self-assignment, resolution.</td>
                      <td>Confirm / Reject</td>
                      <td>Investigate & comment</td>
                      <td>No</td>
                    </tr>
                    <tr>
                      <td><strong style={{ color: 'var(--rx-text-primary)' }}>AUDITOR</strong></td>
                      <td>Read-only compliance verification, immutable audit log inspection.</td>
                      <td>Read-only</td>
                      <td>Read-only</td>
                      <td>No</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Profile */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Personal Profile</h3>
                <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  Your personal operator credentials and active workspace session.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="rx-label">Full Name</label>
                  <input type="text" readOnly value={user?.name || ''} className="rx-input" style={{ backgroundColor: 'var(--rx-surface-subtle)' }} />
                </div>
                <div>
                  <label className="rx-label">Email Address</label>
                  <input type="email" readOnly value={user?.email || ''} className="rx-input" style={{ backgroundColor: 'var(--rx-surface-subtle)' }} />
                </div>
                <div>
                  <label className="rx-label">Current Role in Organization</label>
                  <input type="text" readOnly value={currentMembership?.role || 'MEMBER'} className="rx-input" style={{ backgroundColor: 'var(--rx-surface-subtle)', fontWeight: 700 }} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Security & Auth */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Security & Authentication</h3>
                <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  Platform authentication protocols, session encryption, and password recovery.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Cookie-Based JWT Session</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)', marginTop: '0.25rem' }}>
                    Authentication tokens are delivered via HttpOnly, SameSite cookies with automatic expiration.
                  </div>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Password Management</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--rx-text-secondary)', marginTop: '0.25rem' }}>
                    Need to change or recover your password? Use the secure tokenized reset workflow.
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <a href="/forgot-password" className="rx-btn rx-btn-secondary rx-btn-sm">
                      Request Password Reset Token
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Preferences */}
          {activeTab === 'preferences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '520px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Workspace Preferences</h3>
                <p style={{ margin: '0.25rem 0 1.25rem', color: 'var(--rx-text-secondary)', fontSize: '0.875rem' }}>
                  Customize date formatting, numeric display, and live monitoring defaults.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Auto-Refresh Background Jobs</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Poll active jobs every 5 seconds</div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--rx-success)' }}>ENABLED</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--rx-surface-subtle)', borderRadius: 'var(--rx-radius-md)', border: '1px solid var(--rx-border)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Minor Currency Minor Units</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--rx-text-secondary)' }}>Format as standard decimal currency (e.g. 150000 = ₹1,500.00)</div>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--rx-success)' }}>ACTIVE</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

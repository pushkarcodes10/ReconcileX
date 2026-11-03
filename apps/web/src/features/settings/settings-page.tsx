import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, InviteMemberDto } from '../../api/endpoints/organizations';
import { LoadingState, ErrorState } from '../../shared/components/page-state';
import { formatDate } from '../../shared/lib/date';
import { ApiError } from '../../api/errors';
import { UserRole, Invitation } from '../../api/types';

export const SettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();

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
      // Handles last admin protection 400
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

  return (
    <div style={{ maxWidth: '850px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Organization Settings</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Manage organization profile, team members, roles, and invitation access (ADMIN only).
          </p>
        </div>
      </div>

      {actionError && (
        <div role="alert" style={{ color: 'red', border: '1px solid red', padding: '0.75rem', marginBottom: '1rem' }}>
          <strong>Error:</strong> {actionError}
        </div>
      )}

      {/* 1. Rename Organization */}
      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3>Rename Organization</h3>
        {renameSuccess && (
          <div style={{ color: 'green', marginBottom: '0.75rem' }}>Organization name updated successfully!</div>
        )}
        <form onSubmit={handleRenameSubmit} style={{ display: 'flex', gap: '0.75rem', maxWidth: '500px' }}>
          <input
            type="text"
            required
            minLength={2}
            placeholder="New organization name..."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            style={{ flex: 1, padding: '0.4rem' }}
          />
          <button type="submit" disabled={renameMutation.isPending}>
            {renameMutation.isPending ? 'Updating...' : 'Update Name'}
          </button>
        </form>
      </section>

      {/* 2. Invite Team Member */}
      <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3>Invite Team Member</h3>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Backend generates invitation tokens directly in response without sending outbound emails.
        </p>

        {createdInvite && (
          <div style={{ border: '1px solid green', backgroundColor: '#f0fdf4', padding: '1rem', marginBottom: '1rem' }}>
            <h4 style={{ color: 'green', margin: '0 0 0.5rem' }}>Invitation Generated Successfully</h4>
            <p style={{ margin: '0 0 0.5rem' }}>
              Invited: <strong>{createdInvite.email}</strong> as <strong>{createdInvite.role}</strong>
            </p>
            <div style={{ wordBreak: 'break-all', backgroundColor: '#fff', padding: '0.5rem', border: '1px solid #ddd' }}>
              <strong>Invite Token:</strong> <code>{createdInvite.inviteToken}</code>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Acceptance Link: <code>/invitations/accept?token={createdInvite.inviteToken}</code>
            </div>
          </div>
        )}

        <form onSubmit={handleInviteSubmit} style={{ display: 'flex', gap: '0.75rem', maxWidth: '600px', alignItems: 'end' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Email Address</label>
            <input
              type="email"
              required
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ width: '100%', padding: '0.4rem' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              style={{ width: '100%', padding: '0.4rem' }}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
              <option value="ANALYST">ANALYST</option>
              <option value="AUDITOR">AUDITOR</option>
            </select>
          </div>

          <button type="submit" disabled={inviteMutation.isPending} style={{ padding: '0.45rem 1rem' }}>
            {inviteMutation.isPending ? 'Inviting...' : 'Create Invite'}
          </button>
        </form>
      </section>

      {/* 3. Members Directory */}
      <section style={{ border: '1px solid #ccc', padding: '1.5rem' }}>
        <h3>Team Directory</h3>

        {isLoading ? (
          <LoadingState message="Loading organization members..." />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !members || members.length === 0 ? (
          <p>No members found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.6rem' }}>Name</th>
                <th style={{ padding: '0.6rem' }}>Email</th>
                <th style={{ padding: '0.6rem' }}>Role</th>
                <th style={{ padding: '0.6rem' }}>Joined At</th>
                <th style={{ padding: '0.6rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem' }}><strong>{member.name}</strong></td>
                  <td style={{ padding: '0.6rem' }}>{member.email}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({ userId: member.userId, role: e.target.value as UserRole })
                      }
                      disabled={updateRoleMutation.isPending}
                      style={{ padding: '0.25rem' }}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
                      <option value="ANALYST">ANALYST</option>
                      <option value="AUDITOR">AUDITOR</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.6rem', fontSize: '0.85rem' }}>{formatDate(member.joinedAt)}</td>
                  <td style={{ padding: '0.6rem' }}>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove ${member.name} from the organization?`)) {
                          removeMemberMutation.mutate(member.userId);
                        }
                      }}
                      disabled={removeMemberMutation.isPending}
                      style={{ color: 'red' }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

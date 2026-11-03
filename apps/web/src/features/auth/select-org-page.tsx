import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { useOrg } from '../../org/org-provider';

export const SelectOrgPage: React.FC = () => {
  const { memberships, user, logout } = useAuth();
  const { switchOrg } = useOrg();
  const navigate = useNavigate();

  const handleSelect = (orgId: string) => {
    switchOrg(orgId);
    navigate(`/orgs/${orgId}/dashboard`, { replace: true });
  };

  return (
    <div style={{ maxWidth: '500px', margin: '4rem auto', padding: '1rem' }}>
      <h1>Select Organization</h1>
      <p>
        Welcome, <strong>{user?.name || user?.email}</strong>. Choose an organization workspace to continue:
      </p>

      {memberships.length === 0 ? (
        <div style={{ border: '1px solid orange', padding: '1rem', marginTop: '1rem' }}>
          <p>You do not belong to any organizations yet.</p>
          <button onClick={() => logout()}>Sign out</button>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.5rem' }}>
          {memberships.map((m) => (
            <li
              key={m.organizationId}
              style={{
                border: '1px solid #ccc',
                padding: '1rem',
                marginBottom: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong>{m.orgName}</strong>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Role: {m.role} ({m.orgSlug})
                </div>
              </div>
              <button onClick={() => handleSelect(m.organizationId)} style={{ padding: '0.4rem 0.8rem' }}>
                Open Workspace &rarr;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: '2rem' }}>
        <button onClick={() => logout()} style={{ padding: '0.4rem 0.8rem' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Outlet, NavLink, useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { useOrg } from '../../org/org-provider';

export const AppLayout: React.FC = () => {
  const { user, memberships, logout } = useAuth();
  const { currentOrgId, currentMembership, permissions, switchOrg } = useOrg();
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOrgId = e.target.value;
    switchOrg(newOrgId);
    navigate(`/orgs/${newOrgId}/dashboard`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const activeOrgId = orgId || currentOrgId || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top Application Header */}
      <header
        style={{
          borderBottom: '1px solid #ddd',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <strong>ReconcileX</strong>

          {/* Organization Switcher */}
          {memberships.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Organization:</span>
              <select value={activeOrgId} onChange={handleOrgChange} aria-label="Select Organization">
                {memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>
                    {m.orgName} ({m.role})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* User Account & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <span>{user?.name || user?.email}</span>{' '}
            <span style={{ fontSize: '0.85rem', color: '#666' }}>({currentMembership?.role || 'Member'})</span>
          </div>
          <button onClick={handleLogout} style={{ padding: '0.3rem 0.6rem' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Navigation Sidebar */}
        <aside
          style={{
            width: '240px',
            borderRight: '1px solid #ddd',
            padding: '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <nav aria-label="Main Navigation">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/dashboard`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Dashboard
                </NavLink>
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/data-sources`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Data Sources
                </NavLink>
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/imports`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Imports & CSVs
                </NavLink>
                {permissions.canUploadCsv && (
                  <div style={{ paddingLeft: '1rem', fontSize: '0.9rem' }}>
                    <Link to={`/orgs/${activeOrgId}/imports/new`}>+ Upload CSV</Link>
                  </div>
                )}
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/transactions`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Transactions Explorer
                </NavLink>
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/reconciliation`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Reconciliation
                </NavLink>
                {permissions.canRunReconciliation && (
                  <div style={{ paddingLeft: '1rem', fontSize: '0.9rem' }}>
                    <Link to={`/orgs/${activeOrgId}/reconciliation/new`}>+ Start Run</Link>
                  </div>
                )}
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/exceptions`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Exceptions Management
                </NavLink>
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/audit`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Audit Logs
                </NavLink>
              </li>

              <li>
                <NavLink
                  to={`/orgs/${activeOrgId}/jobs`}
                  style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                >
                  Background Jobs
                </NavLink>
              </li>

              {/* ADMIN only settings */}
              {permissions.canManageOrg && (
                <li style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
                  <NavLink
                    to={`/orgs/${activeOrgId}/settings`}
                    style={({ isActive }) => ({ fontWeight: isActive ? 'bold' : 'normal', display: 'block', padding: '0.3rem 0' })}
                  >
                    Organization Settings
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
        </aside>

        {/* Workspace Content Area */}
        <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

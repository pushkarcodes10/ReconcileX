import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { useOrg } from '../../org/org-provider';
import { LogoIcon, BuildingIcon, ArrowRightIcon, LogoutIcon } from '../../shared/components/icons';

export const SelectOrgPage: React.FC = () => {
  const { memberships, user, logout } = useAuth();
  const { switchOrg } = useOrg();
  const navigate = useNavigate();

  const handleSelect = (orgId: string) => {
    switchOrg(orgId);
    navigate(`/orgs/${orgId}/dashboard`, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--rx-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '540px', width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <LogoIcon size={44} />
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            Select Organization
          </h1>
          <p style={{ color: 'var(--rx-text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Welcome back, <strong style={{ color: 'var(--rx-text-primary)' }}>{user?.name || user?.email}</strong>. Choose a tenant workspace:
          </p>
        </div>

        {memberships.length === 0 ? (
          <div className="rx-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', border: '1px solid var(--rx-warning-border)', backgroundColor: 'var(--rx-warning-bg)' }}>
            <p style={{ color: 'var(--rx-warning)', fontWeight: 600, marginBottom: '1rem' }}>
              You do not belong to any active organizations yet.
            </p>
            <button onClick={() => logout()} className="rx-btn rx-btn-secondary rx-btn-sm">
              <LogoutIcon size={14} /> Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {memberships.map((m) => (
              <div
                key={m.organizationId}
                className="rx-card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  backgroundColor: '#FFFFFF',
                }}
                onClick={() => handleSelect(m.organizationId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--rx-radius-md)',
                      backgroundColor: 'var(--rx-surface-subtle)',
                      border: '1px solid var(--rx-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--rx-text-primary)',
                      flexShrink: 0,
                    }}
                  >
                    <BuildingIcon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--rx-text-primary)' }}>
                      {m.orgName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--rx-surface-muted)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--rx-radius-sm)',
                          color: 'var(--rx-text-secondary)',
                        }}
                      >
                        {m.role}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--rx-text-muted)', fontFamily: 'var(--rx-font-mono)' }}>
                        {m.orgSlug}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(m.organizationId);
                  }}
                  className="rx-btn rx-btn-dark rx-btn-sm"
                >
                  Open <ArrowRightIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <button
            onClick={() => logout()}
            className="rx-btn rx-btn-ghost rx-btn-sm"
            style={{ color: 'var(--rx-text-secondary)' }}
          >
            <LogoutIcon size={14} /> Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  );
};

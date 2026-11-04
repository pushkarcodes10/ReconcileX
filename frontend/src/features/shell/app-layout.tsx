import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/auth-provider';
import { useOrg } from '../../org/org-provider';
import {
  LogoIcon,
  DashboardIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  ReceiptIcon,
  GitCompareIcon,
  AlertOctagonIcon,
  ShieldCheckIcon,
  CpuIcon,
  SettingsIcon,
  LogoutIcon,
  BuildingIcon,
  PlusIcon,
} from '../../shared/components/icons';

export const AppLayout: React.FC = () => {
  const { user, memberships, logout } = useAuth();
  const { currentOrgId, currentMembership, permissions, switchOrg } = useOrg();
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navItems = [
    {
      to: `/orgs/${activeOrgId}/dashboard`,
      label: 'Dashboard',
      icon: DashboardIcon,
    },
    {
      to: `/orgs/${activeOrgId}/data-sources`,
      label: 'Data Sources',
      icon: DatabaseIcon,
    },
    {
      to: `/orgs/${activeOrgId}/imports`,
      label: 'Imports & CSVs',
      icon: FileSpreadsheetIcon,
      subAction: permissions.canUploadCsv
        ? { to: `/orgs/${activeOrgId}/imports/new`, label: '+ Upload CSV' }
        : null,
    },
    {
      to: `/orgs/${activeOrgId}/transactions`,
      label: 'Transactions Explorer',
      icon: ReceiptIcon,
      subAction: permissions.canUploadCsv
        ? { to: `/orgs/${activeOrgId}/transactions/screenshot`, label: '+ Screenshot Receipt' }
        : null,
    },
    {
      to: `/orgs/${activeOrgId}/reconciliation`,
      label: 'Reconciliation',
      icon: GitCompareIcon,
      subAction: permissions.canRunReconciliation
        ? { to: `/orgs/${activeOrgId}/reconciliation/new`, label: '+ Start Run' }
        : null,
    },
    {
      to: `/orgs/${activeOrgId}/exceptions`,
      label: 'Exceptions',
      icon: AlertOctagonIcon,
    },
    {
      to: `/orgs/${activeOrgId}/audit`,
      label: 'Audit Logs',
      icon: ShieldCheckIcon,
    },
    {
      to: `/orgs/${activeOrgId}/jobs`,
      label: 'Background Jobs',
      icon: CpuIcon,
    },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--rx-bg)' }}>
      {/* Sidebar Navigation - Reference 1 Minimal Fintech vertical sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid var(--rx-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
          flexShrink: 0,
        }}
        className={`rx-sidebar ${mobileMenuOpen ? 'open' : ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          {/* Logo Brand Header */}
          <div
            style={{
              padding: '1.5rem 1.5rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              borderBottom: '1px solid var(--rx-border-subtle)',
            }}
          >
            <LogoIcon size={32} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Reconcile<span style={{ color: '#171717' }}>X</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--rx-text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                FINANCIAL INTELLIGENCE
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav aria-label="Main Navigation" style={{ padding: '1rem 0.75rem' }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--rx-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.25rem 0.75rem 0.5rem',
              }}
            >
              Platform
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <li key={item.to} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <NavLink
                      to={item.to}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: item.subAction ? '0.6rem 2.25rem 0.6rem 0.85rem' : '0.6rem 0.85rem',
                        borderRadius: 'var(--rx-radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'var(--rx-lime)' : 'transparent',
                        color: isActive ? 'var(--rx-dark)' : 'var(--rx-text-secondary)',
                        transition: 'var(--rx-transition)',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Icon size={18} style={{ color: isActive ? 'var(--rx-dark)' : 'var(--rx-text-secondary)' }} />
                        <span>{item.label}</span>
                      </div>
                    </NavLink>
                    {item.subAction && (
                      <Link
                        to={item.subAction.to}
                        title={item.subAction.label}
                        style={{
                          position: 'absolute',
                          right: '0.6rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: 'var(--rx-radius-sm)',
                          backgroundColor: isActive ? 'rgba(0,0,0,0.1)' : 'var(--rx-surface-subtle)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: isActive ? 'var(--rx-dark)' : 'var(--rx-text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none',
                          zIndex: 2,
                        }}
                      >
                        <PlusIcon size={12} />
                      </Link>
                    )}
                  </li>
                );
              })}

              {/* ADMIN Settings Link */}
              {permissions.canManageOrg && (
                <>
                  <li style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--rx-border-subtle)' }}>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--rx-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '0.25rem 0.75rem 0.5rem',
                      }}
                    >
                      Administration
                    </div>
                  </li>
                  <li>
                    <NavLink
                      to={`/orgs/${activeOrgId}/settings`}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.85rem',
                        borderRadius: 'var(--rx-radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'var(--rx-lime)' : 'transparent',
                        color: isActive ? 'var(--rx-dark)' : 'var(--rx-text-secondary)',
                        transition: 'var(--rx-transition)',
                      })}
                    >
                      <SettingsIcon size={18} />
                      <span>Organization Settings</span>
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>

        {/* Sidebar Footer - Status Card & Version (Ref 1 Style) */}
        <div style={{ padding: '0.75rem 1rem 1.25rem', borderTop: '1px solid var(--rx-border-subtle)' }}>
          <div
            style={{
              backgroundColor: 'var(--rx-dark)',
              borderRadius: 'var(--rx-radius-lg)',
              padding: '1rem',
              color: '#FFFFFF',
              boxShadow: 'var(--rx-shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--rx-lime)' }} />
                <span>Matching Engine</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--rx-text-inverse-muted)' }}>v1.0</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#B3B8AF', lineHeight: 1.4 }}>
              Two-source pairwise matching with exact & potential confidence scoring.
            </p>
            {permissions.canRunReconciliation && (
              <Link
                to={`/orgs/${activeOrgId}/reconciliation/new`}
                className="rx-btn rx-btn-lime rx-btn-sm"
                style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.4rem' }}
              >
                + New Run
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Workspace Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '68px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid var(--rx-border)',
            padding: '0 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Left: Organization Switcher & Mobile Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rx-btn rx-btn-ghost rx-btn-sm"
              style={{ display: 'none' }}
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--rx-surface-subtle)',
                border: '1px solid var(--rx-border)',
                borderRadius: 'var(--rx-radius-full)',
                padding: '0.3rem 0.85rem',
              }}
            >
              <BuildingIcon size={15} style={{ color: 'var(--rx-text-secondary)' }} />
              {memberships.length > 0 ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--rx-text-secondary)', fontWeight: 500 }}>
                    Org:
                  </span>
                  <select
                    value={activeOrgId}
                    onChange={handleOrgChange}
                    aria-label="Select Organization"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      color: 'var(--rx-text-primary)',
                      cursor: 'pointer',
                      outline: 'none',
                      padding: 0,
                    }}
                  >
                    {memberships.map((m) => (
                      <option key={m.organizationId} value={m.organizationId}>
                        {m.orgName} ({m.role})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Default Workspace</span>
              )}
            </div>
          </div>

          {/* Right: User Profile & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: 'var(--rx-surface-subtle)',
                borderRadius: 'var(--rx-radius-full)',
                border: '1px solid var(--rx-border)',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--rx-dark)',
                  color: 'var(--rx-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{user?.name || user?.email}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--rx-text-secondary)' }}>
                  {currentMembership?.role || 'Member'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rx-btn rx-btn-secondary rx-btn-sm"
              title="Sign Out"
              style={{ padding: '0.45rem 0.85rem' }}
            >
              <LogoutIcon size={14} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main style={{ flex: 1, padding: '2rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

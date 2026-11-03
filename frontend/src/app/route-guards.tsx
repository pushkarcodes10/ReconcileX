import React, { useEffect } from 'react';
import { Navigate, Outlet, useParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-provider';
import { useOrg } from '../org/org-provider';
import { RolePermissions } from '../auth/permissions';

export const RequireAuth: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export const RequireOrg: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { memberships, isLoading } = useAuth();
  const { setOrgFromUrl } = useOrg();

  useEffect(() => {
    if (orgId) {
      setOrgFromUrl(orgId);
    }
  }, [orgId, setOrgFromUrl]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Verifying organization...</p>
      </div>
    );
  }

  if (!orgId) {
    return <Navigate to="/select-org" replace />;
  }

  const hasAccess = memberships.some((m) => m.organizationId === orgId);

  if (!hasAccess) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>404 — Organization Not Found</h2>
        <p>The requested organization does not exist or you do not have permission to access it.</p>
        <Link to="/select-org">Return to organization selector</Link>
      </div>
    );
  }

  return <Outlet />;
};

export interface RequirePermissionProps {
  permission: keyof RolePermissions;
  children?: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({ permission, children }) => {
  const { permissions } = useOrg();

  if (!permissions[permission]) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>403 — Access Denied</h2>
        <p>Your current role does not have permission to access this resource or feature.</p>
        <Link to="..">Go back</Link>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
};

export const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentOrgId } = useOrg();

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    if (currentOrgId) {
      return <Navigate to={`/orgs/${currentOrgId}/dashboard`} replace />;
    }
    return <Navigate to="/select-org" replace />;
  }

  return <>{children}</>;
};

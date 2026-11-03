import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Membership, UserRole } from '../api/types';
import { useAuth } from '../auth/auth-provider';
import { getRolePermissions, RolePermissions } from '../auth/permissions';

const STORAGE_KEY = 'reconcilex_selected_org_id';

export interface OrgContextType {
  currentOrgId: string | null;
  currentMembership: Membership | null;
  currentRole: UserRole | null;
  permissions: RolePermissions;
  switchOrg: (orgId: string) => void;
  setOrgFromUrl: (orgId: string) => void;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { memberships } = useAuth();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_KEY);
  });

  // Sync with available memberships
  useEffect(() => {
    if (memberships.length > 0) {
      if (!currentOrgId || !memberships.some((m) => m.organizationId === currentOrgId)) {
        // Default to first membership if current is unset or invalid
        const firstOrgId = memberships[0].organizationId;
        setCurrentOrgId(firstOrgId);
        sessionStorage.setItem(STORAGE_KEY, firstOrgId);
      }
    } else {
      setCurrentOrgId(null);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [memberships, currentOrgId]);

  const currentMembership = useMemo(() => {
    if (!currentOrgId) return null;
    return memberships.find((m) => m.organizationId === currentOrgId) || null;
  }, [memberships, currentOrgId]);

  const currentRole = currentMembership?.role ?? null;
  const permissions = useMemo(() => getRolePermissions(currentRole), [currentRole]);

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    sessionStorage.setItem(STORAGE_KEY, orgId);
  }, []);

  const setOrgFromUrl = useCallback(
    (orgId: string) => {
      if (orgId !== currentOrgId) {
        setCurrentOrgId(orgId);
        sessionStorage.setItem(STORAGE_KEY, orgId);
      }
    },
    [currentOrgId]
  );

  return (
    <OrgContext.Provider
      value={{
        currentOrgId,
        currentMembership,
        currentRole,
        permissions,
        switchOrg,
        setOrgFromUrl,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export function useOrg(): OrgContextType {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}

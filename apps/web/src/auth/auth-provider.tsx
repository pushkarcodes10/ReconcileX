import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Membership } from '../api/types';
import { authApi, LoginDto, RegisterDto } from '../api/endpoints/auth';
import { apiClient } from '../api/client';

export interface AuthContextType {
  user: User | null;
  memberships: Membership[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (dto: LoginDto) => Promise<Membership[]>;
  register: (dto: RegisterDto) => Promise<{ orgId: string }>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchSession = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setMemberships(data.memberships || []);
    } catch {
      setUser(null);
      setMemberships([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    // Listen to session expiry events from the API client
    const unsubscribe = apiClient.onAuthFailure(() => {
      setUser(null);
      setMemberships([]);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchSession]);

  const login = async (dto: LoginDto): Promise<Membership[]> => {
    setIsLoading(true);
    try {
      const res = await authApi.login(dto);
      setUser(res.user);
      const userMemberships = res.memberships || [];
      setMemberships(userMemberships);
      return userMemberships;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (dto: RegisterDto): Promise<{ orgId: string }> => {
    setIsLoading(true);
    try {
      const res = await authApi.register(dto);
      setUser(res.user);
      // Immediately bootstrap /auth/me so membership state is consistent
      try {
        const me = await authApi.me();
        setMemberships(me.memberships || []);
      } catch {
        // Fallback membership record if me call is slow
        setMemberships([
          {
            membershipId: 'temp',
            organizationId: res.organization.id,
            orgName: res.organization.name,
            orgSlug: res.organization.slug,
            role: 'ADMIN',
          },
        ]);
      }
      return { orgId: res.organization.id };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Even if network error occurs, clear client auth state
    } finally {
      setUser(null);
      setMemberships([]);
      sessionStorage.removeItem('reconcilex_selected_org_id');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refetchUser: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

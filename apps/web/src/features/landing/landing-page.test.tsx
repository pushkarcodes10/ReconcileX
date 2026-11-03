import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from './landing-page';
import * as authContext from '../../auth/auth-provider';

describe('LandingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders landing page with navigation bar, logo, and sign-in button', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      memberships: [],
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    // Verify Brand Logo & Name
    expect(screen.getByLabelText(/ReconcileX Home/i)).toBeInTheDocument();

    // Verify Navigation Links
    expect(screen.getByRole('link', { name: /^Platform$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Engine$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^How It Works$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Impact$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Security$/i })).toBeInTheDocument();

    // Verify prominent Sign In / Login button
    const signInLinks = screen.getAllByRole('link', { name: /Sign In/i });
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(signInLinks[0]).toHaveAttribute('href', '/login');
  });

  it('renders hero section with headline, description, and primary CTAs', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      memberships: [],
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(
      screen.getByText(/Reconcile millions in seconds with autonomous precision/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Multi-source ingestion\. 99\.8% automated rule matching/i)
    ).toBeInTheDocument();

    const getStartedCtas = screen.getAllByRole('link', { name: /Get started for free/i });
    expect(getStartedCtas.length).toBeGreaterThan(0);
    expect(getStartedCtas[0]).toHaveAttribute('href', '/register');
  });

  it('renders bento metrics and social proof values', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      memberships: [],
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByText('10x')).toBeInTheDocument();
    expect(screen.getByText('99.8%')).toBeInTheDocument();
    expect(screen.getByText('$42,850,000,000')).toBeInTheDocument();
  });

  it('switches feature tabs and interacts with the match inspector', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      memberships: [],
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    const exceptionTab = screen.getByText(/Finite-State Exception Queue/i);
    fireEvent.click(exceptionTab);

    expect(screen.getByText(/Zero Discrepancy Leakage/i)).toBeInTheDocument();
    expect(screen.getByText('72% Confidence')).toBeInTheDocument();

    // Test confirming a match
    const confirmBtn = screen.getByRole('button', { name: /Confirm Potential Match/i });
    fireEvent.click(confirmBtn);

    expect(screen.getByText('MATCH CERTIFIED')).toBeInTheDocument();
    expect(screen.getByText('Verified in Audit Log')).toBeInTheDocument();
  });

  it('displays workspace navigation button when user is authenticated', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr_1',
        email: 'alex@reconcilex.com',
        name: 'Alex Vance',
        status: 'ACTIVE',
      },
      memberships: [
        {
          membershipId: 'mem_1',
          organizationId: 'org_1',
          orgName: 'Apex Fintech',
          orgSlug: 'apex',
          role: 'ADMIN',
        },
      ],
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refetchUser: vi.fn(),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /Open Workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/Go to Workspace/i)).toBeInTheDocument();
  });
});


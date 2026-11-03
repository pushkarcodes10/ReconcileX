import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './dashboard-page';
import { dashboardApi } from '../../api/endpoints/dashboard';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ orgId: 'test-org-123' }),
  };
});

describe('DashboardPage', () => {
  it('renders dashboard metrics when API returns successful data', async () => {
    vi.spyOn(dashboardApi, 'getSummary').mockResolvedValue({
      totalTransactions: 1500,
      totalReconciliationRuns: 12,
      completedRuns: 10,
      failedRuns: 1,
      runningRuns: 1,
      totalMatchedTransactions: 1200,
      totalUnmatchedTransactions: 250,
      totalPotentialMatches: 50,
      totalOpenExceptions: 30,
      totalAssignedExceptions: 15,
      totalExceptionsUnderReview: 5,
      totalEscalatedExceptions: 3,
      totalResolvedExceptions: 7,
    });

    vi.spyOn(dashboardApi, 'getReconciliation').mockResolvedValue({
      totalRuns: 12,
      completedRuns: 10,
      failedRuns: 1,
      runningRuns: 1,
      matchCounts: { exact: 1000, potential: 50, confirmed: 20, rejected: 10 },
      recentRuns: [],
    });

    vi.spyOn(dashboardApi, 'getExceptions').mockResolvedValue({
      byStatus: { OPEN: 15, ASSIGNED: 15 },
      unassignedCount: 15,
      byAssignee: [],
      recentCreated: [],
      recentResolved: [],
    });

    vi.spyOn(dashboardApi, 'getActivity').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasMore: false,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('1500')).toBeInTheDocument();
    expect(screen.getByText('Organization Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Total Transactions/i)).toBeInTheDocument();
  });

  it('isolates query errors so one failing section does not break the whole page', async () => {
    vi.spyOn(dashboardApi, 'getSummary').mockRejectedValue(new Error('Summary API down'));
    vi.spyOn(dashboardApi, 'getReconciliation').mockResolvedValue({
      totalRuns: 4,
      completedRuns: 4,
      failedRuns: 0,
      runningRuns: 0,
      matchCounts: { exact: 50, potential: 0, confirmed: 0, rejected: 0 },
      recentRuns: [],
    });
    vi.spyOn(dashboardApi, 'getExceptions').mockResolvedValue({
      byStatus: {},
      unassignedCount: 0,
      byAssignee: [],
      recentCreated: [],
      recentResolved: [],
    });
    vi.spyOn(dashboardApi, 'getActivity').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasMore: false,
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Summary section should show error state
    expect(await screen.findByRole('alert')).toHaveTextContent(/Summary API down/i);
    // Reconciliation section should still render its content
    expect(screen.getByText(/Reconciliation Overview/i)).toBeInTheDocument();
  });
});

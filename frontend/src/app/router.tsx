import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequireOrg, RequirePermission, PublicOnly } from './route-guards';
import { AppLayout } from '../features/shell/app-layout';

// Auth Pages
import { LoginPage } from '../features/auth/login-page';
import { RegisterPage } from '../features/auth/register-page';
import { ForgotPasswordPage } from '../features/auth/forgot-password-page';
import { ResetPasswordPage } from '../features/auth/reset-password-page';
import { AcceptInvitePage } from '../features/auth/accept-invite-page';
import { SelectOrgPage } from '../features/auth/select-org-page';

// Placeholder or feature pages
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { DataSourcesPage } from '../features/data-sources/data-sources-page';
import { DataSourceDetailPage } from '../features/data-sources/data-source-detail-page';
import { ImportsPage } from '../features/imports/imports-page';
import { NewImportPage } from '../features/imports/new-import-page';
import { ImportDetailPage } from '../features/imports/import-detail-page';
import { TransactionsPage } from '../features/transactions/transactions-page';
import { TransactionDetailPage } from '../features/transactions/transaction-detail-page';
import { ReconciliationPage } from '../features/reconciliation/reconciliation-page';
import { NewReconciliationRunPage } from '../features/reconciliation/new-reconciliation-run-page';
import { ReconciliationDetailPage } from '../features/reconciliation/reconciliation-detail-page';
import { ExceptionsPage } from '../features/exceptions/exceptions-page';
import { ExceptionDetailPage } from '../features/exceptions/exception-detail-page';
import { AuditLogsPage } from '../features/audit/audit-logs-page';
import { AuditLogDetailPage } from '../features/audit/audit-log-detail-page';
import { JobsPage } from '../features/jobs/jobs-page';
import { JobDetailPage } from '../features/jobs/job-detail-page';
import { SettingsPage } from '../features/settings/settings-page';
import { LandingPage } from '../features/landing/landing-page';

export const router = createBrowserRouter([
  // Public Landing Page (Application Entry Point)
  {
    path: '/',
    element: <LandingPage />,
  },

  // Public Authentication Routes
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <RegisterPage />
      </PublicOnly>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicOnly>
        <ForgotPasswordPage />
      </PublicOnly>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <PublicOnly>
        <ResetPasswordPage />
      </PublicOnly>
    ),
  },
  {
    path: '/invitations/accept',
    element: <AcceptInvitePage />,
  },

  // Authenticated Organization Selector
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/select-org',
        element: <SelectOrgPage />,
      },
      // Tenant Org-Scoped Routes
      {
        path: '/orgs/:orgId',
        element: <RequireOrg />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="dashboard" replace />,
              },
              {
                path: 'dashboard',
                element: <DashboardPage />,
              },
              {
                path: 'data-sources',
                element: <DataSourcesPage />,
              },
              {
                path: 'data-sources/:id',
                element: <DataSourceDetailPage />,
              },
              {
                path: 'imports',
                element: <ImportsPage />,
              },
              {
                path: 'imports/new',
                element: (
                  <RequirePermission permission="canUploadCsv">
                    <NewImportPage />
                  </RequirePermission>
                ),
              },
              {
                path: 'imports/:id',
                element: <ImportDetailPage />,
              },
              {
                path: 'transactions',
                element: <TransactionsPage />,
              },
              {
                path: 'transactions/:id',
                element: <TransactionDetailPage />,
              },
              {
                path: 'reconciliation',
                element: <ReconciliationPage />,
              },
              {
                path: 'reconciliation/new',
                element: (
                  <RequirePermission permission="canRunReconciliation">
                    <NewReconciliationRunPage />
                  </RequirePermission>
                ),
              },
              {
                path: 'reconciliation/:runId',
                element: <ReconciliationDetailPage />,
              },
              {
                path: 'exceptions',
                element: <ExceptionsPage />,
              },
              {
                path: 'exceptions/:id',
                element: <ExceptionDetailPage />,
              },
              {
                path: 'audit',
                element: <AuditLogsPage />,
              },
              {
                path: 'audit/:id',
                element: <AuditLogDetailPage />,
              },
              {
                path: 'jobs',
                element: <JobsPage />,
              },
              {
                path: 'jobs/:id',
                element: <JobDetailPage />,
              },
              {
                path: 'settings',
                element: (
                  <RequirePermission permission="canManageOrg">
                    <SettingsPage />
                  </RequirePermission>
                ),
              },
            ],
          },
        ],
      },
    ],
  },

  // Fallback 404 Route
  {
    path: '*',
    element: (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>404 — Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <a href="/select-org">Return Home</a>
      </div>
    ),
  },
]);

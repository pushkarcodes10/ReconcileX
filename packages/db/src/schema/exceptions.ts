import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { reconciliationRuns } from './reconciliation-runs';
import { transactions } from './transactions';
import { users } from './users';

export const ExceptionStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
} as const;

export type ExceptionStatus = (typeof ExceptionStatus)[keyof typeof ExceptionStatus];

export const ResolutionAction = {
  MANUALLY_RECONCILED: 'MANUALLY_RECONCILED',
  CONFIRMED_DUPLICATE: 'CONFIRMED_DUPLICATE',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  DATA_CORRECTION: 'DATA_CORRECTION',
  OTHER: 'OTHER',
} as const;

export type ResolutionAction = (typeof ResolutionAction)[keyof typeof ResolutionAction];

export const exceptions = pgTable(
  'exceptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => reconciliationRuns.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    status: varchar('status', { length: 50 }).default('OPEN').notNull(),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    resolutionReason: text('resolution_reason'),
    resolutionAction: varchar('resolution_action', { length: 100 }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('exceptions_org_status_idx').on(table.organizationId, table.status),
    index('exceptions_org_run_idx').on(table.organizationId, table.runId),
    index('exceptions_org_assignee_idx').on(table.organizationId, table.assigneeId),
    index('exceptions_org_created_idx').on(table.organizationId, table.createdAt),
    index('exceptions_run_txn_idx').on(table.runId, table.transactionId),
    uniqueIndex('exceptions_run_txn_open_idx')
      .on(table.runId, table.transactionId)
      .where(sql`${table.transactionId} IS NOT NULL AND ${table.status} != 'RESOLVED'`),
  ],
);

export type Exception = typeof exceptions.$inferSelect;
export type NewException = typeof exceptions.$inferInsert;

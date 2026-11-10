import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { reconciliationRuns } from './reconciliation-runs';
import { transactions } from './transactions';
import { users } from './users';

export const MatchClassification = {
  EXACT: 'EXACT',
  POTENTIAL: 'POTENTIAL',
  FULLY_MATCHED: 'FULLY_MATCHED',
  PARTIALLY_MATCHED: 'PARTIALLY_MATCHED',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  DATE_MISMATCH: 'DATE_MISMATCH',
  REFERENCE_MISMATCH: 'REFERENCE_MISMATCH',
  POTENTIAL_MATCH: 'POTENTIAL_MATCH',
  UNMATCHED: 'UNMATCHED',
  DUPLICATE_QUARANTINED: 'DUPLICATE_QUARANTINED',
} as const;

export type MatchClassification =
  (typeof MatchClassification)[keyof typeof MatchClassification];

export const MatchStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => reconciliationRuns.id, { onDelete: 'cascade' }),
    reconciliationType: varchar('reconciliation_type', { length: 50 }).default('TWO_SOURCE').notNull(),
    transactionAId: uuid('transaction_a_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    transactionBId: uuid('transaction_b_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    transactionCId: uuid('transaction_c_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    transactionDId: uuid('transaction_d_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    classification: varchar('classification', { length: 50 }).notNull(),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').$type<Record<string, unknown>>().notNull(),
    discrepancyDetails: jsonb('discrepancy_details').$type<Record<string, unknown> | Array<unknown>>(),
    status: varchar('status', { length: 50 }).default('PENDING').notNull(),
    confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('matches_run_txn_a_active_idx')
      .on(table.runId, table.transactionAId)
      .where(sql`status != 'REJECTED' AND transaction_a_id IS NOT NULL`),
    uniqueIndex('matches_run_txn_b_active_idx')
      .on(table.runId, table.transactionBId)
      .where(sql`status != 'REJECTED' AND transaction_b_id IS NOT NULL`),
    uniqueIndex('matches_run_txn_c_active_idx')
      .on(table.runId, table.transactionCId)
      .where(sql`status != 'REJECTED' AND transaction_c_id IS NOT NULL`),
    uniqueIndex('matches_run_txn_d_active_idx')
      .on(table.runId, table.transactionDId)
      .where(sql`status != 'REJECTED' AND transaction_d_id IS NOT NULL`),
    index('matches_org_run_idx').on(table.organizationId, table.runId),
    index('matches_org_status_idx').on(table.organizationId, table.status),
    index('matches_org_classification_idx').on(table.organizationId, table.classification),
    index('matches_org_txn_c_idx').on(table.organizationId, table.transactionCId),
    index('matches_org_txn_d_idx').on(table.organizationId, table.transactionDId),
  ],
);

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

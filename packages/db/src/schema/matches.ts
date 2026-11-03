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
    transactionAId: uuid('transaction_a_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    transactionBId: uuid('transaction_b_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    classification: varchar('classification', { length: 50 }).notNull(),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').$type<Record<string, unknown>>().notNull(),
    status: varchar('status', { length: 50 }).default('PENDING').notNull(),
    confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('matches_run_txna_txnb_idx').on(
      table.runId,
      table.transactionAId,
      table.transactionBId,
    ),
    uniqueIndex('matches_run_txn_a_active_idx')
      .on(table.runId, table.transactionAId)
      .where(sql`status != 'REJECTED'`),
    uniqueIndex('matches_run_txn_b_active_idx')
      .on(table.runId, table.transactionBId)
      .where(sql`status != 'REJECTED'`),
    index('matches_org_run_idx').on(table.organizationId, table.runId),
    index('matches_org_status_idx').on(table.organizationId, table.status),
    index('matches_org_classification_idx').on(table.organizationId, table.classification),
  ],
);

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;

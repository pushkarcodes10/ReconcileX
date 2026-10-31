import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { dataSources } from './data-sources';
import { organizations } from './organizations';
import { transactions } from './transactions';

export const DuplicateCandidateStatus = {
  FLAGGED: 'FLAGGED',
  DISMISSED: 'DISMISSED',
  CONFIRMED_DUPLICATE: 'CONFIRMED_DUPLICATE',
} as const;

export type DuplicateCandidateStatus =
  (typeof DuplicateCandidateStatus)[keyof typeof DuplicateCandidateStatus];

export const duplicateCandidates = pgTable(
  'duplicate_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'cascade' }),
    existingTransactionId: uuid('existing_transaction_id').references(
      () => transactions.id,
      { onDelete: 'cascade' },
    ),
    candidateTransactionId: uuid('candidate_transaction_id').references(
      () => transactions.id,
      { onDelete: 'cascade' },
    ),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).default('FLAGGED').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('duplicate_candidates_org_status_idx').on(
      table.organizationId,
      table.status,
    ),
    index('duplicate_candidates_org_source_idx').on(
      table.organizationId,
      table.dataSourceId,
    ),
  ],
);

export type DuplicateCandidate = typeof duplicateCandidates.$inferSelect;
export type NewDuplicateCandidate = typeof duplicateCandidates.$inferInsert;

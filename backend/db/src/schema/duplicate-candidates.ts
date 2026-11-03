import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { dataSources } from './data-sources';
import { imports } from './imports';
import { organizations } from './organizations';
import { transactions } from './transactions';

export const DuplicateStatus = {
  FLAGGED: 'FLAGGED',
  DISMISSED: 'DISMISSED',
  CONFIRMED_DUPLICATE: 'CONFIRMED_DUPLICATE',
} as const;

export type DuplicateStatus = (typeof DuplicateStatus)[keyof typeof DuplicateStatus];

export const duplicateCandidates = pgTable(
  'duplicate_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    existingTransactionId: uuid('existing_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    candidateFingerprint: varchar('candidate_fingerprint', { length: 64 }),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    rowNumber: integer('row_number'),
    reason: varchar('reason', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('FLAGGED').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('duplicate_candidates_org_import_idx').on(table.organizationId, table.importId),
    index('duplicate_candidates_org_status_idx').on(table.organizationId, table.status),
    index('duplicate_candidates_org_source_idx').on(table.organizationId, table.dataSourceId),
  ],
);

export type DuplicateCandidate = typeof duplicateCandidates.$inferSelect;
export type NewDuplicateCandidate = typeof duplicateCandidates.$inferInsert;

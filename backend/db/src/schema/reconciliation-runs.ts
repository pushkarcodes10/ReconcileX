import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { dataSources } from './data-sources';
import { organizations } from './organizations';
import { users } from './users';

export const ReconciliationRunStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type ReconciliationRunStatus =
  (typeof ReconciliationRunStatus)[keyof typeof ReconciliationRunStatus];

export const ReconciliationType = {
  TWO_SOURCE: 'TWO_SOURCE',
  THREE_SOURCE: 'THREE_SOURCE',
} as const;

export type ReconciliationType =
  (typeof ReconciliationType)[keyof typeof ReconciliationType];

export const reconciliationRuns = pgTable(
  'reconciliation_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    displayId: varchar('display_id', { length: 50 }).notNull(),
    reconciliationType: varchar('reconciliation_type', { length: 50 }).default('TWO_SOURCE').notNull(),
    sourceAId: uuid('source_a_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    sourceBId: uuid('source_b_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    sourceCId: uuid('source_c_id').references(() => dataSources.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 50 }).default('PENDING').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    totalSourceA: integer('total_source_a').default(0).notNull(),
    totalSourceB: integer('total_source_b').default(0).notNull(),
    totalSourceC: integer('total_source_c').default(0).notNull(),
    exactMatchCount: integer('exact_match_count').default(0).notNull(),
    potentialMatchCount: integer('potential_match_count').default(0).notNull(),
    fullyMatchedCount: integer('fully_matched_count').default(0).notNull(),
    partiallyMatchedCount: integer('partially_matched_count').default(0).notNull(),
    discrepancyCount: integer('discrepancy_count').default(0).notNull(),
    unmatchedCount: integer('unmatched_count').default(0).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'reconciliation_runs_org_source_a_fk',
      columns: [table.organizationId, table.sourceAId],
      foreignColumns: [dataSources.organizationId, dataSources.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'reconciliation_runs_org_source_b_fk',
      columns: [table.organizationId, table.sourceBId],
      foreignColumns: [dataSources.organizationId, dataSources.id],
    }).onDelete('restrict'),
    uniqueIndex('reconciliation_runs_org_display_id_idx').on(
      table.organizationId,
      table.displayId,
    ),
    index('reconciliation_runs_org_status_idx').on(table.organizationId, table.status),
    index('reconciliation_runs_org_created_idx').on(table.organizationId, table.createdAt),
    index('reconciliation_runs_org_idempotency_idx').on(table.organizationId, table.idempotencyKey),
  ],
);

export type ReconciliationRun = typeof reconciliationRuns.$inferSelect;
export type NewReconciliationRun = typeof reconciliationRuns.$inferInsert;

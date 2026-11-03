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

export const ImportStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const imports = pgTable(
  'imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    contentSha256: varchar('content_sha256', { length: 64 }).notNull(),
    status: varchar('status', { length: 50 }).default('QUEUED').notNull(),
    rowCount: integer('row_count').default(0).notNull(),
    validCount: integer('valid_count').default(0).notNull(),
    invalidCount: integer('invalid_count').default(0).notNull(),
    duplicateCount: integer('duplicate_count').default(0).notNull(),
    errorSummary: jsonb('error_summary').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: 'imports_org_datasource_fk',
      columns: [table.organizationId, table.dataSourceId],
      foreignColumns: [dataSources.organizationId, dataSources.id],
    }).onDelete('restrict'),
    uniqueIndex('imports_org_source_sha256_idx').on(
      table.organizationId,
      table.dataSourceId,
      table.contentSha256,
    ),
    index('imports_org_source_idx').on(table.organizationId, table.dataSourceId),
    index('imports_org_status_idx').on(table.organizationId, table.status),
    index('imports_org_created_idx').on(table.organizationId, table.createdAt),
  ],
);

export type Import = typeof imports.$inferSelect;
export type NewImport = typeof imports.$inferInsert;

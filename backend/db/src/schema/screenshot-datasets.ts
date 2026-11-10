import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { dataSources } from './data-sources';
import { users } from './users';

export const ScreenshotDatasetStatus = {
  PROCESSING: 'PROCESSING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export type ScreenshotDatasetStatus =
  (typeof ScreenshotDatasetStatus)[keyof typeof ScreenshotDatasetStatus];

export const screenshotDatasets = pgTable(
  'screenshot_datasets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    dataSourceId: uuid('data_source_id').references(() => dataSources.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).default('PROCESSING').notNull(),
    totalFiles: integer('total_files').default(0).notNull(),
    totalRecords: integer('total_records').default(0).notNull(),
    confirmedRecords: integer('confirmed_records').default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    confirmedById: uuid('confirmed_by_id').references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('screenshot_datasets_org_idx').on(table.organizationId),
    index('screenshot_datasets_org_status_idx').on(table.organizationId, table.status),
    index('screenshot_datasets_datasource_idx').on(table.dataSourceId),
  ],
);

export type ScreenshotDataset = typeof screenshotDatasets.$inferSelect;
export type NewScreenshotDataset = typeof screenshotDatasets.$inferInsert;

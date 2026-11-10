import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { screenshotDatasets } from './screenshot-datasets';

export const ScreenshotFileStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  EXTRACTED: 'EXTRACTED',
  FAILED: 'FAILED',
} as const;

export type ScreenshotFileStatus =
  (typeof ScreenshotFileStatus)[keyof typeof ScreenshotFileStatus];

export const screenshotFiles = pgTable(
  'screenshot_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => screenshotDatasets.id, { onDelete: 'cascade' }),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSize: integer('file_size').notNull(),
    contentSha256: varchar('content_sha256', { length: 64 }).notNull(),
    status: varchar('status', { length: 50 }).default('UPLOADED').notNull(),
    rawOcrText: text('raw_ocr_text'),
    extractedCount: integer('extracted_count').default(0).notNull(),
    extractionMetadata: jsonb('extraction_metadata').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('screenshot_files_org_idx').on(table.organizationId),
    index('screenshot_files_dataset_idx').on(table.datasetId),
    index('screenshot_files_sha256_idx').on(table.organizationId, table.contentSha256),
  ],
);

export type ScreenshotFile = typeof screenshotFiles.$inferSelect;
export type NewScreenshotFile = typeof screenshotFiles.$inferInsert;

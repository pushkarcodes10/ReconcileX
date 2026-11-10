import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { screenshotDatasets } from './screenshot-datasets';
import { screenshotFiles } from './screenshot-files';
import { transactions } from './transactions';

export const screenshotExtractedRecords = pgTable(
  'screenshot_extracted_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => screenshotDatasets.id, { onDelete: 'cascade' }),
    screenshotFileId: uuid('screenshot_file_id')
      .notNull()
      .references(() => screenshotFiles.id, { onDelete: 'cascade' }),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    amount: doublePrecision('amount').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
    reference: varchar('reference', { length: 255 }),
    externalTxnId: varchar('external_txn_id', { length: 255 }),
    merchantOrOrderId: varchar('merchant_or_order_id', { length: 255 }),
    txnType: varchar('txn_type', { length: 50 }).default('PAYMENT'),
    paymentMethod: varchar('payment_method', { length: 50 }),
    senderReceiver: varchar('sender_receiver', { length: 255 }),
    description: text('description'),
    confidenceScore: integer('confidence_score').default(80).notNull(),
    fieldConfidences: jsonb('field_confidences').$type<Record<string, number>>(),
    isDuplicate: boolean('is_duplicate').default(false).notNull(),
    isLowConfidence: boolean('is_low_confidence').default(false).notNull(),
    validationErrors: jsonb('validation_errors').$type<string[]>(),
    userCorrected: boolean('user_corrected').default(false).notNull(),
    userCorrectionHistory: jsonb('user_correction_history').$type<Array<Record<string, unknown>>>(),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('screenshot_extracted_records_org_idx').on(table.organizationId),
    index('screenshot_extracted_records_dataset_idx').on(table.datasetId),
    index('screenshot_extracted_records_file_idx').on(table.screenshotFileId),
    index('screenshot_extracted_records_txn_idx').on(table.transactionId),
  ],
);

export type ScreenshotExtractedRecord = typeof screenshotExtractedRecords.$inferSelect;
export type NewScreenshotExtractedRecord = typeof screenshotExtractedRecords.$inferInsert;

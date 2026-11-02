import {
  bigint,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { dataSources } from './data-sources';
import { imports } from './imports';
import { organizations } from './organizations';

export const TransactionStatus = {
  IMPORTED: 'IMPORTED',
  VALIDATED: 'VALIDATED',
  UNMATCHED: 'UNMATCHED',
  MATCHED: 'MATCHED',
  POTENTIAL_MATCH: 'POTENTIAL_MATCH',
  EXCEPTION: 'EXCEPTION',
  RESOLVED: 'RESOLVED',
} as const;

export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    dataSourceId: uuid('data_source_id')
      .notNull()
      .references(() => dataSources.id, { onDelete: 'restrict' }),
    importId: uuid('import_id').references(() => imports.id, { onDelete: 'set null' }),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    transactionDate: timestamp('transaction_date', {
      withTimezone: true,
    }).notNull(),
    reference: varchar('reference', { length: 255 }),
    externalTxnId: varchar('external_txn_id', { length: 255 }),
    merchantOrOrderId: varchar('merchant_or_order_id', { length: 255 }),
    txnType: varchar('txn_type', { length: 50 }),
    status: varchar('status', { length: 50 }).default('UNMATCHED').notNull(),
    normalizedPayload: jsonb('normalized_payload').$type<Record<string, unknown>>(),
    fingerprint: varchar('fingerprint', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'transactions_org_datasource_fk',
      columns: [table.organizationId, table.dataSourceId],
      foreignColumns: [dataSources.organizationId, dataSources.id],
    }).onDelete('restrict'),
    uniqueIndex('transactions_org_source_ext_id_idx').on(
      table.organizationId,
      table.dataSourceId,
      table.externalId,
    ),
    index('transactions_org_date_idx').on(table.organizationId, table.transactionDate),
    index('transactions_org_status_idx').on(table.organizationId, table.status),
    index('transactions_org_reference_idx').on(table.organizationId, table.reference),
    index('transactions_org_source_idx').on(table.organizationId, table.dataSourceId),
    index('transactions_org_import_idx').on(table.organizationId, table.importId),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

import { isNull } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const DataSourceType = {
  INTERNAL_ORDERS: 'INTERNAL_ORDERS',
  PAYMENT_GATEWAY: 'PAYMENT_GATEWAY',
  BANK: 'BANK',
  OTHER: 'OTHER',
} as const;

export type DataSourceType = (typeof DataSourceType)[keyof typeof DataSourceType];

export const DataSourceStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type DataSourceStatus = (typeof DataSourceStatus)[keyof typeof DataSourceStatus];

export interface ColumnMapping {
  external_id: string;
  amount: string;
  date: string;
  currency: string;
  reference?: string;
  external_txn_id?: string;
  merchant_or_order_id?: string;
  txn_type?: string;
}

export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    direction: varchar('direction', { length: 50 }).default('INCOMING').notNull(),
    columnMapping: jsonb('column_mapping').$type<ColumnMapping>().notNull(),
    status: varchar('status', { length: 50 }).default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('data_sources_org_id_uniq').on(table.organizationId, table.id),
    uniqueIndex('data_sources_org_name_idx')
      .on(table.organizationId, table.name)
      .where(isNull(table.deletedAt)),
    index('data_sources_org_status_idx').on(table.organizationId, table.status),
    index('data_sources_org_idx').on(table.organizationId),
  ],
);

export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;

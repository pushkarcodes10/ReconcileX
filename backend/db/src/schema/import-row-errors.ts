import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { imports } from './imports';
import { organizations } from './organizations';

export const importRowErrors = pgTable(
  'import_row_errors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    field: varchar('field', { length: 100 }),
    code: varchar('code', { length: 100 }).notNull(),
    rawValue: text('raw_value'),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('import_row_errors_org_import_idx').on(table.organizationId, table.importId),
    index('import_row_errors_import_row_idx').on(table.importId, table.rowNumber),
  ],
);

export type ImportRowError = typeof importRowErrors.$inferSelect;
export type NewImportRowError = typeof importRowErrors.$inferInsert;

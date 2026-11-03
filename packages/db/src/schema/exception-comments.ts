import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { exceptions } from './exceptions';
import { organizations } from './organizations';
import { users } from './users';

export const exceptionComments = pgTable(
  'exception_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    exceptionId: uuid('exception_id')
      .notNull()
      .references(() => exceptions.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('exception_comments_exception_created_idx').on(table.exceptionId, table.createdAt),
    index('exception_comments_org_created_idx').on(table.organizationId, table.createdAt),
  ],
);

export type ExceptionComment = typeof exceptionComments.$inferSelect;
export type NewExceptionComment = typeof exceptionComments.$inferInsert;

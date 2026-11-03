import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('org_membership_user_org_idx').on(table.userId, table.organizationId)],
);

export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;

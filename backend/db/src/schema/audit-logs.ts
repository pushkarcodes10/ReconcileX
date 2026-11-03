import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

export const ActorType = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;

export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const AuditAction = {
  // Auth & Org
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  ORGANIZATION_CREATED: 'ORGANIZATION_CREATED',
  ORGANIZATION_UPDATED: 'ORGANIZATION_UPDATED',
  MEMBER_INVITED: 'MEMBER_INVITED',
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',

  // Data Sources
  DATA_SOURCE_CREATED: 'DATA_SOURCE_CREATED',
  DATA_SOURCE_UPDATED: 'DATA_SOURCE_UPDATED',
  DATA_SOURCE_DELETED: 'DATA_SOURCE_DELETED',

  // Imports
  IMPORT_UPLOADED: 'IMPORT_UPLOADED',
  IMPORT_COMPLETED: 'IMPORT_COMPLETED',
  IMPORT_FAILED: 'IMPORT_FAILED',

  // Transactions
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED: 'TRANSACTION_UPDATED',
  TRANSACTION_DELETED: 'TRANSACTION_DELETED',

  // Reconciliation
  RECONCILIATION_RUN_CREATED: 'RECONCILIATION_RUN_CREATED',
  RECONCILIATION_RUN_COMPLETED: 'RECONCILIATION_RUN_COMPLETED',
  RECONCILIATION_RUN_FAILED: 'RECONCILIATION_RUN_FAILED',
  MATCH_CONFIRMED: 'MATCH_CONFIRMED',
  MATCH_REJECTED: 'MATCH_REJECTED',

  // Exceptions
  EXCEPTION_CREATED: 'EXCEPTION_CREATED',
  EXCEPTION_ASSIGNED: 'EXCEPTION_ASSIGNED',
  EXCEPTION_COMMENT_ADDED: 'EXCEPTION_COMMENT_ADDED',
  EXCEPTION_STATUS_CHANGED: 'EXCEPTION_STATUS_CHANGED',
  EXCEPTION_RESOLVED: 'EXCEPTION_RESOLVED',
  EXCEPTION_REOPENED: 'EXCEPTION_REOPENED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntityType = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  DATA_SOURCE: 'DATA_SOURCE',
  IMPORT: 'IMPORT',
  TRANSACTION: 'TRANSACTION',
  RECONCILIATION_RUN: 'RECONCILIATION_RUN',
  MATCH: 'MATCH',
  EXCEPTION: 'EXCEPTION',
} as const;

export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: varchar('actor_type', { length: 50 }).notNull().default(ActorType.USER),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 100 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_org_created_idx').on(table.organizationId, table.createdAt),
    index('audit_logs_org_action_idx').on(table.organizationId, table.action),
    index('audit_logs_org_entity_idx').on(table.organizationId, table.entityType, table.entityId),
    index('audit_logs_org_actor_idx').on(table.organizationId, table.actorId),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const JobStatus = {
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobType = {
  RECONCILIATION_RUN: 'RECONCILIATION_RUN',
  CSV_IMPORT: 'CSV_IMPORT',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    jobType: varchar('job_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default(JobStatus.QUEUED),
    progress: integer('progress').notNull().default(0),
    message: text('message'),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: varchar('reference_id', { length: 255 }),
    result: jsonb('result'),
    error: jsonb('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('jobs_org_created_idx').on(table.organizationId, table.createdAt),
    index('jobs_org_status_idx').on(table.organizationId, table.status),
    index('jobs_org_type_idx').on(table.organizationId, table.jobType),
    index('jobs_org_ref_idx').on(table.organizationId, table.referenceType, table.referenceId),
  ],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  count,
  DatabaseClient,
  desc,
  eq,
  gte,
  Job,
  jobs,
  lte,
  NewJob,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import { QueryJobsDto } from '../dto/query-jobs.dto';
import { IJobsRepository } from './jobs.repository.interface';

@Injectable()
export class DrizzleJobsRepository implements IJobsRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async create(newJob: NewJob): Promise<Job> {
    const [created] = await this.db.insert(jobs).values(newJob).returning();
    return created;
  }

  async findById(orgId: string, id: string): Promise<Job | null> {
    const [record] = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.organizationId, orgId), eq(jobs.id, id)));

    return record || null;
  }

  async findMany(
    orgId: string,
    query: QueryJobsDto,
  ): Promise<{ data: Job[]; total: number }> {
    const conditions: SQL[] = [eq(jobs.organizationId, orgId)];

    if (query.status) {
      conditions.push(eq(jobs.status, query.status));
    }
    if (query.jobType) {
      conditions.push(eq(jobs.jobType, query.jobType));
    }
    if (query.referenceType) {
      conditions.push(eq(jobs.referenceType, query.referenceType));
    }
    if (query.referenceId) {
      conditions.push(eq(jobs.referenceId, query.referenceId));
    }
    if (query.startDate) {
      conditions.push(gte(jobs.createdAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(jobs.createdAt, new Date(query.endDate)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ value: count() })
      .from(jobs)
      .where(whereClause);

    const total = Number(countResult?.value || 0);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const orderFn = query.sortOrder === 'asc' ? asc : desc;
    const orderCol = query.sortBy === 'updatedAt' ? jobs.updatedAt : jobs.createdAt;

    const records = await this.db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    return { data: records, total };
  }

  async update(orgId: string, id: string, updates: Partial<Job>): Promise<Job> {
    const [updated] = await this.db
      .update(jobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(jobs.organizationId, orgId), eq(jobs.id, id)))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return updated;
  }
}

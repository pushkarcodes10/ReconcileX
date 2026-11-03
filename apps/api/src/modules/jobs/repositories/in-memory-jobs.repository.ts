import { Injectable, NotFoundException } from '@nestjs/common';
import { Job, JobStatus, NewJob } from '@reconcilex/db';
import { randomUUID } from 'crypto';
import { QueryJobsDto } from '../dto/query-jobs.dto';
import { IJobsRepository } from './jobs.repository.interface';

@Injectable()
export class InMemoryJobsRepository implements IJobsRepository {
  public jobs: Job[] = [];

  clear(): void {
    this.jobs = [];
  }

  async create(newJob: NewJob): Promise<Job> {
    const now = new Date();
    const job: Job = {
      id: newJob.id || randomUUID(),
      organizationId: newJob.organizationId,
      jobType: newJob.jobType,
      status: (newJob.status as JobStatus) || JobStatus.QUEUED,
      progress: newJob.progress ?? 0,
      message: newJob.message ?? null,
      referenceType: newJob.referenceType ?? null,
      referenceId: newJob.referenceId ?? null,
      result: (newJob.result as Record<string, unknown>) ?? null,
      error: (newJob.error as Record<string, unknown>) ?? null,
      createdAt: newJob.createdAt instanceof Date ? newJob.createdAt : now,
      startedAt: newJob.startedAt instanceof Date ? newJob.startedAt : null,
      completedAt: newJob.completedAt instanceof Date ? newJob.completedAt : null,
      updatedAt: newJob.updatedAt instanceof Date ? newJob.updatedAt : now,
    };

    this.jobs.push(job);
    return { ...job };
  }

  async findById(orgId: string, id: string): Promise<Job | null> {
    const job = this.jobs.find((j) => j.organizationId === orgId && j.id === id);
    return job ? { ...job } : null;
  }

  async findMany(
    orgId: string,
    query: QueryJobsDto,
  ): Promise<{ data: Job[]; total: number }> {
    let filtered = this.jobs.filter((j) => j.organizationId === orgId);

    if (query.status) {
      filtered = filtered.filter((j) => j.status === query.status);
    }
    if (query.jobType) {
      filtered = filtered.filter((j) => j.jobType === query.jobType);
    }
    if (query.referenceType) {
      filtered = filtered.filter((j) => j.referenceType === query.referenceType);
    }
    if (query.referenceId) {
      filtered = filtered.filter((j) => j.referenceId === query.referenceId);
    }
    if (query.startDate) {
      const fromTime = new Date(query.startDate).getTime();
      filtered = filtered.filter((j) => new Date(j.createdAt).getTime() >= fromTime);
    }
    if (query.endDate) {
      const toTime = new Date(query.endDate).getTime();
      filtered = filtered.filter((j) => new Date(j.createdAt).getTime() <= toTime);
    }

    const total = filtered.length;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    filtered.sort((a, b) => {
      const timeA = new Date(a[sortBy]).getTime();
      const timeB = new Date(b[sortBy]).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    return { data: paged.map((j) => ({ ...j })), total };
  }

  async update(orgId: string, id: string, updates: Partial<Job>): Promise<Job> {
    const job = this.jobs.find((j) => j.organizationId === orgId && j.id === id);
    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    Object.assign(job, updates, { updatedAt: new Date() });
    return { ...job };
  }
}

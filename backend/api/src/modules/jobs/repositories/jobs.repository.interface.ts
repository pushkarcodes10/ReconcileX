import { Job, NewJob } from '@reconcilex/db';
import { QueryJobsDto } from '../dto/query-jobs.dto';

export const JOBS_REPOSITORY = 'JOBS_REPOSITORY';

export interface IJobsRepository {
  create(job: NewJob): Promise<Job>;
  findById(orgId: string, id: string): Promise<Job | null>;
  findMany(
    orgId: string,
    query: QueryJobsDto,
  ): Promise<{ data: Job[]; total: number }>;
  update(orgId: string, id: string, updates: Partial<Job>): Promise<Job>;
}

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Job, JobStatus, JobType } from '@reconcilex/db';
import {
  JobResponseDto,
  PaginatedJobsResponseDto,
  QueryJobsDto,
} from './dto';
import {
  IJobsRepository,
  JOBS_REPOSITORY,
} from './repositories/jobs.repository.interface';

@Injectable()
export class JobsService {
  constructor(
    @Inject(JOBS_REPOSITORY)
    private readonly jobsRepo: IJobsRepository,
  ) {}

  private sanitizeError(error: unknown): Record<string, unknown> {
    if (!error) return { message: 'Unknown error occurred' };
    if (typeof error === 'string') return { message: error };

    const errObj = error as Record<string, unknown>;
    const code = typeof errObj.code === 'string' ? errObj.code : undefined;
    const message =
      typeof errObj.message === 'string'
        ? errObj.message
        : error instanceof Error
          ? error.message
          : 'Operation failed';

    return {
      ...(code ? { code } : {}),
      message,
    };
  }

  async createJob(
    orgId: string,
    paramsOrType:
      | JobType
      | string
      | {
          jobType: JobType | string;
          referenceType?: string | null;
          referenceId?: string | null;
          message?: string | null;
        },
    referenceType?: string | null,
    referenceId?: string | null,
    message?: string | null,
  ): Promise<Job> {
    const params =
      typeof paramsOrType === 'object'
        ? paramsOrType
        : {
            jobType: paramsOrType,
            referenceType,
            referenceId,
            message,
          };

    return this.jobsRepo.create({
      organizationId: orgId,
      jobType: params.jobType,
      status: JobStatus.QUEUED,
      progress: 0,
      message: params.message ?? 'Job queued',
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      result: null,
      error: null,
    });
  }

  async markRunning(
    orgId: string,
    id: string,
    message?: string,
    progress = 10,
  ): Promise<Job> {
    const job = await this.jobsRepo.findById(orgId, id);
    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID ${id} not found`,
      });
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
      throw new ConflictException({
        code: 'INVALID_JOB_TRANSITION',
        message: `Cannot transition job from ${job.status} to ${JobStatus.RUNNING}`,
      });
    }

    return this.jobsRepo.update(orgId, id, {
      status: JobStatus.RUNNING,
      progress: Math.min(100, Math.max(job.progress, progress)),
      message: message ?? 'Job is running',
      startedAt: job.startedAt || new Date(),
    });
  }

  async updateProgress(
    orgId: string,
    id: string,
    progress: number,
    message?: string,
  ): Promise<Job> {
    const job = await this.jobsRepo.findById(orgId, id);
    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID ${id} not found`,
      });
    }

    if (job.status !== JobStatus.RUNNING) {
      throw new ConflictException({
        code: 'INVALID_JOB_TRANSITION',
        message: `Cannot update progress for job with status ${job.status}`,
      });
    }

    return this.jobsRepo.update(orgId, id, {
      progress: Math.min(100, Math.max(0, progress)),
      message: message ?? job.message,
    });
  }

  async markCompleted(
    orgId: string,
    id: string,
    result?: Record<string, unknown>,
    message?: string,
  ): Promise<Job> {
    const job = await this.jobsRepo.findById(orgId, id);
    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID ${id} not found`,
      });
    }

    if (job.status === JobStatus.COMPLETED) {
      return job;
    }

    if (job.status === JobStatus.FAILED) {
      throw new ConflictException({
        code: 'INVALID_JOB_TRANSITION',
        message: `Cannot transition job from ${job.status} to ${JobStatus.COMPLETED}`,
      });
    }

    const now = new Date();
    return this.jobsRepo.update(orgId, id, {
      status: JobStatus.COMPLETED,
      progress: 100,
      message: message ?? 'Job completed successfully',
      result: result ?? job.result,
      completedAt: now,
    });
  }

  async markFailed(
    orgId: string,
    id: string,
    error: unknown,
    message?: string,
  ): Promise<Job> {
    const job = await this.jobsRepo.findById(orgId, id);
    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID ${id} not found`,
      });
    }

    if (job.status === JobStatus.COMPLETED) {
      throw new ConflictException({
        code: 'INVALID_JOB_TRANSITION',
        message: `Cannot transition job from ${job.status} to ${JobStatus.FAILED}`,
      });
    }

    const sanitized = this.sanitizeError(error);
    const now = new Date();

    return this.jobsRepo.update(orgId, id, {
      status: JobStatus.FAILED,
      message: message ?? (sanitized.message as string) ?? 'Job failed',
      error: sanitized,
      completedAt: now,
    });
  }

  async getJob(orgId: string, id: string): Promise<JobResponseDto> {
    const job = await this.jobsRepo.findById(orgId, id);
    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job with ID ${id} not found`,
      });
    }

    return this.mapToResponse(job);
  }

  async listJobs(
    orgId: string,
    query: QueryJobsDto,
  ): Promise<PaginatedJobsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { data, total } = await this.jobsRepo.findMany(orgId, query);
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data: data.map((j) => this.mapToResponse(j)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private mapToResponse(job: Job): JobResponseDto {
    return {
      id: job.id,
      organizationId: job.organizationId,
      jobType: job.jobType,
      status: job.status as JobStatus,
      progress: job.progress,
      message: job.message,
      referenceType: job.referenceType,
      referenceId: job.referenceId,
      result: (job.result as Record<string, unknown>) || null,
      error: (job.error as Record<string, unknown>) || null,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}

import { Import } from '@reconcilex/db';

export const JOB_SERVICE = 'JOB_SERVICE';

export interface JobOptions {
  maxRows?: number;
  columnMapping?: Record<string, string>;
}

export interface JobService {
  submitImport(
    importRecord: Import,
    options?: JobOptions,
  ): Promise<{ jobId: string; status: string }>;
}

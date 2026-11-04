import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { parseCsvStream } from '@reconcilex/csv';
import {
  AuditAction,
  AuditEntityType,
  Import,
  Job,
  JobType,
  NewDuplicateCandidate,
  NewImportRowError,
  NewTransaction,
} from '@reconcilex/db';
import { AuditService } from '../../audit/audit.service';
import { JobsService } from '../../jobs/jobs.service';
import {
  DATA_SOURCES_REPOSITORY,
  IDataSourcesRepository,
} from '../../data-sources/repositories/data-sources.repository.interface';
import {
  ITransactionsRepository,
  TRANSACTIONS_REPOSITORY,
} from '../../transactions/repositories/transactions.repository.interface';
import { STORAGE_SERVICE, StorageService } from '../../storage';
import {
  IMPORTS_REPOSITORY,
  IImportsRepository,
} from '../repositories/imports.repository.interface';
import { JobOptions, JobService } from './job.service.interface';

const BATCH_SIZE = 1000;

@Injectable()
export class SyncJobService implements JobService {
  private readonly logger = new Logger(SyncJobService.name);

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    @Inject(DATA_SOURCES_REPOSITORY)
    private readonly dataSourcesRepo: IDataSourcesRepository,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionsRepo: ITransactionsRepository,
    @Inject(IMPORTS_REPOSITORY)
    private readonly importsRepo: IImportsRepository,
    @Optional()
    private readonly jobsService?: JobsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  async submitImport(
    importRecord: Import,
    options?: JobOptions,
  ): Promise<{ jobId: string; status: string }> {
    const importId = importRecord.id;
    const organizationId = importRecord.organizationId;
    const dataSourceId = importRecord.dataSourceId;

    let jobRecord: Job | null = null;
    if (this.jobsService) {
      jobRecord = await this.jobsService.createJob(
        organizationId,
        JobType.CSV_IMPORT,
        'IMPORT',
        importId,
      );
      await this.jobsService.markRunning(
        organizationId,
        jobRecord.id,
        'Processing CSV import...',
      );
    }

    try {
      // 1. Update status to PROCESSING
      await this.importsRepo.updateImport(importId, { status: 'PROCESSING' });

      // 2. Fetch data source column mapping
      const dataSource = await this.dataSourcesRepo.findById(organizationId, dataSourceId);
      if (!dataSource) {
        throw new Error(`Data source ${dataSourceId} not found for organization ${organizationId}`);
      }

      const columnMapping =
        options?.columnMapping || (dataSource.columnMapping as unknown as Record<string, string>);

      // 3. Get file stream from storage
      const stream = await this.storageService.getObjectStream(importRecord.storageKey);

      // 4. Counters & tracking
      let totalRows = 0;
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      const seenExternalIdsInFile = new Set<string>();

      let batchValidTxns: NewTransaction[] = [];
      let batchRowErrors: NewImportRowError[] = [];
      let batchDuplicates: NewDuplicateCandidate[] = [];

      // Flush batch helper
      const flushBatch = async () => {
        // Flush row errors
        if (batchRowErrors.length > 0) {
          await this.importsRepo.createRowErrors(batchRowErrors);
          batchRowErrors = [];
        }

        // Process valid txns against DB for duplicates
        if (batchValidTxns.length > 0) {
          const externalIds = batchValidTxns.map((t) => t.externalId);
          const existingTxns = await this.transactionsRepo.findByExternalIds(
            organizationId,
            dataSourceId,
            externalIds,
          );

          const existingMap = new Map(existingTxns.map((t) => [t.externalId, t]));
          const toInsert: NewTransaction[] = [];

          for (const txn of batchValidTxns) {
            const existing = existingMap.get(txn.externalId);
            if (existing) {
              batchDuplicates.push({
                organizationId,
                importId,
                dataSourceId,
                existingTransactionId: existing.id,
                candidateFingerprint: txn.fingerprint,
                externalId: txn.externalId,
                rowNumber: (txn as unknown as { _rowNumber?: number })._rowNumber,
                reason: 'EXISTING_EXTERNAL_ID',
                status: 'FLAGGED',
              });
              duplicateCount++;
            } else {
              toInsert.push(txn);
              validCount++;
            }
          }

          if (toInsert.length > 0) {
            await this.transactionsRepo.createBatch(organizationId, toInsert);
          }

          batchValidTxns = [];
        }

        // Flush duplicates
        if (batchDuplicates.length > 0) {
          await this.importsRepo.createDuplicateCandidates(batchDuplicates);
          batchDuplicates = [];
        }
      };

      // 5. Stream parser
      const generator = parseCsvStream(stream, columnMapping, {
        maxRows: options?.maxRows ?? 20000,
      });

      let headerFailed = false;

      for await (const rowResult of generator) {
        if (rowResult.rowNumber === 1 && rowResult.errors && rowResult.errors.length > 0) {
          // Headers invalid!
          headerFailed = true;
          for (const err of rowResult.errors) {
            batchRowErrors.push({
              organizationId,
              importId,
              rowNumber: 1,
              code: err.code,
              message: err.message,
            });
          }
          break;
        }

        totalRows++;

        if (rowResult.errors && rowResult.errors.length > 0) {
          invalidCount++;
          for (const err of rowResult.errors) {
            batchRowErrors.push({
              organizationId,
              importId,
              rowNumber: err.rowNumber,
              field: err.field ?? null,
              code: err.code,
              rawValue: err.rawValue ?? null,
              message: err.message,
            });
          }
        } else if (rowResult.normalizedRow) {
          const row = rowResult.normalizedRow;

          if (seenExternalIdsInFile.has(row.externalId)) {
            // Duplicate within same CSV file!
            batchDuplicates.push({
              organizationId,
              importId,
              dataSourceId,
              candidateFingerprint: row.fingerprint,
              externalId: row.externalId,
              rowNumber: row.rowNumber,
              reason: 'WITHIN_FILE_DUPLICATE',
              status: 'FLAGGED',
            });
            duplicateCount++;
          } else {
            seenExternalIdsInFile.add(row.externalId);
            const txnToInsert: NewTransaction & { _rowNumber?: number } = {
              organizationId,
              dataSourceId,
              importId,
              externalId: row.externalId,
              amountMinor: row.amountMinor,
              currency: row.currency,
              transactionDate: new Date(row.transactionDate),
              reference: row.reference ?? null,
              externalTxnId: row.externalTxnId ?? null,
              merchantOrOrderId: row.merchantOrOrderId ?? null,
              txnType: row.txnType ?? null,
              status: 'UNMATCHED',
              normalizedPayload: row.normalizedPayload,
              fingerprint: row.fingerprint,
              _rowNumber: row.rowNumber,
            };
            batchValidTxns.push(txnToInsert);
          }
        }

        if (
          batchValidTxns.length >= BATCH_SIZE ||
          batchRowErrors.length >= BATCH_SIZE ||
          batchDuplicates.length >= BATCH_SIZE
        ) {
          await flushBatch();
        }
      }

      await flushBatch();

      const finalStatus = headerFailed ? 'FAILED' : 'COMPLETED';
      await this.importsRepo.updateImport(importId, {
        status: finalStatus,
        rowCount: totalRows,
        validCount,
        invalidCount,
        duplicateCount,
        completedAt: new Date(),
        errorSummary: headerFailed
          ? { reason: 'CSV headers did not match required data source column mapping' }
          : undefined,
      });

      if (this.jobsService && jobRecord) {
        if (finalStatus === 'COMPLETED') {
          await this.jobsService.markCompleted(organizationId, jobRecord.id, {
            rowCount: totalRows,
            validCount,
            invalidCount,
            duplicateCount,
          });
        } else {
          await this.jobsService.markFailed(
            organizationId,
            jobRecord.id,
            'CSV headers did not match required data source column mapping',
          );
        }
      }

      if (this.auditService) {
        if (finalStatus === 'COMPLETED') {
          await this.auditService.logSystemAction(
            organizationId,
            AuditAction.IMPORT_COMPLETED,
            AuditEntityType.IMPORT,
            importId,
            { totalRows, validCount, invalidCount, duplicateCount },
          );
        } else {
          await this.auditService.logSystemAction(
            organizationId,
            AuditAction.IMPORT_FAILED,
            AuditEntityType.IMPORT,
            importId,
            { error: 'CSV headers did not match required data source column mapping' },
          );
        }
      }

      return { jobId: jobRecord?.id || importId, status: finalStatus };
    } catch (error) {
      this.logger.error(
        `Failed processing import ${importId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      await this.importsRepo.updateImport(importId, {
        status: 'FAILED',
        completedAt: new Date(),
        errorSummary: {
          error: (error as Error).message,
        },
      });

      if (this.jobsService && jobRecord) {
        await this.jobsService.markFailed(organizationId, jobRecord.id, (error as Error).message);
      }

      if (this.auditService) {
        await this.auditService.logSystemAction(
          organizationId,
          AuditAction.IMPORT_FAILED,
          AuditEntityType.IMPORT,
          importId,
          { error: (error as Error).message },
        );
      }

      return { jobId: jobRecord?.id || importId, status: 'FAILED' };
    }
  }
}

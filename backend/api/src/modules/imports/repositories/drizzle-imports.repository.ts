import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  DatabaseClient,
  desc,
  DuplicateCandidate,
  duplicateCandidates,
  eq,
  Import,
  ImportRowError,
  importRowErrors,
  imports,
  NewDuplicateCandidate,
  NewImport,
  NewImportRowError,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import {
  DuplicateCandidateDto,
  ImportDto,
  ImportRowErrorDto,
  PaginatedDuplicateCandidatesResponse,
  PaginatedImportErrorsResponse,
  PaginatedImportsResponse,
  QueryDuplicateCandidatesDto,
  QueryImportErrorsDto,
  QueryImportsDto,
} from '../dto/import.dto';
import { IImportsRepository } from './imports.repository.interface';

@Injectable()
export class DrizzleImportsRepository implements IImportsRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async createImport(newImport: NewImport): Promise<Import> {
    const [record] = await this.db.insert(imports).values(newImport).returning();
    return record;
  }

  async updateImport(id: string, updates: Partial<Import>): Promise<Import | null> {
    const [record] = await this.db
      .update(imports)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(imports.id, id))
      .returning();
    return record || null;
  }

  async findImportById(organizationId: string, id: string): Promise<Import | null> {
    const [record] = await this.db
      .select()
      .from(imports)
      .where(and(eq(imports.organizationId, organizationId), eq(imports.id, id)));
    return record || null;
  }

  async findImportBySha256(
    organizationId: string,
    dataSourceId: string,
    contentSha256: string,
  ): Promise<Import | null> {
    const [record] = await this.db
      .select()
      .from(imports)
      .where(
        and(
          eq(imports.organizationId, organizationId),
          eq(imports.dataSourceId, dataSourceId),
          eq(imports.contentSha256, contentSha256),
        ),
      );
    return record || null;
  }

  async findImports(
    organizationId: string,
    query: QueryImportsDto,
  ): Promise<PaginatedImportsResponse> {
    const conditions: (SQL | undefined)[] = [eq(imports.organizationId, organizationId)];

    if (query.dataSourceId) {
      conditions.push(eq(imports.dataSourceId, query.dataSourceId));
    }
    if (query.status) {
      conditions.push(eq(imports.status, query.status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db.select({ total: count() }).from(imports).where(whereClause);

    const total = Number(countResult?.total ?? 0);
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(imports)
      .where(whereClause)
      .orderBy(desc(imports.createdAt))
      .limit(limit)
      .offset(offset);

    const data: ImportDto[] = rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      dataSourceId: r.dataSourceId,
      storageKey: r.storageKey,
      originalFilename: r.originalFilename,
      contentSha256: r.contentSha256,
      status: r.status,
      rowCount: r.rowCount,
      validCount: r.validCount,
      invalidCount: r.invalidCount,
      duplicateCount: r.duplicateCount,
      totalRecords: r.rowCount,
      validRecords: r.validCount,
      invalidRecords: r.invalidCount,
      duplicateRecords: r.duplicateCount,
      errorSummary: r.errorSummary,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt,
    }));

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async createRowErrors(errors: NewImportRowError[]): Promise<ImportRowError[]> {
    if (errors.length === 0) return [];
    return this.db.insert(importRowErrors).values(errors).returning();
  }

  async findRowErrors(
    organizationId: string,
    importId: string,
    query: QueryImportErrorsDto,
  ): Promise<PaginatedImportErrorsResponse> {
    const whereClause = and(
      eq(importRowErrors.organizationId, organizationId),
      eq(importRowErrors.importId, importId),
    );

    const [countResult] = await this.db
      .select({ total: count() })
      .from(importRowErrors)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(importRowErrors)
      .where(whereClause)
      .orderBy(importRowErrors.rowNumber)
      .limit(limit)
      .offset(offset);

    const data: ImportRowErrorDto[] = rows.map((r) => ({
      id: r.id,
      importId: r.importId,
      rowNumber: r.rowNumber,
      field: r.field,
      code: r.code,
      rawValue: r.rawValue,
      message: r.message,
      createdAt: r.createdAt,
    }));

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async createDuplicateCandidates(
    candidates: NewDuplicateCandidate[],
  ): Promise<DuplicateCandidate[]> {
    if (candidates.length === 0) return [];
    return this.db.insert(duplicateCandidates).values(candidates).returning();
  }

  async findDuplicateCandidates(
    organizationId: string,
    query: QueryDuplicateCandidatesDto,
  ): Promise<PaginatedDuplicateCandidatesResponse> {
    const conditions: (SQL | undefined)[] = [
      eq(duplicateCandidates.organizationId, organizationId),
    ];

    if (query.importId) {
      conditions.push(eq(duplicateCandidates.importId, query.importId));
    }
    if (query.dataSourceId) {
      conditions.push(eq(duplicateCandidates.dataSourceId, query.dataSourceId));
    }
    if (query.status) {
      conditions.push(eq(duplicateCandidates.status, query.status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(duplicateCandidates)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(duplicateCandidates)
      .where(whereClause)
      .orderBy(desc(duplicateCandidates.createdAt))
      .limit(limit)
      .offset(offset);

    const data: DuplicateCandidateDto[] = rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      importId: r.importId,
      dataSourceId: r.dataSourceId,
      existingTransactionId: r.existingTransactionId,
      candidateFingerprint: r.candidateFingerprint,
      externalId: r.externalId,
      rowNumber: r.rowNumber,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}

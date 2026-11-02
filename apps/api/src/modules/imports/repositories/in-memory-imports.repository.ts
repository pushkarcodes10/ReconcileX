import { Injectable } from '@nestjs/common';
import {
  DuplicateCandidate,
  Import,
  ImportRowError,
  NewDuplicateCandidate,
  NewImport,
  NewImportRowError,
} from '@reconcilex/db';
import { randomUUID } from 'crypto';
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
export class InMemoryImportsRepository implements IImportsRepository {
  public imports: Import[] = [];
  public importRowErrors: ImportRowError[] = [];
  public duplicateCandidates: DuplicateCandidate[] = [];

  async createImport(newImport: NewImport): Promise<Import> {
    const now = new Date();
    const record: Import = {
      id: newImport.id || randomUUID(),
      organizationId: newImport.organizationId,
      dataSourceId: newImport.dataSourceId,
      storageKey: newImport.storageKey,
      originalFilename: newImport.originalFilename,
      contentSha256: newImport.contentSha256,
      status: newImport.status || 'QUEUED',
      rowCount: newImport.rowCount || 0,
      validCount: newImport.validCount || 0,
      invalidCount: newImport.invalidCount || 0,
      duplicateCount: newImport.duplicateCount || 0,
      errorSummary: (newImport.errorSummary as Record<string, unknown>) ?? null,
      createdAt: newImport.createdAt instanceof Date ? newImport.createdAt : now,
      updatedAt: newImport.updatedAt instanceof Date ? newImport.updatedAt : now,
      completedAt: newImport.completedAt instanceof Date ? newImport.completedAt : null,
    };
    this.imports.push(record);
    return { ...record };
  }

  async updateImport(id: string, updates: Partial<Import>): Promise<Import | null> {
    const idx = this.imports.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const updated: Import = {
      ...this.imports[idx],
      ...updates,
      updatedAt: new Date(),
    };
    this.imports[idx] = updated;
    return { ...updated };
  }

  async findImportById(organizationId: string, id: string): Promise<Import | null> {
    const record = this.imports.find((i) => i.organizationId === organizationId && i.id === id);
    return record ? { ...record } : null;
  }

  async findImportBySha256(
    organizationId: string,
    dataSourceId: string,
    contentSha256: string,
  ): Promise<Import | null> {
    const record = this.imports.find(
      (i) =>
        i.organizationId === organizationId &&
        i.dataSourceId === dataSourceId &&
        i.contentSha256 === contentSha256,
    );
    return record ? { ...record } : null;
  }

  async findImports(
    organizationId: string,
    query: QueryImportsDto,
  ): Promise<PaginatedImportsResponse> {
    let filtered = this.imports.filter((i) => i.organizationId === organizationId);

    if (query.dataSourceId) {
      filtered = filtered.filter((i) => i.dataSourceId === query.dataSourceId);
    }
    if (query.status) {
      filtered = filtered.filter((i) => i.status === query.status);
    }

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = (page - 1) * limit;

    const rows = filtered.slice(offset, offset + limit);

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
    const created: ImportRowError[] = errors.map((e) => {
      const rec: ImportRowError = {
        id: e.id || randomUUID(),
        organizationId: e.organizationId,
        importId: e.importId,
        rowNumber: e.rowNumber,
        field: e.field ?? null,
        code: e.code,
        rawValue: e.rawValue ?? null,
        message: e.message,
        createdAt: e.createdAt instanceof Date ? e.createdAt : new Date(),
      };
      this.importRowErrors.push(rec);
      return rec;
    });
    return created;
  }

  async findRowErrors(
    organizationId: string,
    importId: string,
    query: QueryImportErrorsDto,
  ): Promise<PaginatedImportErrorsResponse> {
    const filtered = this.importRowErrors.filter(
      (e) => e.organizationId === organizationId && e.importId === importId,
    );

    filtered.sort((a, b) => a.rowNumber - b.rowNumber);

    const total = filtered.length;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = (page - 1) * limit;

    const rows = filtered.slice(offset, offset + limit);

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
    const created: DuplicateCandidate[] = candidates.map((c) => {
      const now = new Date();
      const rec: DuplicateCandidate = {
        id: c.id || randomUUID(),
        organizationId: c.organizationId,
        importId: c.importId,
        dataSourceId: c.dataSourceId,
        existingTransactionId: c.existingTransactionId ?? null,
        candidateFingerprint: c.candidateFingerprint ?? null,
        externalId: c.externalId,
        rowNumber: c.rowNumber ?? null,
        reason: c.reason,
        status: c.status || 'FLAGGED',
        createdAt: c.createdAt instanceof Date ? c.createdAt : now,
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt : now,
      };
      this.duplicateCandidates.push(rec);
      return rec;
    });
    return created;
  }

  async findDuplicateCandidates(
    organizationId: string,
    query: QueryDuplicateCandidatesDto,
  ): Promise<PaginatedDuplicateCandidatesResponse> {
    let filtered = this.duplicateCandidates.filter((c) => c.organizationId === organizationId);

    if (query.importId) {
      filtered = filtered.filter((c) => c.importId === query.importId);
    }
    if (query.dataSourceId) {
      filtered = filtered.filter((c) => c.dataSourceId === query.dataSourceId);
    }
    if (query.status) {
      filtered = filtered.filter((c) => c.status === query.status);
    }

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const page = query.page && query.page > 0 ? query.page : 1;
    const offset = (page - 1) * limit;

    const rows = filtered.slice(offset, offset + limit);

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

  clear(): void {
    this.imports = [];
    this.importRowErrors = [];
    this.duplicateCandidates = [];
  }
}

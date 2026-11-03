import {
  DuplicateCandidate,
  Import,
  ImportRowError,
  NewDuplicateCandidate,
  NewImport,
  NewImportRowError,
} from '@reconcilex/db';
import {
  PaginatedDuplicateCandidatesResponse,
  PaginatedImportErrorsResponse,
  PaginatedImportsResponse,
  QueryDuplicateCandidatesDto,
  QueryImportErrorsDto,
  QueryImportsDto,
} from '../dto/import.dto';

export const IMPORTS_REPOSITORY = 'IMPORTS_REPOSITORY';

export interface IImportsRepository {
  createImport(newImport: NewImport): Promise<Import>;
  updateImport(id: string, updates: Partial<Import>): Promise<Import | null>;
  findImportById(organizationId: string, id: string): Promise<Import | null>;
  findImportBySha256(
    organizationId: string,
    dataSourceId: string,
    contentSha256: string,
  ): Promise<Import | null>;
  findImports(organizationId: string, query: QueryImportsDto): Promise<PaginatedImportsResponse>;

  createRowErrors(errors: NewImportRowError[]): Promise<ImportRowError[]>;
  findRowErrors(
    organizationId: string,
    importId: string,
    query: QueryImportErrorsDto,
  ): Promise<PaginatedImportErrorsResponse>;

  createDuplicateCandidates(candidates: NewDuplicateCandidate[]): Promise<DuplicateCandidate[]>;
  findDuplicateCandidates(
    organizationId: string,
    query: QueryDuplicateCandidatesDto,
  ): Promise<PaginatedDuplicateCandidatesResponse>;
}

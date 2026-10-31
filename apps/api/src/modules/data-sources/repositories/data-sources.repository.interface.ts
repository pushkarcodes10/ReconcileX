import { DataSource } from '@reconcilex/db';
import {
  CreateDataSourceDto,
  QueryDataSourcesDto,
  UpdateDataSourceDto,
} from '../dto/data-source.dto';

export const DATA_SOURCES_REPOSITORY = 'DATA_SOURCES_REPOSITORY';

export interface IDataSourcesRepository {
  create(organizationId: string, dto: CreateDataSourceDto): Promise<DataSource>;
  findById(organizationId: string, id: string): Promise<DataSource | null>;
  findByName(organizationId: string, name: string): Promise<DataSource | null>;
  findMany(
    organizationId: string,
    query?: QueryDataSourcesDto,
  ): Promise<{ data: DataSource[]; total: number }>;
  findByOrgId(organizationId: string): Promise<DataSource[]>;
  update(organizationId: string, id: string, dto: UpdateDataSourceDto): Promise<DataSource>;
  softDelete(organizationId: string, id: string): Promise<void>;
  countTransactionsByDataSourceId(organizationId: string, id: string): Promise<number>;
}

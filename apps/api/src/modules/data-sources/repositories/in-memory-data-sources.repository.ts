import { Injectable } from '@nestjs/common';
import { DataSource, DataSourceStatus } from '@reconcilex/db';
import { randomUUID } from 'crypto';
import {
  CreateDataSourceDto,
  QueryDataSourcesDto,
  UpdateDataSourceDto,
} from '../dto/data-source.dto';
import { IDataSourcesRepository } from './data-sources.repository.interface';

@Injectable()
export class InMemoryDataSourcesRepository implements IDataSourcesRepository {
  public dataSources: DataSource[] = [];
  public transactionsCountMap = new Map<string, number>();

  async create(organizationId: string, dto: CreateDataSourceDto): Promise<DataSource> {
    const ds: DataSource = {
      id: randomUUID(),
      organizationId,
      name: dto.name.trim(),
      type: dto.type,
      direction: dto.direction || 'INCOMING',
      columnMapping: dto.columnMapping,
      status: DataSourceStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.dataSources.push(ds);
    return ds;
  }

  async findById(organizationId: string, id: string): Promise<DataSource | null> {
    const ds = this.dataSources.find(
      (d) => d.organizationId === organizationId && d.id === id && !d.deletedAt,
    );
    return ds ? { ...ds } : null;
  }

  async findByName(organizationId: string, name: string): Promise<DataSource | null> {
    const ds = this.dataSources.find(
      (d) =>
        d.organizationId === organizationId &&
        d.name.toLowerCase() === name.trim().toLowerCase() &&
        !d.deletedAt,
    );
    return ds ? { ...ds } : null;
  }

  async findByOrgId(organizationId: string): Promise<DataSource[]> {
    return this.dataSources
      .filter((d) => d.organizationId === organizationId && !d.deletedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((d) => ({ ...d }));
  }

  async findMany(
    organizationId: string,
    query?: QueryDataSourcesDto,
  ): Promise<{ data: DataSource[]; total: number }> {
    let filtered = this.dataSources.filter(
      (d) => d.organizationId === organizationId && !d.deletedAt,
    );

    if (query?.type) {
      filtered = filtered.filter((d) => d.type === query.type);
    }

    if (query?.status) {
      filtered = filtered.filter((d) => d.status === query.status);
    }

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;

    if (query?.page || query?.limit) {
      const page = query?.page && query.page > 0 ? query.page : 1;
      const limit = query?.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
      const offset = (page - 1) * limit;
      filtered = filtered.slice(offset, offset + limit);
    }

    return {
      data: filtered.map((d) => ({ ...d })),
      total,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateDataSourceDto): Promise<DataSource> {
    const index = this.dataSources.findIndex(
      (d) => d.organizationId === organizationId && d.id === id && !d.deletedAt,
    );
    if (index === -1) {
      throw new Error('Data source not found');
    }

    const current = this.dataSources[index];
    const updated: DataSource = {
      ...current,
      name: dto.name !== undefined ? dto.name.trim() : current.name,
      type: dto.type !== undefined ? dto.type : current.type,
      columnMapping: dto.columnMapping !== undefined ? dto.columnMapping : current.columnMapping,
      status: dto.status !== undefined ? dto.status : current.status,
      updatedAt: new Date(),
    };

    this.dataSources[index] = updated;
    return { ...updated };
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const ds = this.dataSources.find((d) => d.organizationId === organizationId && d.id === id);
    if (ds) {
      ds.status = DataSourceStatus.INACTIVE;
      ds.deletedAt = new Date();
      ds.updatedAt = new Date();
    }
  }

  async countTransactionsByDataSourceId(_organizationId: string, id: string): Promise<number> {
    return this.transactionsCountMap.get(id) || 0;
  }
}

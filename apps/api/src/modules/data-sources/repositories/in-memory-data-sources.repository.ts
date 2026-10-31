import { Injectable } from '@nestjs/common';
import { DataSource, DataSourceStatus } from '@reconcilex/db';
import { randomUUID } from 'crypto';
import { CreateDataSourceDto, UpdateDataSourceDto } from '../dto/data-source.dto';
import { IDataSourcesRepository } from './data-sources.repository.interface';

@Injectable()
export class InMemoryDataSourcesRepository implements IDataSourcesRepository {
  public dataSources: DataSource[] = [];
  public transactionsCountMap = new Map<string, number>();

  async create(
    organizationId: string,
    dto: CreateDataSourceDto,
  ): Promise<DataSource> {
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
    };
    this.dataSources.push(ds);
    return ds;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<DataSource | null> {
    const ds = this.dataSources.find(
      (d) => d.organizationId === organizationId && d.id === id,
    );
    return ds ? { ...ds } : null;
  }

  async findByName(
    organizationId: string,
    name: string,
  ): Promise<DataSource | null> {
    const ds = this.dataSources.find(
      (d) =>
        d.organizationId === organizationId &&
        d.name.toLowerCase() === name.trim().toLowerCase(),
    );
    return ds ? { ...ds } : null;
  }

  async findByOrgId(organizationId: string): Promise<DataSource[]> {
    return this.dataSources
      .filter((d) => d.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((d) => ({ ...d }));
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateDataSourceDto,
  ): Promise<DataSource> {
    const index = this.dataSources.findIndex(
      (d) => d.organizationId === organizationId && d.id === id,
    );
    if (index === -1) {
      throw new Error('Data source not found');
    }

    const current = this.dataSources[index];
    const updated: DataSource = {
      ...current,
      name: dto.name !== undefined ? dto.name.trim() : current.name,
      type: dto.type !== undefined ? dto.type : current.type,
      columnMapping:
        dto.columnMapping !== undefined
          ? dto.columnMapping
          : current.columnMapping,
      status: dto.status !== undefined ? dto.status : current.status,
      updatedAt: new Date(),
    };

    this.dataSources[index] = updated;
    return { ...updated };
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const ds = this.dataSources.find(
      (d) => d.organizationId === organizationId && d.id === id,
    );
    if (ds) {
      ds.status = DataSourceStatus.ARCHIVED;
      ds.updatedAt = new Date();
    }
  }

  async countTransactionsByDataSourceId(
    _organizationId: string,
    id: string,
  ): Promise<number> {
    return this.transactionsCountMap.get(id) || 0;
  }
}

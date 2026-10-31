import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  DataSource,
  DataSourceStatus,
  dataSources,
  desc,
  eq,
  transactions,
} from '@reconcilex/db';
import { DATABASE_CLIENT, DatabaseClient } from '../../../database/database.constants';
import { CreateDataSourceDto, UpdateDataSourceDto } from '../dto/data-source.dto';
import { IDataSourcesRepository } from './data-sources.repository.interface';

@Injectable()
export class DrizzleDataSourcesRepository implements IDataSourcesRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async create(
    organizationId: string,
    dto: CreateDataSourceDto,
  ): Promise<DataSource> {
    const [created] = await this.db
      .insert(dataSources)
      .values({
        organizationId,
        name: dto.name.trim(),
        type: dto.type,
        direction: dto.direction || 'INCOMING',
        columnMapping: dto.columnMapping,
        status: DataSourceStatus.ACTIVE,
      })
      .returning();

    return created;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<DataSource | null> {
    const [record] = await this.db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.id, id),
        ),
      );

    return record || null;
  }

  async findByName(
    organizationId: string,
    name: string,
  ): Promise<DataSource | null> {
    const [record] = await this.db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.name, name.trim()),
        ),
      );

    return record || null;
  }

  async findByOrgId(organizationId: string): Promise<DataSource[]> {
    return this.db
      .select()
      .from(dataSources)
      .where(eq(dataSources.organizationId, organizationId))
      .orderBy(desc(dataSources.createdAt));
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateDataSourceDto,
  ): Promise<DataSource> {
    const updateValues: Partial<typeof dataSources.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      updateValues.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      updateValues.type = dto.type;
    }
    if (dto.columnMapping !== undefined) {
      updateValues.columnMapping = dto.columnMapping;
    }
    if (dto.status !== undefined) {
      updateValues.status = dto.status;
    }

    const [updated] = await this.db
      .update(dataSources)
      .set(updateValues)
      .where(
        and(
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.id, id),
        ),
      )
      .returning();

    return updated;
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await this.db
      .update(dataSources)
      .set({
        status: DataSourceStatus.ARCHIVED,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.id, id),
        ),
      );
  }

  async countTransactionsByDataSourceId(
    organizationId: string,
    id: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.organizationId, organizationId),
          eq(transactions.dataSourceId, id),
        ),
      );

    return Number(result?.count ?? 0);
  }
}

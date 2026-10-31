import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  DatabaseClient,
  DataSource,
  DataSourceStatus,
  dataSources,
  desc,
  eq,
  isNull,
  transactions,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import {
  CreateDataSourceDto,
  QueryDataSourcesDto,
  UpdateDataSourceDto,
} from '../dto/data-source.dto';
import { IDataSourcesRepository } from './data-sources.repository.interface';

@Injectable()
export class DrizzleDataSourcesRepository implements IDataSourcesRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async create(organizationId: string, dto: CreateDataSourceDto): Promise<DataSource> {
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

  async findById(organizationId: string, id: string): Promise<DataSource | null> {
    const [record] = await this.db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.id, id),
          isNull(dataSources.deletedAt),
        ),
      );

    return record || null;
  }

  async findByName(organizationId: string, name: string): Promise<DataSource | null> {
    const [record] = await this.db
      .select()
      .from(dataSources)
      .where(
        and(
          eq(dataSources.organizationId, organizationId),
          eq(dataSources.name, name.trim()),
          isNull(dataSources.deletedAt),
        ),
      );

    return record || null;
  }

  async findByOrgId(organizationId: string): Promise<DataSource[]> {
    return this.db
      .select()
      .from(dataSources)
      .where(and(eq(dataSources.organizationId, organizationId), isNull(dataSources.deletedAt)))
      .orderBy(desc(dataSources.createdAt));
  }

  async findMany(
    organizationId: string,
    query?: QueryDataSourcesDto,
  ): Promise<{ data: DataSource[]; total: number }> {
    const conditions: (SQL | undefined)[] = [
      eq(dataSources.organizationId, organizationId),
      isNull(dataSources.deletedAt),
    ];

    if (query?.type) {
      conditions.push(eq(dataSources.type, query.type));
    }

    if (query?.status) {
      conditions.push(eq(dataSources.status, query.status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(dataSources)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const offset = (page - 1) * limit;

    const data = await this.db
      .select()
      .from(dataSources)
      .where(whereClause)
      .orderBy(desc(dataSources.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async update(organizationId: string, id: string, dto: UpdateDataSourceDto): Promise<DataSource> {
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
          isNull(dataSources.deletedAt),
        ),
      )
      .returning();

    return updated;
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    await this.db
      .update(dataSources)
      .set({
        status: DataSourceStatus.INACTIVE,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(dataSources.organizationId, organizationId), eq(dataSources.id, id)));
  }

  async countTransactionsByDataSourceId(organizationId: string, id: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(transactions)
      .where(
        and(eq(transactions.organizationId, organizationId), eq(transactions.dataSourceId, id)),
      );

    return Number(result?.count ?? 0);
  }
}

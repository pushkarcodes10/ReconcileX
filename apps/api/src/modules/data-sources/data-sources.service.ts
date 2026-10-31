import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from '@reconcilex/db';
import {
  ColumnMappingDto,
  CreateDataSourceDto,
  QueryDataSourcesDto,
  UpdateDataSourceDto,
} from './dto/data-source.dto';
import {
  DATA_SOURCES_REPOSITORY,
  IDataSourcesRepository,
} from './repositories/data-sources.repository.interface';

@Injectable()
export class DataSourcesService {
  constructor(
    @Inject(DATA_SOURCES_REPOSITORY)
    private readonly dataSourcesRepo: IDataSourcesRepository,
  ) {}

  private normalizeColumnMapping(mapping: ColumnMappingDto): ColumnMappingDto {
    const external_id = (mapping.external_id || mapping.externalId || '').trim();
    const amount = (mapping.amount || '').trim();
    const date = (mapping.date || mapping.transactionDate || '').trim();
    const currency = (mapping.currency || '').trim();

    if (!external_id || !amount || !date || !currency) {
      throw new BadRequestException(
        'Column mapping must contain non-empty mappings for external_id, amount, date, and currency',
      );
    }

    const normalized: ColumnMappingDto = {
      external_id,
      amount,
      date,
      currency,
    };

    const reference = (mapping.reference || '').trim();
    if (reference) normalized.reference = reference;

    const external_txn_id = (mapping.external_txn_id || mapping.externalTxnId || '').trim();
    if (external_txn_id) normalized.external_txn_id = external_txn_id;

    const merchant_or_order_id = (
      mapping.merchant_or_order_id ||
      mapping.merchantOrOrderId ||
      ''
    ).trim();
    if (merchant_or_order_id) normalized.merchant_or_order_id = merchant_or_order_id;

    const txn_type = (mapping.txn_type || mapping.txnType || '').trim();
    if (txn_type) normalized.txn_type = txn_type;

    return normalized;
  }

  async create(organizationId: string, dto: CreateDataSourceDto): Promise<DataSource> {
    const existing = await this.dataSourcesRepo.findByName(organizationId, dto.name);
    if (existing) {
      throw new ConflictException(
        `Data source with name "${dto.name}" already exists in this organization`,
      );
    }

    const normalizedMapping = this.normalizeColumnMapping(dto.columnMapping);

    return this.dataSourcesRepo.create(organizationId, {
      ...dto,
      columnMapping: normalizedMapping,
    });
  }

  async findAll(
    organizationId: string,
    query?: QueryDataSourcesDto,
  ): Promise<
    | DataSource[]
    | { data: DataSource[]; total: number; page: number; limit: number; totalPages: number }
  > {
    if (query?.page || query?.limit) {
      const page = query.page && query.page > 0 ? query.page : 1;
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

      const { data, total } = await this.dataSourcesRepo.findMany(organizationId, {
        ...query,
        page,
        limit,
      });

      const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

      return {
        data,
        total,
        page,
        limit,
        totalPages,
      };
    }

    if (query?.type || query?.status) {
      const { data } = await this.dataSourcesRepo.findMany(organizationId, query);
      return data;
    }

    return this.dataSourcesRepo.findByOrgId(organizationId);
  }

  async findOne(organizationId: string, id: string): Promise<DataSource> {
    const dataSource = await this.dataSourcesRepo.findById(organizationId, id);
    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }
    return dataSource;
  }

  async update(organizationId: string, id: string, dto: UpdateDataSourceDto): Promise<DataSource> {
    const existing = await this.dataSourcesRepo.findById(organizationId, id);
    if (!existing) {
      throw new NotFoundException('Data source not found');
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameConflict = await this.dataSourcesRepo.findByName(organizationId, dto.name);
      if (nameConflict && nameConflict.id !== id) {
        throw new ConflictException(
          `Data source with name "${dto.name}" already exists in this organization`,
        );
      }
    }

    const updatePayload: UpdateDataSourceDto = { ...dto };
    if (dto.columnMapping) {
      updatePayload.columnMapping = this.normalizeColumnMapping(dto.columnMapping);
    }

    return this.dataSourcesRepo.update(organizationId, id, updatePayload);
  }

  async remove(organizationId: string, id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.dataSourcesRepo.findById(organizationId, id);
    if (!existing) {
      throw new NotFoundException('Data source not found');
    }

    const txnCount = await this.dataSourcesRepo.countTransactionsByDataSourceId(organizationId, id);
    if (txnCount > 0) {
      throw new ConflictException(
        `Cannot delete data source with ${txnCount} associated transactions. Deactivate or archive it instead.`,
      );
    }

    await this.dataSourcesRepo.softDelete(organizationId, id);
    return {
      success: true,
      message: 'Data source successfully deleted',
    };
  }
}

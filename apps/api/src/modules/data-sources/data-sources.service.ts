import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from '@reconcilex/db';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/data-source.dto';
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

  async create(
    organizationId: string,
    dto: CreateDataSourceDto,
  ): Promise<DataSource> {
    const existing = await this.dataSourcesRepo.findByName(
      organizationId,
      dto.name,
    );
    if (existing) {
      throw new ConflictException(
        `Data source with name "${dto.name}" already exists in this organization`,
      );
    }

    // Validate mandatory canonical mapping keys
    if (
      !dto.columnMapping?.externalId?.trim() ||
      !dto.columnMapping?.amount?.trim() ||
      !dto.columnMapping?.transactionDate?.trim()
    ) {
      throw new BadRequestException(
        'Column mapping must contain non-empty mappings for externalId, amount, and transactionDate',
      );
    }

    return this.dataSourcesRepo.create(organizationId, dto);
  }

  async findAll(organizationId: string): Promise<DataSource[]> {
    return this.dataSourcesRepo.findByOrgId(organizationId);
  }

  async findOne(organizationId: string, id: string): Promise<DataSource> {
    const dataSource = await this.dataSourcesRepo.findById(organizationId, id);
    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }
    return dataSource;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateDataSourceDto,
  ): Promise<DataSource> {
    const existing = await this.dataSourcesRepo.findById(organizationId, id);
    if (!existing) {
      throw new NotFoundException('Data source not found');
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameConflict = await this.dataSourcesRepo.findByName(
        organizationId,
        dto.name,
      );
      if (nameConflict && nameConflict.id !== id) {
        throw new ConflictException(
          `Data source with name "${dto.name}" already exists in this organization`,
        );
      }
    }

    if (dto.columnMapping) {
      if (
        !dto.columnMapping.externalId?.trim() ||
        !dto.columnMapping.amount?.trim() ||
        !dto.columnMapping.transactionDate?.trim()
      ) {
        throw new BadRequestException(
          'Column mapping must contain non-empty mappings for externalId, amount, and transactionDate',
        );
      }
    }

    return this.dataSourcesRepo.update(organizationId, id, dto);
  }

  async remove(organizationId: string, id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.dataSourcesRepo.findById(organizationId, id);
    if (!existing) {
      throw new NotFoundException('Data source not found');
    }

    const txnCount = await this.dataSourcesRepo.countTransactionsByDataSourceId(
      organizationId,
      id,
    );
    if (txnCount > 0) {
      throw new BadRequestException(
        `Cannot delete data source with ${txnCount} associated transactions. Deactivate or archive it instead.`,
      );
    }

    await this.dataSourcesRepo.softDelete(organizationId, id);
    return {
      success: true,
      message: 'Data source successfully archived',
    };
  }
}

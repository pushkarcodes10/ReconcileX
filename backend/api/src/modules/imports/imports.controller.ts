import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ImportDto,
  PaginatedDuplicateCandidatesResponse,
  PaginatedImportErrorsResponse,
  PaginatedImportsResponse,
  QueryDuplicateCandidatesDto,
  QueryImportErrorsDto,
  QueryImportsDto,
  UploadImportResponseDto,
} from './dto/import.dto';
import { ImportsService } from './imports.service';

@ApiTags('Imports')
@Controller(['orgs/:orgId', 'organizations/:orgId'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('data-sources/:id/imports')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload and ingest CSV transaction file',
    description:
      'Uploads a multipart CSV file to S3/MinIO, parses, validates, normalizes, detects duplicates, and executes batch insertion.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Data Source UUID' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'File accepted and ingested',
    type: UploadImportResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or missing headers' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Data source not found' })
  @ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'File exceeds 50MB limit' })
  async uploadImport(
    @Param('orgId') orgId: string,
    @Param('id') dataSourceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('columnMapping') rawColumnMapping?: string | Record<string, string>,
  ): Promise<UploadImportResponseDto> {
    let columnMapping: Record<string, string> | undefined;
    if (rawColumnMapping) {
      if (typeof rawColumnMapping === 'string') {
        try {
          columnMapping = JSON.parse(rawColumnMapping);
        } catch {
          columnMapping = undefined;
        }
      } else if (typeof rawColumnMapping === 'object') {
        columnMapping = rawColumnMapping;
      }
    }
    return this.importsService.uploadAndIngest(orgId, dataSourceId, file, columnMapping);
  }

  @Get('imports')
  @ApiOperation({ summary: 'List imports for organization' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated imports list',
  })
  async getImports(
    @Param('orgId') orgId: string,
    @Query() query: QueryImportsDto,
  ): Promise<PaginatedImportsResponse> {
    return this.importsService.getImports(orgId, query);
  }

  @Get('imports/:id')
  @ApiOperation({ summary: 'Get import details by ID' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Import UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Import details',
    type: ImportDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Import not found' })
  async getImportById(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.importsService.getImportById(orgId, id);
  }

  @Get('imports/:id/errors')
  @ApiOperation({ summary: 'Get paginated row-level validation errors for an import' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Import UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated row errors',
  })
  async getImportErrors(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query() query: QueryImportErrorsDto,
  ): Promise<PaginatedImportErrorsResponse> {
    return this.importsService.getImportErrors(orgId, id, query);
  }

  @Get('imports/:id/status')
  @ApiOperation({ summary: 'Get import status and progress counters' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Import UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Import status and progress',
  })
  async getImportStatus(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.importsService.getImportStatus(orgId, id);
  }

  @Get('duplicate-candidates')
  @ApiOperation({ summary: 'List duplicate transaction candidates in quarantine' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated duplicate candidates list',
  })
  async getDuplicateCandidates(
    @Param('orgId') orgId: string,
    @Query() query: QueryDuplicateCandidatesDto,
  ): Promise<PaginatedDuplicateCandidatesResponse> {
    return this.importsService.getDuplicateCandidates(orgId, query);
  }
}

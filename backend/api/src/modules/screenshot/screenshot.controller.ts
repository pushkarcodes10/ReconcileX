import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ConfirmDatasetDto,
  CreateScreenshotDatasetDto,
  ExtractScreenshotResponseDto,
  IngestScreenshotResponseDto,
  IngestScreenshotTransactionDto,
  ScreenshotDatasetDetailDto,
  ScreenshotExtractedRecordDto,
  UpdateExtractedRecordDto,
} from './dto/screenshot.dto';
import { ScreenshotService } from './screenshot.service';

@ApiTags('Screenshot Ingestion & Datasets')
@Controller(['orgs/:orgId/screenshot', 'organizations/:orgId/screenshot'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class ScreenshotController {
  constructor(private readonly screenshotService: ScreenshotService) {}

  // ---------------------------------------------------------------------------
  // 1. Direct Extract Single Image (Quick preview / backwards compatibility)
  // ---------------------------------------------------------------------------
  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Extract transaction metadata from uploaded receipt or payment screenshot',
    description:
      'Performs OCR and multimodal vision analysis on an uploaded screenshot image. Returns structured transaction fields.',
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Extracted transaction details',
    type: ExtractScreenshotResponseDto,
  })
  async extractScreenshot(
    @Param('orgId') orgId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ExtractScreenshotResponseDto> {
    return this.screenshotService.extractFromScreenshot(orgId, file);
  }

  // ---------------------------------------------------------------------------
  // 2. Direct Ingest Single Transaction (Backwards compatibility)
  // ---------------------------------------------------------------------------
  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Ingest extracted screenshot transaction directly into ledger for reconciliation',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Transaction successfully created and ready for reconciliation',
    type: IngestScreenshotResponseDto,
  })
  async ingestTransaction(
    @Param('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: IngestScreenshotTransactionDto,
  ): Promise<IngestScreenshotResponseDto> {
    return this.screenshotService.ingestScreenshotTransaction(orgId, userId, dto);
  }

  // ---------------------------------------------------------------------------
  // 3. Batch Screenshot Upload & Dataset Ingestion
  // ---------------------------------------------------------------------------
  @Post('datasets')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiOperation({
    summary: 'Upload a batch of transaction screenshots into a new reviewable dataset',
    description:
      'Stores images in private S3-compatible storage, runs OCR extraction, generates field confidences, flags duplicates, and prepares staged records for human review (REVIEW_REQUIRED status).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Vendor Invoices Batch 1' },
        dataSourceId: { type: 'string', format: 'uuid' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['name', 'files'],
    },
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Dataset created with extracted records in REVIEW_REQUIRED status',
    type: ScreenshotDatasetDetailDto,
  })
  async createDataset(
    @Param('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { name: string; dataSourceId?: string },
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ScreenshotDatasetDetailDto> {
    return this.screenshotService.createDataset(
      orgId,
      userId,
      { name: body.name, dataSourceId: body.dataSourceId },
      files,
    );
  }

  // ---------------------------------------------------------------------------
  // 4. List All Screenshot Datasets
  // ---------------------------------------------------------------------------
  @Get('datasets')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List all screenshot datasets for the organization',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of screenshot datasets with summary counts',
    type: [ScreenshotDatasetDetailDto],
  })
  async getDatasets(@Param('orgId') orgId: string): Promise<ScreenshotDatasetDetailDto[]> {
    return this.screenshotService.getDatasets(orgId);
  }

  // ---------------------------------------------------------------------------
  // 5. Get Dataset Detail by ID (Includes files, presigned URLs, & extracted records)
  // ---------------------------------------------------------------------------
  @Get('datasets/:id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get details of a screenshot dataset including files and extracted records',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Dataset UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detailed dataset with files and extracted records',
    type: ScreenshotDatasetDetailDto,
  })
  async getDatasetById(
    @Param('orgId') orgId: string,
    @Param('id') datasetId: string,
  ): Promise<ScreenshotDatasetDetailDto> {
    return this.screenshotService.getDatasetById(orgId, datasetId);
  }

  // ---------------------------------------------------------------------------
  // 6. Get Presigned Preview URL for a Screenshot File
  // ---------------------------------------------------------------------------
  @Get('files/:fileId/preview')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get temporary presigned preview URL for an uploaded screenshot image',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'fileId', description: 'Screenshot File UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Temporary presigned preview URL',
  })
  async getFilePreview(
    @Param('orgId') orgId: string,
    @Param('fileId') fileId: string,
  ): Promise<{ previewUrl: string; expiresInSeconds: number }> {
    return this.screenshotService.getFilePreviewUrl(orgId, fileId);
  }

  // ---------------------------------------------------------------------------
  // 7. Update Extracted Record (Human Review & Correction)
  // ---------------------------------------------------------------------------
  @Patch('records/:recordId')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Correct or adjust extracted values of a staged screenshot transaction',
    description:
      'Records user correction audit trail and updates staged record values before confirmation.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'recordId', description: 'Extracted Record UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated record',
    type: ScreenshotExtractedRecordDto,
  })
  async updateExtractedRecord(
    @Param('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateExtractedRecordDto,
  ): Promise<ScreenshotExtractedRecordDto> {
    return this.screenshotService.updateExtractedRecord(orgId, userId, recordId, dto);
  }

  // ---------------------------------------------------------------------------
  // 8. Confirm Dataset & Ingest into Ledger as READY Data Source
  // ---------------------------------------------------------------------------
  @Post('datasets/:id/confirm')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Confirm reviewed screenshot dataset and populate ledger transactions',
    description:
      'Transitions dataset status to READY, creates or links a SCREENSHOT data source, populates ledger transactions linked to screenshots, and enables the dataset for multi-source reconciliation.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Dataset UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dataset confirmed and status marked as READY',
    type: ScreenshotDatasetDetailDto,
  })
  async confirmDataset(
    @Param('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') datasetId: string,
    @Body() dto: ConfirmDatasetDto,
  ): Promise<ScreenshotDatasetDetailDto> {
    return this.screenshotService.confirmDataset(orgId, userId, datasetId, dto);
  }
}

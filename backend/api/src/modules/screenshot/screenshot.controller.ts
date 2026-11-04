import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ExtractScreenshotResponseDto,
  IngestScreenshotResponseDto,
  IngestScreenshotTransactionDto,
} from './dto/screenshot.dto';
import { ScreenshotService } from './screenshot.service';

@ApiTags('Screenshot Extraction')
@Controller(['orgs/:orgId/screenshot', 'organizations/:orgId/screenshot'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class ScreenshotController {
  constructor(private readonly screenshotService: ScreenshotService) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Extract transaction metadata from uploaded receipt or payment screenshot',
    description:
      'Performs OCR and multimodal vision analysis on an uploaded screenshot image (Google Pay, Stripe, Razorpay, Bank Transfer, POS). Returns structured transaction fields including amount, currency, date, reference, and external ID.',
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

  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Ingest extracted screenshot transaction directly into ledger for reconciliation',
    description:
      'Stores the verified transaction into the organizational ledger under the chosen data source with UNMATCHED status, making it immediately available for matching in reconciliation runs.',
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
}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ScreenshotController } from './screenshot.controller';
import { ScreenshotExtractorService } from './screenshot-extractor.service';
import { ScreenshotService } from './screenshot.service';

@Module({
  imports: [OrganizationsModule, DataSourcesModule, TransactionsModule, AuditModule],
  controllers: [ScreenshotController],
  providers: [ScreenshotExtractorService, ScreenshotService],
  exports: [ScreenshotExtractorService, ScreenshotService],
})
export class ScreenshotModule {}

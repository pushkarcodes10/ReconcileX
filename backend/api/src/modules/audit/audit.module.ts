import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { DrizzleAuditRepository } from './repositories/drizzle-audit.repository';
import { AUDIT_REPOSITORY } from './repositories/audit.repository.interface';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: AUDIT_REPOSITORY,
      useClass: DrizzleAuditRepository,
    },
  ],
  exports: [AuditService, AUDIT_REPOSITORY],
})
export class AuditModule {}

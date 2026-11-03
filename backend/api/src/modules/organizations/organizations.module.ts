import { Module } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { DrizzleOrganizationsRepository } from './repositories/drizzle-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from './repositories/organizations.repository.interface';

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrgGuard,
    RolesGuard,
    {
      provide: ORGANIZATIONS_REPOSITORY,
      useClass: DrizzleOrganizationsRepository,
    },
  ],
  exports: [OrganizationsService, OrgGuard, RolesGuard, ORGANIZATIONS_REPOSITORY],
})
export class OrganizationsModule {}

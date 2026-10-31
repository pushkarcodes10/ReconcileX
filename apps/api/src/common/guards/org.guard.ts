import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@reconcilex/db';
import { Request } from 'express';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import {
  IOrganizationsRepository,
  ORGANIZATIONS_REPOSITORY,
} from '../../modules/organizations/repositories/organizations.repository.interface';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      organization?: {
        id: string;
        name: string;
        slug: string;
      };
      membership?: {
        id: string;
        role: Role;
      };
    }
  }
}

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly orgRepo: IOrganizationsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new BadRequestException('User context missing');
    }

    const paramOrgId = typeof request.params?.orgId === 'string' ? request.params.orgId : undefined;
    const rawHeader = request.headers['x-organization-id'];
    const headerOrgId =
      typeof rawHeader === 'string'
        ? rawHeader
        : Array.isArray(rawHeader)
          ? rawHeader[0]
          : undefined;
    let targetOrgId: string | undefined = paramOrgId || headerOrgId;

    // If no explicit org specified, check if user has only 1 membership
    if (!targetOrgId) {
      const userOrgs = await this.orgRepo.getUserOrganizations(user.sub);

      if (userOrgs.length === 1) {
        targetOrgId = userOrgs[0].id;
      } else {
        throw new BadRequestException(
          'Organization context required (use X-Organization-Id header or URL parameter)',
        );
      }
    }

    // Verify user belongs to this organization
    const membership = await this.orgRepo.findMembership(targetOrgId, user.sub);
    const org = await this.orgRepo.getOrgById(targetOrgId);

    if (!membership || !org || org.status !== 'ACTIVE') {
      // 404 prevents IDOR enumeration: user cannot probe whether an org ID exists
      throw new NotFoundException('Organization not found');
    }

    request.organization = {
      id: org.id,
      name: org.name,
      slug: org.slug,
    };

    request.membership = {
      id: membership.id,
      role: membership.role as Role,
    };

    return true;
  }
}

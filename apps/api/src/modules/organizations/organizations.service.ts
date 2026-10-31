import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@reconcilex/db';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  UpdateMemberRoleDto,
  UpdateOrgDto,
} from './dto/organization.dto';
import {
  IOrganizationsRepository,
  ORGANIZATIONS_REPOSITORY,
} from './repositories/organizations.repository.interface';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly orgRepo: IOrganizationsRepository,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
  ) {}

  async getUserOrganizations(userId: string) {
    return this.orgRepo.getUserOrganizations(userId);
  }

  async updateOrganization(orgId: string, dto: UpdateOrgDto) {
    if (!dto.name) {
      const org = await this.orgRepo.getOrgById(orgId);
      if (!org) throw new NotFoundException('Organization not found');
      return org;
    }
    return this.orgRepo.updateOrg(orgId, dto.name.trim());
  }

  async getMembers(orgId: string) {
    return this.orgRepo.getMembers(orgId);
  }

  async createInvitation(orgId: string, invitedById: string, dto: CreateInvitationDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const targetUser = await this.orgRepo.findUserByEmail(normalizedEmail);
    if (targetUser) {
      const existingMember = await this.orgRepo.findMembership(orgId, targetUser.id);
      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    const { plainToken, tokenHash } = this.tokenService.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.orgRepo.createInvitation(
      orgId,
      normalizedEmail,
      dto.role,
      tokenHash,
      invitedById,
      expiresAt,
    );

    this.logger.log(`Invitation created for ${normalizedEmail} to org ${orgId}`);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviteToken: plainToken,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto, currentUserId?: string) {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const invitation = await this.orgRepo.findActiveInvitation(tokenHash);
    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    let resolvedUserId = currentUserId;

    if (!resolvedUserId) {
      const existingUser = await this.orgRepo.findUserByEmail(invitation.email);

      if (existingUser) {
        resolvedUserId = existingUser.id;
      } else {
        if (!dto.name || !dto.password) {
          throw new BadRequestException(
            'Name and password are required to create a new account from invitation',
          );
        }
        const passwordHash = await this.passwordService.hash(dto.password);
        const newUser = await this.orgRepo.createUser(
          dto.name.trim(),
          invitation.email,
          passwordHash,
        );
        resolvedUserId = newUser.id;
      }
    }

    const existingMembership = await this.orgRepo.findMembership(
      invitation.organizationId,
      resolvedUserId,
    );

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    await this.orgRepo.acceptInvitation(
      invitation.id,
      invitation.organizationId,
      resolvedUserId,
      invitation.role as Role,
    );

    return {
      success: true,
      organizationId: invitation.organizationId,
      role: invitation.role,
    };
  }

  async updateMemberRole(orgId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const membership = await this.orgRepo.findMembership(orgId, targetUserId);
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    // Last-admin protection
    if (membership.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      const adminCount = await this.orgRepo.countAdmins(orgId);
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last organization administrator');
      }
    }

    return this.orgRepo.updateMemberRole(membership.id, dto.role);
  }

  async deleteMember(orgId: string, targetUserId: string) {
    const membership = await this.orgRepo.findMembership(orgId, targetUserId);
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    // Last-admin protection
    if (membership.role === Role.ADMIN) {
      const adminCount = await this.orgRepo.countAdmins(orgId);
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last organization administrator');
      }
    }

    await this.orgRepo.deleteMember(membership.id);
    return { success: true, message: 'Member removed successfully' };
  }
}

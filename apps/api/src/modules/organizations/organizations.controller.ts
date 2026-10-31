import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  UpdateMemberRoleDto,
  UpdateOrgDto,
} from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@Controller()
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Get('organizations')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all organizations the authenticated user belongs to' })
  async getMyOrganizations(@CurrentUser() user: JwtPayload) {
    return this.orgService.getUserOrganizations(user.sub);
  }

  @Patch('organizations/:orgId')
  @UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update organization settings (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async updateOrg(@Param('orgId') orgId: string, @Body() dto: UpdateOrgDto) {
    return this.orgService.updateOrganization(orgId, dto);
  }

  @Get('organizations/:orgId/members')
  @UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List organization members (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Members listed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getMembers(@Param('orgId') orgId: string) {
    return this.orgService.getMembers(orgId);
  }

  @Post('organizations/:orgId/invitations')
  @UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a new member to the organization (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Invitation created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createInvitation(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.orgService.createInvitation(orgId, user.sub, dto);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation to join an organization' })
  @ApiResponse({ status: 200, description: 'Invitation accepted and membership added' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    return this.orgService.acceptInvitation(dto, req.user?.sub);
  }

  @Patch('organizations/:orgId/members/:userId')
  @UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a member role (ADMIN only with last-admin protection)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 400, description: 'Cannot demote the last administrator' })
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.orgService.updateMemberRole(orgId, targetUserId, dto);
  }

  @Delete('organizations/:orgId/members/:userId')
  @UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove a member from organization (ADMIN only with last-admin protection)',
  })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 400, description: 'Cannot remove the last administrator' })
  async deleteMember(@Param('orgId') orgId: string, @Param('userId') targetUserId: string) {
    return this.orgService.deleteMember(orgId, targetUserId);
  }
}

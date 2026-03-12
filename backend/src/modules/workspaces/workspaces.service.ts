import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction } from '../../common/activity-enums';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceDto } from './dto/workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  private isMockMode(): boolean {
    return process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL;
  }

  private getTenantId(req: any): string {
    const tenant = req?.tenant;
    if (!tenant) throw new ForbiddenException('Tenant context missing');
    return tenant.id;
  }

  // Mock data generator
  private getMockWorkspace(id?: string): any {
    return {
      id: id || 'ws-mock-1',
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description: 'This is a mock workspace for demo purposes',
      avatarUrl: null,
      ownerId: 'user-mock-owner',
      tenantId: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  private getMockMembers(): any[] {
    return [
      { id: 'u1', email: 'alice@example.com', name: 'Alice', avatarUrl: null, role: 'creator', joinedAt: new Date() },
      { id: 'u2', email: 'bob@example.com', name: 'Bob', avatarUrl: null, role: 'admin', joinedAt: new Date() },
      { id: 'u3', email: 'charlie@example.com', name: 'Charlie', avatarUrl: null, role: 'editor', joinedAt: new Date() },
    ];
  }

  async create(createWorkspaceDto: CreateWorkspaceDto & { ownerId: string }, req?: any): Promise<WorkspaceDto> {
    const slug = this.generateSlug(createWorkspaceDto.name);
    const tenantId = req?.tenant?.id || createWorkspaceDto.tenantId; // allow explicit tenantId for migration

    // Check slug uniqueness within tenant
    const existing = await this.prisma.workspace.findFirst({
      where: { slug, tenantId },
    });
    if (existing) {
      const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
      return this.createWithSlug(createWorkspaceDto, uniqueSlug, tenantId);
    }

    return this.createWithSlug(createWorkspaceDto, slug, tenantId);
  }

  private async createWithSlug(
    dto: CreateWorkspaceDto & { ownerId: string },
    slug: string,
    tenantId: string,
  ): Promise<WorkspaceDto> {
    const workspace = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          avatarUrl: dto.avatarUrl,
          ownerId: dto.ownerId,
          tenantId,
        },
      });

      // Creator is automatically a member with 'creator' role
      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId: dto.ownerId,
          role: 'creator',
        },
      });

      return ws;
    });

    // Log activity
    await this.activityLog.log(
      workspace.id,
      dto.ownerId,
      ActivityAction.WORKSPACE_CREATED,
      'workspace',
      workspace.id,
      { name: workspace.name, slug: workspace.slug, tenantId },
    );

    return this.toDto(workspace);
  }

  async findAll(userId: string, req?: any): Promise<WorkspaceDto[]> {
    if (this.isMockMode()) {
      return [this.toDto(this.getMockWorkspace('ws-mock-1'))];
    }

    const tenantId = this.getTenantId(req);
    // Find workspaces within tenant where user is a member
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          where: { deletedAt: null, tenantId },
        },
      },
    });

    return memberships.map(m => this.toDto(m.workspace));
  }

  async findOne(id: string, userId?: string, req?: any): Promise<WorkspaceDto> {
    if (this.isMockMode()) {
      return this.toDto(this.getMockWorkspace(id));
    }

    const tenantId = this.getTenantId(req);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, tenantId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found');
    }

    // Check membership if userId provided
    if (userId) {
      const membership = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId: id, userId },
      });
      if (!membership) {
        throw new ForbiddenException('You are not a member of this workspace');
      }
    }

    return this.toDto(workspace);
  }

  async update(id: string, updateWorkspaceDto: UpdateWorkspaceDto, userId: string, req?: any): Promise<WorkspaceDto> {
    const tenantId = this.getTenantId(req);
    // Verify workspace belongs to tenant
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check membership and role
    const membership = await this.checkMembership(id, userId, ['creator', 'admin']);
    if (!membership) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // If updating slug, ensure uniqueness within tenant
    if (updateWorkspaceDto.slug) {
      const existing = await this.prisma.workspace.findFirst({
        where: { slug: updateWorkspaceDto.slug, id: { not: id }, tenantId },
      });
      if (existing) {
        throw new BadRequestException('Slug already in use');
      }
    }

    const updated = await this.prisma.workspace.update({
      where: { id },
      data: {
        name: updateWorkspaceDto.name,
        slug: updateWorkspaceDto.slug,
        description: updateWorkspaceDto.description,
        avatarUrl: updateWorkspaceDto.avatarUrl,
      },
    });

    // Log activity
    await this.activityLog.log(
      id,
      userId,
      ActivityAction.WORKSPACE_UPDATED,
      'workspace',
      id,
      {
        changes: {
          name: updateWorkspaceDto.name ? { updated: true } : undefined,
          slug: updateWorkspaceDto.slug ? { updated: true } : undefined,
          description: updateWorkspaceDto.description !== undefined ? { updated: true } : undefined,
          avatarUrl: updateWorkspaceDto.avatarUrl ? { updated: true } : undefined,
        },
      },
    );

    return this.toDto(updated);
  }

  async delete(id: string, userId: string, req?: any): Promise<void> {
    const tenantId = this.getTenantId(req);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.checkMembership(id, userId, ['creator']);
    if (!membership) {
      throw new ForbiddenException('Only the creator can delete the workspace');
    }

    await this.prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Log activity
    await this.activityLog.log(
      id,
      userId,
      ActivityAction.WORKSPACE_DELETED,
      'workspace',
      id,
      {},
    );
  }

  async inviteMember(
    workspaceId: string,
    inviteDto: InviteMemberDto,
    inviterId: string,
    req?: any,
  ): Promise<{ message: string }> {
    if (this.isMockMode()) {
      // Mock: pretend user exists and invite succeeds
      const fakeUserId = `user-${Date.now()}`;
      await this.activityLog.memberInvited('default', workspaceId, inviterId, fakeUserId, inviteDto.role || 'editor');
      return { message: 'Member invited (mock)' };
    }

    const tenantId = this.getTenantId(req);
    // Verify workspace belongs to tenant
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const investerMembership = await this.checkMembership(workspaceId, inviterId, [
      'creator',
      'admin',
      'approver',
    ]);
    if (!investerMembership) {
      throw new ForbiddenException('Insufficient permissions to invite members');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email: inviteDto.email },
    });
    if (!user) {
      // Send invitation email (placeholder)
      return { message: 'Invitation email sent (user not registered yet)' };
    }

    // Check if already a member
    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    if (existing) {
      throw new BadRequestException('User is already a member');
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: inviteDto.role || 'editor',
      },
    });

    // Log activity
    await this.activityLog.log(
      workspaceId,
      inviterId,
      ActivityAction.MEMBER_INVITED,
      'member',
      user.id,
      { role: inviteDto.role || 'editor', invitedBy: inviterId },
    );

    return { message: 'Member added successfully' };
  }

  async removeMember(workspaceId: string, userId: string, actorId: string, req?: any): Promise<void> {
    if (this.isMockMode()) {
      await this.activityLog.memberRemoved('default', workspaceId, actorId, userId);
      return;
    }

    const tenantId = this.getTenantId(req);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const actorMembership = await this.checkMembership(workspaceId, actorId, [
      'creator',
      'admin',
    ]);
    if (!actorMembership) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Cannot remove workspace owner
    if (workspace.ownerId === userId) {
      throw new BadRequestException('Cannot remove workspace owner');
    }

    await this.prisma.workspaceMember.deleteMany({
      where: { workspaceId, userId },
    });

    // Log activity
    await this.activityLog.log(
      workspaceId,
      actorId,
      ActivityAction.MEMBER_REMOVED,
      'member',
      userId,
      { removedBy: actorId },
    );
  }

  async getMembers(workspaceId: string, userId: string, req?: any) {
    if (this.isMockMode()) {
      return this.getMockMembers();
    }

    const tenantId = this.getTenantId(req);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    await this.checkMembership(workspaceId, userId, ['creator', 'admin', 'approver', 'editor']);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return members.map(m => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getWorkspaceActivity(
    workspaceId: string,
    userId: string,
    limit: number = 50,
    before?: string,
    req?: any,
  ) {
    // Mock mode: return sample activities without DB
    if (this.isMockMode()) {
      const actions = [
        'member_invited', 'content_created', 'content_published', 'social_account_connected',
        'ai_adaptation_run', 'compliance_scan_run', 'member_role_changed', 'member_removed'
      ];
      const now = new Date();
      return Array.from({ length: Math.min(limit, 50) }, (_, i) => ({
        id: `mock-${i}`,
        tenantId: 'default',
        workspaceId,
        userId: `user-${i % 5 + 1}`,
        action: actions[i % actions.length],
        resourceType: 'generic',
        resourceId: undefined,
        metadata: { mock: true },
        ipAddress: '127.0.0.1',
        userAgent: 'MockAgent/1.0',
        createdAt: new Date(now.getTime() - i * 3600000),
      }));
    }

    const tenantId = this.getTenantId(req);
    // Verify workspace belongs to tenant and user has access
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check membership (any member can view activity)
    await this.checkMembership(workspaceId, userId, ['creator', 'admin', 'approver', 'editor', 'viewer']);

    const beforeDate = before ? new Date(before) : undefined;
    return this.activityLog.findByWorkspaceBefore(workspaceId, limit, beforeDate);
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    updateMemberRoleDto: UpdateMemberRoleDto,
    actorId: string,
    req?: any,
  ): Promise<{ message: string }> {
    if (this.isMockMode()) {
      // Mock: log and return success
      await this.activityLog.log(
        'default', workspaceId, actorId, ActivityAction.MEMBER_ROLE_CHANGED, 'member', userId,
        { oldRole: 'editor', newRole: updateMemberRoleDto.role, changedBy: actorId, mock: true }
      );
      return { message: 'Member role updated (mock)' };
    }

    const tenantId = this.getTenantId(req);
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Actor must be admin or creator
    const actorMembership = await this.checkMembership(workspaceId, actorId, ['creator', 'admin']);
    if (!actorMembership) {
      throw new ForbiddenException('Insufficient permissions to update member role');
    }

    // Find the member to update
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found in workspace');
    }

    // Cannot change role of the workspace owner (creator)
    if (workspace.ownerId === userId) {
      throw new BadRequestException('Cannot change role of workspace owner');
    }

    // If actor is not creator, they cannot change a role to creator or admin (higher or equal)
    // Only creator can assign creator/admin roles
    if (actorMembership.role !== 'creator' && ['creator', 'admin'].includes(updateMemberRoleDto.role)) {
      throw new ForbiddenException('Only workspace creator can assign admin or creator roles');
    }

    // If actor is admin (not creator), they cannot promote someone to admin or demote another admin?
    // Typically admins can change roles of lower roles but not other admins or creator.
    // Let's enforce: admins can only change roles of editors/viewers, not other admins or creator.
    if (actorMembership.role === 'admin' && membership.role === 'admin') {
      throw new ForbiddenException('Admins cannot change the role of other admins');
    }

    const oldRole = membership.role;
    await this.prisma.workspaceMember.update({
      where: { id: membership.id },
      data: { role: updateMemberRoleDto.role },
    });

    // Log activity
    await this.activityLog.log(
      workspaceId,
      actorId,
      ActivityAction.MEMBER_ROLE_CHANGED,
      'member',
      userId,
      {
        oldRole,
        newRole: updateMemberRoleDto.role,
        changedBy: actorId,
      },
    );

    return { message: 'Member role updated successfully' };
  }

  private async checkMembership(
    workspaceId: string,
    userId: string,
    allowedRoles: string[],
  ): Promise<boolean> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    return membership ? allowedRoles.includes(membership.role) : false;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50);
  }

  private toDto(workspace: any): WorkspaceDto {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      avatarUrl: workspace.avatarUrl,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}

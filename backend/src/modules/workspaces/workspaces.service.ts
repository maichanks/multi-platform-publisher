import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceDto } from './dto/workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWorkspaceDto: CreateWorkspaceDto & { ownerId: string }): Promise<WorkspaceDto> {
    const slug = this.generateSlug(createWorkspaceDto.name);

    // Check slug uniqueness
    const existing = await this.prisma.workspace.findFirst({
      where: { slug },
    });
    if (existing) {
      // Append random suffix if needed
      const uniqueSlug = `${slug}-${Date.now().toString(36)}`;
      return this.createWithSlug(createWorkspaceDto, uniqueSlug);
    }

    return this.createWithSlug(createWorkspaceDto, slug);
  }

  private async createWithSlug(
    dto: CreateWorkspaceDto & { ownerId: string },
    slug: string,
  ): Promise<WorkspaceDto> {
    const workspace = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          avatarUrl: dto.avatarUrl,
          ownerId: dto.ownerId,
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

    return this.toDto(workspace);
  }

  async findAll(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          where: { deletedAt: null },
        },
      },
    });

    return memberships.map(m => this.toDto(m.workspace));
  }

  async findOne(id: string, userId?: string): Promise<WorkspaceDto> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
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

  async update(id: string, updateWorkspaceDto: UpdateWorkspaceDto, userId: string): Promise<WorkspaceDto> {
    // Check membership and role
    const membership = await this.checkMembership(id, userId, ['creator', 'admin']);
    if (!membership) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // If updating slug, ensure uniqueness
    if (updateWorkspaceDto.slug) {
      const existing = await this.prisma.workspace.findFirst({
        where: { slug: updateWorkspaceDto.slug, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestException('Slug already in use');
      }
    }

    const workspace = await this.prisma.workspace.update({
      where: { id },
      data: {
        name: updateWorkspaceDto.name,
        slug: updateWorkspaceDto.slug,
        description: updateWorkspaceDto.description,
        avatarUrl: updateWorkspaceDto.avatarUrl,
      },
    });

    return this.toDto(workspace);
  }

  async delete(id: string, userId: string): Promise<void> {
    const membership = await this.checkMembership(id, userId, ['creator']);
    if (!membership) {
      throw new ForbiddenException('Only the creator can delete the workspace');
    }

    await this.prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async inviteMember(
    workspaceId: string,
    inviteDto: InviteMemberDto,
    inviterId: string,
  ): Promise<{ message: string }> {
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
      // Send invitation email (placeholder - implement email service)
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

    return { message: 'Member added successfully' };
  }

  async removeMember(workspaceId: string, userId: string, actorId: string): Promise<void> {
    const actorMembership = await this.checkMembership(workspaceId, actorId, [
      'creator',
      'admin',
    ]);
    if (!actorMembership) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Cannot remove workspace owner
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (workspace.ownerId === userId) {
      throw new BadRequestException('Cannot remove workspace owner');
    }

    await this.prisma.workspaceMember.deleteMany({
      where: { workspaceId, userId },
    });
  }

  async getMembers(workspaceId: string, userId: string) {
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

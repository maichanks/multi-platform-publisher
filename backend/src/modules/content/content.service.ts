import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ContentDto } from './dto/content.dto';
import { PublishContentDto } from './dto/publish-content.dto';
import { ScheduleContentDto } from './dto/schedule-content.dto';
import { ContentStatsDto } from './dto/content-stats.dto';
import { PublishJobDto } from './dto/publish-job.dto';
import { SocialPlatform, ContentStatus } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivityAction } from '../../common/activity-enums';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly activityLog: ActivityLogService,
  ) {}

  private isMockMode(): boolean {
    return process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL;
  }

  private getMockContent(id?: string): any {
    return {
      id: id || `content-mock-${Date.now()}`,
      workspaceId: 'ws-mock-1',
      createdById: 'user-mock-1',
      title: 'Sample Content',
      body: 'This is a mock content body for demo purposes.',
      summary: 'Mock content summary',
      media: {},
      tags: ['demo'],
      targetPlatforms: ['twitter'],
      aiAdaptationConfig: { enabled: false },
      status: 'draft',
      scheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  private getMockStats(): any {
    return {
      totalPosts: 123,
      averageEngagement: 4.5,
      dailyData: [],
    };
  }

  private async verifyWorkspaceTenant(workspaceId: string, tenantId: string) {
    if (this.isMockMode()) return { id: workspaceId, tenantId } as any;
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!ws) throw new ForbiddenException('Workspace not found or access denied');
    return ws;
  }

  private async verifyWorkspaceTenantAndMembership(
    workspaceId: string,
    userId: string,
    tenantId?: string,
    allowedRoles?: string[],
  ) {
    // If tenantId provided, verify workspace belongs to tenant
    if (tenantId) {
      await this.verifyWorkspaceTenant(workspaceId, tenantId);
    }
    // Verify membership
    await this.verifyWorkspaceMembership(workspaceId, userId, allowedRoles);
  }

  async create(workspaceId: string, createdById: string, createDto: CreateContentDto, tenantId?: string): Promise<ContentDto> {
    if (this.isMockMode()) {
      // Mock: generate a sample content
      const mock = this.getMockContent();
      // Log activity (mock)
      await this.activityLog.contentCreated('default', workspaceId, createdById, mock.id);
      return this.toDto(mock);
    }

    await this.verifyWorkspaceTenantAndMembership(workspaceId, createdById, tenantId);
    await this.verifyWorkspaceMembership(workspaceId, createdById);

    // Get workspace tenantId for activity logging
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, tenantId: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const data = {
      workspaceId,
      createdById,
      title: createDto.title,
      body: createDto.body,
      summary: createDto.summary,
      media: createDto.media || {},
      tags: createDto.tags || [],
      targetPlatforms: createDto.targetPlatforms || [],
      aiAdaptationConfig: createDto.aiAdaptationConfig || { enabled: false },
      status: 'draft' as ContentStatus,
      scheduledAt: createDto.scheduledAt ? new Date(createDto.scheduledAt) : null,
    };

    if (data.scheduledAt && data.scheduledAt > new Date()) {
      data.status = 'scheduled' as ContentStatus;
    }

    const content = await this.prisma.content.create({
      data,
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });

    // Log activity
    await this.activityLog.log(
      workspaceId,
      createdById,
      ActivityAction.CONTENT_CREATED,
      'content',
      content.id,
      { title: createDto.title, platforms: createDto.targetPlatforms },
    );

    this.logger.log(`Content created: ${content.id} by user ${createdById} in workspace ${workspaceId}`);
    return this.toDto(content);
  }

  async findAll(
    workspaceId: string,
    userId: string,
    status?: ContentStatus,
    page: number = 1,
    limit: number = 20,
    tenantId?: string,
  ): Promise<{ items: ContentDto[]; total: number; page: number; pages: number }> {
    if (this.isMockMode()) {
      const mockItems = [this.getMockContent(), this.getMockContent()];
      return {
        items: mockItems.map(item => this.toDto(item)),
        total: 2,
        page,
        pages: 1,
      };
    }

    await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId);

    const where: any = {
      workspaceId,
      deletedAt: null,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items: items.map(this.toDto),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, workspaceId: string, userId?: string, tenantId?: string): Promise<ContentDto> {
    if (this.isMockMode()) {
      return this.toDto(this.getMockContent(id));
    }

    if (userId) {
      await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId);
    } else if (tenantId) {
      // Still verify tenant even without userId for security
      await this.verifyWorkspaceTenant(workspaceId, tenantId);
    }

    const content = await this.prisma.content.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
        aiAdaptationLogs: { orderBy: { createdAt: 'desc' }, take: 5 },
        publishJobs: {
          include: {
            socialAccount: { select: { platform: true, platformUsername: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return this.toDto(content);
  }

  async update(id: string, workspaceId: string, userId: string, updateDto: UpdateContentDto, tenantId?: string): Promise<ContentDto> {
    if (this.isMockMode()) {
      const mock = this.getMockContent(id);
      // Log activity (mock)
      await this.activityLog.contentUpdated('default', workspaceId, userId, id);
      return this.toDto(mock);
    }

    await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId, ['creator', 'admin', 'editor', 'approver']);

    const content = await this.prisma.content.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (['published', 'processing'].includes(content.status) && !['creator', 'admin'].includes(this.getUserRole(workspaceId, userId))) {
      throw new BadRequestException(`Cannot update content in status: ${content.status}`);
    }

    // Track changes for activity log
    const changes: any = {};
    if (updateDto.title !== undefined) changes.title = { from: content.title, to: updateDto.title };
    if (updateDto.body !== undefined) changes.body = { changed: true };
    if (updateDto.status !== undefined) changes.status = { from: content.status, to: updateDto.status };
    if (updateDto.scheduledAt !== undefined) changes.scheduledAt = { from: content.scheduledAt, to: updateDto.scheduledAt };

    const updateData: any = {
      ...(updateDto.title !== undefined && { title: updateDto.title }),
      ...(updateDto.body !== undefined && { body: updateDto.body }),
      ...(updateDto.summary !== undefined && { summary: updateDto.summary }),
      ...(updateDto.media !== undefined && { media: updateDto.media }),
      ...(updateDto.tags !== undefined && { tags: updateDto.tags }),
      ...(updateDto.targetPlatforms !== undefined && { targetPlatforms: updateDto.targetPlatforms }),
      ...(updateDto.aiAdaptationConfig !== undefined && { aiAdaptationConfig: updateDto.aiAdaptationConfig }),
      ...(updateDto.scheduledAt !== undefined && {
        scheduledAt: updateDto.scheduledAt ? new Date(updateDto.scheduledAt) : null,
      }),
      updatedAt: new Date(),
    };

    if (updateDto.scheduledAt !== undefined) {
      const scheduledAt = updateDto.scheduledAt ? new Date(updateDto.scheduledAt) : null;
      if (scheduledAt && scheduledAt > new Date()) {
        updateData.status = 'scheduled' as ContentStatus;
      } else if (!scheduledAt && content.status === 'scheduled') {
        updateData.status = 'draft' as ContentStatus;
      }
    }

    const updated = await this.prisma.content.update({
      where: { id },
      data: updateData,
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });

    this.logger.log(`Content updated: ${id} by user ${userId}`);

    // Log activity
    await this.activityLog.log(
      workspaceId,
      userId,
      ActivityAction.CONTENT_UPDATED,
      'content',
      id,
      { changes, newStatus: updated.status },
    );

    return this.toDto(updated);
  }

  async delete(id: string, workspaceId: string, userId: string, tenantId?: string): Promise<void> {
    if (this.isMockMode()) {
      await this.activityLog.contentDeleted('default', workspaceId, userId, id);
      return;
    }

    await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId, ['creator', 'admin']);

    const content = await this.prisma.content.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (content.status === 'published') {
      throw new BadRequestException('Cannot delete published content');
    }

    await this.prisma.content.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Content deleted: ${id} by user ${userId}`);

    // Log activity
    await this.activityLog.log(
      workspaceId,
      userId,
      ActivityAction.CONTENT_DELETED,
      'content',
      id,
      { title: content.title },
    );
  }

  async publish(
    id: string, 
    workspaceId: string, 
    userId: string, 
    publishDto?: PublishContentDto, 
    tenantId?: string
  ): Promise<ContentDto> {
    await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId, ['creator', 'admin', 'approver']);

    const content = await this.prisma.content.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (content.status === 'deleted') {
      throw new BadRequestException('Cannot publish deleted content');
    }

    const platforms = publishDto?.platforms?.length ? publishDto.platforms : content.targetPlatforms;

    if (!platforms || platforms.length === 0) {
      throw new BadRequestException('No target platforms specified');
    }

    const socialAccounts = await this.prisma.socialAccount.findMany({
      where: {
        workspaceId,
        platform: { in: platforms },
        status: 'connected',
      },
    });

    if (socialAccounts.length === 0) {
      throw new BadRequestException('No connected social accounts for the specified platforms');
    }

    await this.prisma.content.update({
      where: { id },
      data: { status: 'processing' as ContentStatus },
    });

    const publishJobs = await Promise.all(
      socialAccounts.map(account =>
        this.prisma.publishJob.create({
          data: {
            contentId: id,
            socialAccountId: account.id,
            platform: account.platform,
            status: 'pending' as const,
            priority: 0,
          },
        })
      )
    );

    this.logger.log(`Publish jobs created for content ${id}: ${publishJobs.length} jobs`);

    // Log activity
    await this.activityLog.log(
      workspaceId,
      userId,
      ActivityAction.CONTENT_PUBLISHED,
      'content',
      id,
      { platforms, jobCount: publishJobs.length },
    );

    return this.findOne(id, workspaceId, undefined);
  }

  async schedule(id: string, workspaceId: string, userId: string, scheduleDto: ScheduleContentDto): Promise<ContentDto> {
    await this.verifyWorkspaceMembership(workspaceId, userId);

    const scheduledAt = new Date(scheduleDto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const platforms = scheduleDto.platforms || [];

    return this.update(id, workspaceId, userId, {
      scheduledAt: scheduleDto.scheduledAt,
      ...(platforms.length && { targetPlatforms: platforms }),
    });
  }

  async cancel(id: string, workspaceId: string, userId: string, tenantId?: string): Promise<ContentDto> {
    await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId, ['creator', 'admin', 'editor']);

    const content = await this.prisma.content.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (['published', 'processing', 'cancelled'].includes(content.status)) {
      throw new BadRequestException(`Cannot cancel content in status: ${content.status}`);
    }

    const cancelled = await this.prisma.content.update({
      where: { id },
      data: { status: 'cancelled' as ContentStatus, updatedAt: new Date() },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });

    this.logger.log(`Content cancelled: ${id} by user ${userId}`);

    // Log activity
    await this.activityLog.log(
      workspaceId,
      userId,
      ActivityAction.CONTENT_CANCELLED,
      'content',
      id,
      { previousStatus: content.status },
    );

    return this.toDto(cancelled);
  }

  async getStats(workspaceId: string, userId: string, tenantId?: string): Promise<ContentStatsDto> {
    await this.verifyWorkspaceTenantAndMembership(workspaceId, userId, tenantId);

    const counts = await this.prisma.content.groupBy({
      by: ['status'],
      where: {
        workspaceId,
        deletedAt: null,
      },
      _count: { status: true },
    });

    const stats: any = {
      total: 0,
      draft: 0,
      scheduled: 0,
      processing: 0,
      published: 0,
      failed: 0,
      cancelled: 0,
    };

    counts.forEach(group => {
      stats[group.status] = group._count.status;
      stats.total += group._count.status;
    });

    return stats as ContentStatsDto;
  }

  private async verifyWorkspaceMembership(
    workspaceId: string,
    userId: string,
    allowedRoles?: string[],
  ): Promise<boolean> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`);
    }

    return true;
  }

  private getUserRole(workspaceId: string, userId: string): string | undefined {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });
    return membership?.role;
  }

  private toDto(content: any): ContentDto {
    return {
      id: content.id,
      workspaceId: content.workspaceId,
      createdById: content.createdById,
      title: content.title,
      body: content.body,
      summary: content.summary,
      media: content.media || {},
      tags: content.tags || [],
      status: content.status,
      errorMessage: content.errorMessage,
      scheduledAt: content.scheduledAt,
      targetPlatforms: content.targetPlatforms || [],
      aiAdaptationConfig: content.aiAdaptationConfig,
      adaptationResults: content.adaptationResults,
      publishResults: content.publishResults,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      publishedAt: content.publishedAt,
      deletedAt: content.deletedAt,
      workspace: content.workspace,
      createdBy: content.createdBy,
    };
  }
}

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

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async create(workspaceId: string, createdById: string, createDto: CreateContentDto): Promise<ContentDto> {
    await this.verifyWorkspaceMembership(workspaceId, createdById);

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

    this.logger.log(`Content created: ${content.id} by user ${createdById} in workspace ${workspaceId}`);
    return this.toDto(content);
  }

  async findAll(
    workspaceId: string,
    userId: string,
    status?: ContentStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: ContentDto[]; total: number; page: number; pages: number }> {
    await this.verifyWorkspaceMembership(workspaceId, userId);

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

  async findOne(id: string, workspaceId: string, userId?: string): Promise<ContentDto> {
    if (userId) {
      await this.verifyWorkspaceMembership(workspaceId, userId);
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

  async update(id: string, workspaceId: string, userId: string, updateDto: UpdateContentDto): Promise<ContentDto> {
    await this.verifyWorkspaceMembership(workspaceId, userId, ['creator', 'admin', 'editor', 'approver']);

    const content = await this.prisma.content.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    if (['published', 'processing'].includes(content.status) && !['creator', 'admin'].includes(this.getUserRole(workspaceId, userId))) {
      throw new BadRequestException(`Cannot update content in status: ${content.status}`);
    }

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
    return this.toDto(updated);
  }

  async delete(id: string, workspaceId: string, userId: string): Promise<void> {
    await this.verifyWorkspaceMembership(workspaceId, userId, ['creator', 'admin']);

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
  }

  async publish(id: string, workspaceId: string, userId: string, publishDto?: PublishContentDto): Promise<ContentDto> {
    await this.verifyWorkspaceMembership(workspaceId, userId, ['creator', 'admin', 'approver']);

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

  async cancel(id: string, workspaceId: string, userId: string): Promise<ContentDto> {
    await this.verifyWorkspaceMembership(workspaceId, userId, ['creator', 'admin', 'editor']);

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
    return this.toDto(cancelled);
  }

  async getStats(workspaceId: string, userId: string): Promise<ContentStatsDto> {
    await this.verifyWorkspaceMembership(workspaceId, userId);

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

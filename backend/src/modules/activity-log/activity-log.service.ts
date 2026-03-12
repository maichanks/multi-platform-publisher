import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityAction } from '../activity-log/activity-log.module';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    workspaceId: string,
    userId: string,
    action: ActivityAction,
    resourceType: string,
    resourceId?: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Get workspace to retrieve tenantId
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { tenantId: true },
    });

    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    return this.prisma.activityLog.create({
      data: {
        tenantId: workspace.tenantId,
        workspaceId,
        userId,
        action,
        resourceType,
        resourceId,
        metadata,
        ipAddress,
        userAgent,
      },
    });
  }

  async findByWorkspace(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0,
    action?: ActivityAction,
  ) {
    const where: any = { workspaceId };
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }

  async findByWorkspaceBefore(
    workspaceId: string,
    limit: number = 50,
    before?: Date,
  ) {
    const where: any = { workspaceId };
    if (before) {
      where.createdAt = { lt: before };
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { logs, total, limit };
  }

  async findByTenant(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { tenantId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          workspace: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityLog.count({ where: { tenantId } }),
    ]);

    return { logs, total, limit, offset };
  }
}

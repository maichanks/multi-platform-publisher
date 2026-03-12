import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tenantId: string,
    workspaceId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // In mock mode, skip DB writes
    if (process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL) {
      return { id: 'mock-' + Date.now(), tenantId, workspaceId, userId, action, resourceType, resourceId, metadata, ipAddress, userAgent, createdAt: new Date() };
    }

    return this.prisma.activityLog.create({
      data: {
        tenantId,
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

  async findByWorkspaceBefore(workspaceId: string, limit: number = 50, before?: Date) {
    // Mock mode: return sample activities
    if (process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL) {
      const actions = [
        'member_invited', 'content_created', 'content_published', 'social_account_connected',
        'ai_adaptation_run', 'compliance_scan_run', 'member_role_changed'
      ];
      const now = new Date();
      return Array.from({ length: limit }, (_, i) => ({
        id: `mock-${i}`,
        tenantId: 'default',
        workspaceId,
        userId: `user-${i % 5 + 1}`,
        action: actions[i % actions.length],
        resourceType: 'generic',
        resourceId: undefined,
        metadata: { mock: true },
        createdAt: new Date(now.getTime() - i * 3600000), // each hour apart
      }));
    }

    const where: any = { workspaceId };
    if (before) {
      where.createdAt = { lt: before };
    }

    return this.prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Convenience methods
  async memberInvited(tenantId: string, workspaceId: string, inviterId: string, invitedUserId: string, role: string) {
    return this.log(tenantId, workspaceId, inviterId, 'member_invited', 'workspace_member', invitedUserId, { role });
  }

  async memberRemoved(tenantId: string, workspaceId: string, actorId: string, targetUserId: string) {
    return this.log(tenantId, workspaceId, actorId, 'member_removed', 'workspace_member', targetUserId);
  }

  async roleChanged(tenantId: string, workspaceId: string, actorId: string, targetUserId: string, newRole: string) {
    return this.log(tenantId, workspaceId, actorId, 'member_role_changed', 'workspace_member', targetUserId, { newRole });
  }

  async contentCreated(tenantId: string, workspaceId: string, userId: string, contentId: string) {
    return this.log(tenantId, workspaceId, userId, 'content_created', 'content', contentId);
  }

  async contentPublished(tenantId: string, workspaceId: string, userId: string, contentId: string, platform: string) {
    return this.log(tenantId, workspaceId, userId, 'content_published', 'content', contentId, { platform });
  }

  async contentDeleted(tenantId: string, workspaceId: string, userId: string, contentId: string) {
    return this.log(tenantId, workspaceId, userId, 'content_deleted', 'content', contentId);
  }

  async socialAccountConnected(tenantId: string, workspaceId: string, userId: string, platform: string) {
    return this.log(tenantId, workspaceId, userId, 'social_account_connected', 'social_account', undefined, { platform });
  }

  async socialAccountDisconnected(tenantId: string, workspaceId: string, userId: string, platform: string) {
    return this.log(tenantId, workspaceId, userId, 'social_account_disconnected', 'social_account', undefined, { platform });
  }

  async aiAdaptationRun(tenantId: string, workspaceId: string, userId: string, contentId: string, modelUsed: string) {
    return this.log(tenantId, workspaceId, userId, 'ai_adaptation_run', 'ai_adaptation', contentId, { modelUsed });
  }

  async complianceScanRun(tenantId: string, workspaceId: string, userId: string, contentId: string, scanType: string) {
    return this.log(tenantId, workspaceId, userId, 'compliance_scan_run', 'compliance_scan', contentId, { scanType });
  }

  async complianceOverride(tenantId: string, workspaceId: string, userId: string, complianceLogId: string, reason: string) {
    return this.log(tenantId, workspaceId, userId, 'compliance_override', 'compliance_log', complianceLogId, { reason });
  }

  async exportDataRequested(tenantId: string, workspaceId: string, userId: string, format: string) {
    return this.log(tenantId, workspaceId, userId, 'export_data_requested', 'export', undefined, { format });
  }

  async dataDeletionRequested(tenantId: string, workspaceId: string, userId: string, resourceType: string, resourceId: string) {
    return this.log(tenantId, workspaceId, userId, 'data_deletion_requested', resourceType, resourceId);
  }
}

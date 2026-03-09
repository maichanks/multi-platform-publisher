import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getDailyMetrics(
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    platform?: string,
  ) {
    const where: any = {
      workspaceId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      ...(platform && { platform }),
    };

    const daily = await this.prisma.analyticsDaily.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return daily;
  }

  async getSummary(workspaceId: string, userId: string, periodDays: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const daily = await this.getDailyMetrics(workspaceId, userId, startDate, new Date());

    // Aggregate statistics
    const totalPosts = daily.reduce((sum, d) => sum + d.postsCount, 0);
    const avgEngagement = daily.length > 0
      ? daily.reduce((sum, d) => sum + (d.engagement?.total || 0), 0) / daily.length
      : 0;

    return {
      period: `${periodDays} days`,
      totalPosts,
      averageEngagement: Math.round(avgEngagement * 100) / 100,
      dailyData: daily,
    };
  }

  async getTopContent(
    workspaceId: string,
    userId: string,
    limit: number = 10,
    metric: 'engagement' | 'views' | 'shares' = 'engagement',
  ) {
    // This would join Content with AnalyticsEvent to rank top performing content
    // For now, return placeholder
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit * 10, // Get more to aggregate
    });

    // Group by contentId and aggregate metrics
    const contentStats = new Map();
    for (const event of events) {
      const contentId = event.contentId;
      if (!contentId) continue;

      if (!contentStats.has(contentId)) {
        contentStats.set(contentId, {
          contentId,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
        });
      }
      const stats = contentStats.get(contentId);
      if (event.eventType === 'view') stats.views++;
      if (event.eventType === 'like') stats.likes++;
      if (event.eventType === 'comment') stats.comments++;
      if (event.eventType === 'share') stats.shares++;
      if (event.eventType === 'click') stats.clicks++;
    }

    // Sort by requested metric
    const sorted = Array.from(contentStats.values()).sort((a, b) => b[metric] - a[metric]);
    return sorted.slice(0, limit);
  }

  async trackEvent(
    workspaceId: string,
    contentId: string,
    platform: string,
    eventType: string,
    eventData: any,
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const event = await this.prisma.analyticsEvent.create({
      data: {
        workspaceId,
        contentId,
        platform,
        eventType,
        eventData,
        userId,
        sessionId,
        ipAddress,
        userAgent,
        occurredAt: new Date(),
      },
    });

    return event;
  }
}
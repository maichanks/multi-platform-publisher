import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { Response } from 'express';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  private isMockMode(): boolean {
    return process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL;
  }

  private getMockDailyMetrics(startDate: Date, endDate: Date, platform?: string) {
    const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const result = [];
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      result.push({
        id: `mock-${i}`,
        workspaceId: 'ws-mock-1',
        date,
        platform: platform || 'twitter',
        postsCount: Math.floor(Math.random() * 10) + 1,
        impressions: Math.floor(Math.random() * 1000) + 100,
        engagement: { total: Math.floor(Math.random() * 100) + 10, likes: 0, comments: 0, shares: 0 },
      });
    }
    return result;
  }

  private async verifyWorkspaceTenant(workspaceId: string, tenantId: string) {
    if (this.isMockMode()) return { id: workspaceId, tenantId } as any;
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });
    if (!ws) throw new Error('Workspace not found or access denied');
    return ws;
  }

  // ==================== 现有方法（增强租户检查）====================

  async getDailyMetrics(
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    platform?: string,
    tenantId?: string,
  ) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

    if (this.isMockMode()) {
      return this.getMockDailyMetrics(startDate, endDate, platform);
    }

    const where: any = {
      workspaceId,
      date: { gte: startDate, lte: endDate },
      ...(platform && { platform }),
    };

    const daily = await this.prisma.analyticsDaily.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return daily;
  }

  async getSummary(workspaceId: string, userId: string, periodDays: number = 30, tenantId?: string) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const daily = await this.getDailyMetrics(workspaceId, userId, startDate, new Date(), undefined, tenantId);

    const totalPosts = daily.reduce((sum, d) => sum + d.postsCount, 0);
    const totalEngagement = daily.reduce((sum, d) => sum + (d.engagement?.total || 0), 0);
    const avgEngagement = daily.length > 0 ? totalEngagement / daily.length : 0;

    return {
      period: `${periodDays} days`,
      totalPosts,
      averageEngagement: Math.round(avgEngagement * 100) / 100,
      dailyData: daily,
    };
  }

  // ==================== 新增：参与率分析 ====================

  /**
   * Calculate daily engagement rates (total engagements / views * 100)
   * Engagement includes: likes + comments + shares + clicks
   * Returns sorted list with detailed breakdown
   */
  async getEngagementRates(
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

    if (this.isMockMode()) {
      // Mock: generate synthetic daily records
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const result = [];
      for (let i = 0; i < Math.min(days, 30); i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const views = Math.floor(Math.random() * 1000) + 100;
        const likes = Math.floor(views * 0.05);
        const comments = Math.floor(views * 0.01);
        const shares = Math.floor(views * 0.005);
        const clicks = Math.floor(views * 0.02);
        const totalEng = likes + comments + shares + clicks;
        result.push({
          date,
          platform: 'twitter',
          postsCount: Math.floor(Math.random() * 5) + 1,
          metrics: { views, likes, comments, shares, clicks, totalEngagement: totalEng },
          engagementRate: Math.round((totalEng / views) * 100) / 100,
        });
      }
      return result;
    }

    const daily = await this.prisma.analyticsDaily.findMany({
      where: { workspaceId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'desc' },
    });

    const result = daily.map(d => {
      const engagement = d.engagement as any;
      const views = engagement?.views || 0;
      const likes = engagement?.likes || 0;
      const comments = engagement?.comments || 0;
      const shares = engagement?.shares || 0;
      const clicks = engagement?.clicks || 0;
      const totalEngagement = likes + comments + shares + clicks;
      const rate = views > 0 ? (totalEngagement / views) * 100 : 0;
      
      return {
        date: d.date,
        platform: d.platform,
        postsCount: d.postsCount,
        metrics: {
          views,
          likes,
          comments,
          shares,
          clicks,
          totalEngagement,
        },
        engagementRate: Math.round(rate * 100) / 100,
      };
    });

    // Calculate overall average
    const totalViews = result.reduce((sum, r) => sum + r.metrics.views, 0);
    const totalEngagement = result.reduce((sum, r) => sum + r.metrics.totalEngagement, 0);
    const avgRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    return {
      summary: {
        period: { startDate, endDate },
        totalViews,
        totalEngagement,
        averageEngagementRate: Math.round(avgRate * 100) / 100,
        dataPoints: result.length,
      },
      dailyRates: result,
    };
  }

  // ==================== 新增：平台性能对比 ====================

  /**
   * 跨平台性能对比，按平台聚合最近 N 天的指标
   */
  async getPlatformComparison(
    workspaceId: string,
    userId: string,
    periodDays: number = 30,
    tenantId?: string,
  ) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

    if (this.isMockMode()) {
      // Mock: generate a few platform stats
      const platforms = ['twitter', 'linkedin', 'reddit', 'xiaohongshu'];
      return platforms.map(p => ({
        platform: p,
        totalPosts: Math.floor(Math.random() * 50) + 10,
        totalImpressions: Math.floor(Math.random() * 10000) + 1000,
        totalEngagement: Math.floor(Math.random() * 500) + 50,
        days: Math.floor(Math.random() * 10) + 5,
        averageImpressions: Math.floor(Math.random() * 1000) + 100,
        averageEngagement: Math.round(Math.random() * 100) / 100,
        engagementRate: Math.round(Math.random() * 500) / 100, // 0-5% with 2 decimals
      }));
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const daily = await this.prisma.analyticsDaily.findMany({
      where: { workspaceId, date: { gte: startDate, lte: new Date() } },
    });

    // Group by platform
    const platformStats: Record<string, any> = {};

    for (const d of daily) {
      const p = d.platform || 'unknown';
      if (!platformStats[p]) {
        platformStats[p] = {
          platform: p,
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalClicks: 0,
          days: 0,
        };
      }
      const stats = platformStats[p];
      const engagement = d.engagement as any;
      stats.totalPosts += d.postsCount;
      stats.totalViews += engagement?.views || 0;
      stats.totalLikes += engagement?.likes || 0;
      stats.totalComments += engagement?.comments || 0;
      stats.totalShares += engagement?.shares || 0;
      stats.totalClicks += engagement?.clicks || 0;
      stats.days += 1;
    }

    // Calculate averages and engagement rates
    const comparison = Object.values(platformStats).map((stats: any) => {
      const totalEngagement = stats.totalLikes + stats.totalComments + stats.totalShares + stats.totalClicks;
      const avgViewsPerPost = stats.totalPosts > 0 ? stats.totalViews / stats.totalPosts : 0;
      const avgEngagementPerPost = stats.totalPosts > 0 ? totalEngagement / stats.totalPosts : 0;
      const engagementRate = stats.totalViews > 0 ? (totalEngagement / stats.totalViews) * 100 : 0;
      
      return {
        platform: stats.platform,
        metrics: {
          totalPosts: stats.totalPosts,
          totalViews: Math.round(stats.totalViews),
          avgViewsPerPost: Math.round(avgViewsPerPost * 100) / 100,
          avgEngagementPerPost: Math.round(avgEngagementPerPost * 100) / 100,
          engagementRate: Math.round(engagementRate * 100) / 100,
          breakdown: {
            likes: stats.totalLikes,
            comments: stats.totalComments,
            shares: stats.totalShares,
            clicks: stats.totalClicks,
            totalEngagement,
          },
        },
        periodDays: stats.days,
      };
    });

    // Rank by engagement rate
    comparison.sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate);

    return {
      period: { days: periodDays },
      platforms: comparison,
      summary: {
        totalPlatforms: comparison.length,
        topPlatform: comparison[0]?.platform || null,
        topEngagementRate: comparison[0]?.metrics.engagementRate || 0,
      },
    };
  }

  // ==================== 新增：趋势分析（移动平均）====================

  /**
   * 计算 7 天和 30 天移动平均参与率
   */
  async getTrendAnalysis(
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

    const daily = await this.prisma.analyticsDaily.findMany({
      where: { workspaceId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    const MovingAverage = (data: number[], window: number) => {
      const result = [];
      for (let i = 0; i < data.length; i++) {
        if (i < window - 1) {
          result.push(null);
        } else {
          const slice = data.slice(i - window + 1, i + 1);
          const avg = slice.reduce((a, b) => a + b, 0) / window;
          result.push(Math.round(avg * 100) / 100);
        }
      }
      return result;
    };

    const dates = daily.map(d => d.date.toISOString().split('T')[0]);
    const engagementRates = daily.map(d => {
      const imp = d.impressions || 0;
      const eng = d.engagement?.total || 0;
      return imp > 0 ? eng / imp : 0;
    });

    const ma7 = MovingAverage(engagementRates, 7);
    const ma30 = MovingAverage(engagementRates, 30);

    return dates.map((date, idx) => ({
      date,
      engagementRate: Math.round(engagementRates[idx] * 10000) / 100,
      ma7: ma7[idx] !== null ? Math.round(ma7[idx] * 10000) / 100 : null,
      ma30: ma30[idx] !== null ? Math.round(ma30[idx] * 10000) / 100 : null,
    }));
  }

  // ==================== 新增：CSV 导出 ====================

  /**
   * 导出指标为 CSV 格式到 HTTP 响应
   */
  async exportToCsv(
    workspaceId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    res: Response,
    filename?: string,
    tenantId?: string,
  ) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

    const daily = await this.getDailyMetrics(workspaceId, userId, startDate, endDate, undefined, tenantId);

    if (daily.length === 0) {
      throw new Error('No data available for export');
    }

    // Build CSV headers
    const headers = [
      'Date',
      'Platform',
      'Posts',
      'Impressions',
      'Views',
      'Likes',
      'Comments',
      'Shares',
      'Clicks',
      'Total Engagement',
      'Engagement Rate (%)',
    ];

    // Build CSV rows
    const rows = daily.map(metric => {
      const engagement = metric.engagement as any;
      const views = engagement?.views || 0;
      const likes = engagement?.likes || 0;
      const comments = engagement?.comments || 0;
      const shares = engagement?.shares || 0;
      const clicks = engagement?.clicks || 0;
      const totalEngagement = likes + comments + shares + clicks;
      const engagementRate = views > 0 ? ((totalEngagement / views) * 100).toFixed(2) : '0';

      return [
        metric.date.toISOString().split('T')[0],
        metric.platform || 'ALL',
        metric.postsCount.toString(),
        (metric.impressions || 0).toString(),
        views.toString(),
        likes.toString(),
        comments.toString(),
        shares.toString(),
        clicks.toString(),
        totalEngagement.toString(),
        engagementRate,
      ];
    });

    // Build CSV content with proper escaping
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    // Set response headers
    const exportFilename = filename || `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
    res.send(csvContent);
  }

  // ==================== 现有事件追踪（不变）====================

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
    tenantId?: string,
  ) {
    if (tenantId) await this.verifyWorkspaceTenant(workspaceId, tenantId);

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

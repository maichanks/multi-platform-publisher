import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('daily')
  @PermissionChecker('ANALYTICS_READ')
  async getDailyMetrics(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('platform') platform?: string,
    @Req() req: any,
  ) {
    const metrics = await this.analyticsService.getDailyMetrics(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      new Date(startDate),
      new Date(endDate),
      platform,
    );

    return { success: true, data: metrics };
  }

  @Get('summary')
  @PermissionChecker('ANALYTICS_READ')
  async getSummary(
    @Query('workspaceId') workspaceId: string,
    @Query('days') days?: number,
    @Req() req: any,
  ) {
    const summary = await this.analyticsService.getSummary(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      days || 30,
    );

    return { success: true, data: summary };
  }

  @Get('top-content')
  @PermissionChecker('ANALYTICS_READ')
  async getTopContent(
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit?: number,
    @Query('metric') metric?: 'engagement' | 'views' | 'shares',
    @Req() req: any,
  ) {
    const top = await this.analyticsService.getTopContent(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      limit || 10,
      metric || 'engagement',
    );

    return { success: true, data: top };
  }

  @Post('track')
  @PermissionChecker('ANALYTICS_READ')
  async trackEvent(
    @Req() req: any,
    @Body() eventData: {
      contentId: string;
      platform: string;
      eventType: string;
      eventData?: any;
      userId?: string;
      sessionId?: string;
    },
  ) {
    const event = await this.analyticsService.trackEvent(
      req.user.defaultWorkspaceId,
      eventData.contentId,
      eventData.platform,
      eventData.eventType,
      eventData.eventData || {},
      eventData.userId,
      eventData.sessionId,
      req.ip,
      req.headers['user-agent'],
    );

    return { success: true, data: event };
  }

  @Get('export')
  @PermissionChecker('ANALYTICS_EXPORT')
  async exportData(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any,
  ) {
    const daily = await this.analyticsService.getDailyMetrics(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      new Date(startDate),
      new Date(endDate),
    );

    // Return CSV format
    const csvHeaders = ['Date', 'Platform', 'Posts', 'Engagement'];
    const csvRows = daily.map(d => [
      d.date.toISOString().split('T')[0],
      d.platform || 'all',
      d.postsCount,
      JSON.stringify(d.engagement),
    ]);

    const csv = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');

    return {
      success: true,
      data: csv,
      filename: `analytics-${workspaceId}-${startDate}-to-${endDate}.csv`,
    };
  }
}
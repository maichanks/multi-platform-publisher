import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  Param,
  Post,
  Body,
  Header,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private getTenantId(req: any): string {
    return req.tenant?.id;
  }

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
      this.getTenantId(req),
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
      this.getTenantId(req),
    );

    return { success: true, data: summary };
  }

  @Get('engagement-rates')
  @PermissionChecker('ANALYTICS_READ')
  async getEngagementRates(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any,
  ) {
    const rates = await this.analyticsService.getEngagementRates(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      new Date(startDate),
      new Date(endDate),
      this.getTenantId(req),
    );

    return { success: true, data: rates };
  }

  @Get('platform-comparison')
  @PermissionChecker('ANALYTICS_READ')
  async getPlatformComparison(
    @Query('workspaceId') workspaceId: string,
    @Query('days') days?: number,
    @Req() req: any,
  ) {
    const comparison = await this.analyticsService.getPlatformComparison(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      days || 30,
      this.getTenantId(req),
    );

    return { success: true, data: comparison };
  }

  @Get('trends')
  @PermissionChecker('ANALYTICS_READ')
  async getTrendAnalysis(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any,
  ) {
    const trends = await this.analyticsService.getTrendAnalysis(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      new Date(startDate),
      new Date(endDate),
      this.getTenantId(req),
    );

    return { success: true, data: trends };
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
      this.getTenantId(req),
    );

    return { success: true, data: event };
  }

  @Get('export')
  @PermissionChecker('ANALYTICS_EXPORT')
  @Header('Content-Type', 'text/csv')
  async exportCSV(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any,
  ) {
    const csv = await this.analyticsService.exportToCSV(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      new Date(startDate),
      new Date(endDate),
      this.getTenantId(req),
    );

    return csv; // raw CSV string, will be sent as response body
  }
}

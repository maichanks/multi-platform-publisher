import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('workspace/:workspaceId')
  @PermissionChecker('ACTIVITY_LOG_READ')
  @ApiOperation({ summary: 'Get activity logs for a workspace' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  async getWorkspaceLogs(
    @Req() req: any,
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('action') action?: string,
  ) {
    const tenantId = req.tenant.id;
    // Verify workspace belongs to tenant
    await this.activityLogService['prisma'].workspace.findFirst({
      where: { id: workspaceId, tenantId },
    });

    return this.activityLogService.findByWorkspace(workspaceId, limit, offset, action);
  }

  @Get('tenant/:tenantId')
  @PermissionChecker('TENANT_ADMIN')
  @ApiOperation({ summary: 'Get activity logs for a tenant (admin only)' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  async getTenantLogs(
    @Req() req: any,
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    // Verify requesting user is admin of the tenant
    const userTenantId = req.tenant.id;
    if (userTenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    return this.activityLogService.findByTenant(tenantId, limit, offset);
  }
}

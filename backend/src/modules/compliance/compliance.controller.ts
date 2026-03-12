import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@Controller('compliance')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('scan')
  @PermissionChecker('COMPLIANCE_SCAN')
  async triggerScan(
    @Body() scanRequest: {
      contentId: string;
      workspaceId?: string;
      scanType?: 'sensitive' | 'copyright' | 'brand_safety' | 'regulatory';
    },
    @Req() req: any,
  ) {
    const scan = await this.complianceService.scanContent(
      scanRequest.workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
      scanRequest.contentId,
      scanRequest.scanType || 'sensitive',
    );

    return { success: true, data: scan };
  }

  @Get('content/:contentId')
  @PermissionChecker('COMPLIANCE_SCAN')
  async getScansForContent(
    @Param('contentId') contentId: string,
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const scans = await this.complianceService.getScanResults(
      workspaceId || req.user.defaultWorkspaceId,
      contentId,
      req.user.id,
    );

    return { success: true, data: scans };
  }

  @Get('scan/:scanId')
  @PermissionChecker('COMPLIANCE_SCAN')
  async getScan(
    @Param('scanId') scanId: string,
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const scan = await this.complianceService.getScanById(
      workspaceId || req.user.defaultWorkspaceId,
      scanId,
      req.user.id,
    );

    return { success: true, data: scan };
  }

  @Post('scan/:scanId/override')
  @PermissionChecker('COMPLIANCE_OVERRIDE')
  async overrideScan(
    @Param('scanId') scanId: string,
    @Body() overrideData: { reason: string },
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const scan = await this.complianceService.overrideScan(
      workspaceId || req.user.defaultWorkspaceId,
      scanId,
      req.user.id,
      overrideData.reason,
    );

    return { success: true, data: scan };
  }
}
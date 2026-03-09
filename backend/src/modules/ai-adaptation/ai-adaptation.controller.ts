import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiBearerAuth, ApiTags, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AIAdaptationService } from './services/ai-adaptation.service';
import { CreateAdaptationJobDto } from './dto/create-adaptation-job.dto';
import { AdaptationLogDto } from './dto/adaptation-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@ApiTags('AI Adaptation')
@ApiBearerAuth()
@Controller('ai-adaptation')
@UseGuards(JwtAuthGuard)
export class AIAdaptationController {
  constructor(private readonly aiAdaptationService: AIAdaptationService) {}

  @Post('preview')
  @PermissionChecker('CONTENT_READ')
  @ApiOperation({ summary: 'Preview AI content adaptation for specified platforms' })
  @ApiBody({ type: CreateAdaptationJobDto })
  @ApiResponse({ status: 200, description: 'Adaptation preview generated', type: Object })
  async previewAdaptation(@Body() dto: CreateAdaptationJobDto, @Req() req: any) {
    const workspaceId = dto.workspaceId || req.body.workspaceId || req.query.workspaceId || req.user.defaultWorkspaceId;

    // If platforms not specified, get from content
    const platforms = dto.platforms || ['twitter', 'linkedin', 'reddit', 'xiaohongshu'];

    const results = await Promise.allSettled(
      platforms.map(platform =>
        this.aiAdaptationService.adaptContent(dto.contentId, platform, workspaceId)
          .then(log => ({ platform, success: true, data: log }))
          .catch(error => ({ platform, success: false, error: error.message }))
      )
    );

    const adaptations = results.map((result, index) => {
      const platform = platforms[index];
      if (result.status === 'fulfilled') {
        return {
          platform,
          adaptedText: result.value.adaptedText,
          modelUsed: result.value.modelUsed,
          tokensTotal: result.value.tokensTotal,
          costCents: result.value.costCents,
        };
      } else {
        return {
          platform,
          error: result.reason,
        };
      }
    });

    return {
      success: true,
      data: {
        contentId: dto.contentId,
        workspaceId,
        adaptations,
        generatedAt: new Date(),
      },
    };
  }

  @Get('logs/:contentId')
  @PermissionChecker('CONTENT_READ')
  @ApiOperation({ summary: 'Get adaptation logs for a content' })
  @ApiParam({ name: 'contentId', type: String })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Adaptation logs retrieved', type: [AdaptationLogDto] })
  async getAdaptationLogs(
    @Param('contentId') contentId: string,
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const targetWorkspaceId = workspaceId || req.user.defaultWorkspaceId;
    const logs = await this.aiAdaptationService.getAdaptationLogs(contentId, targetWorkspaceId);
    return { success: true, data: logs };
  }
})
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiBearerAuth, ApiTags, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ContentDto } from './dto/content.dto';
import { PublishContentDto } from './dto/publish-content.dto';
import { ScheduleContentDto } from './dto/schedule-content.dto';
import { ContentStatsDto } from './dto/content-stats.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';
import { ContentStatus } from '@prisma/client';

@ApiTags('Content')
@ApiBearerAuth()
@Controller('content')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @PermissionChecker('CONTENT_CREATE')
  @ApiOperation({ summary: 'Create content' })
  @ApiResponse({ status: 200, description: 'Content created successfully', type: ContentDto })
  async create(@Body() createDto: CreateContentDto, @Req() req: any) {
    const workspaceId = req.body.workspaceId || req.query.workspaceId || req.user.defaultWorkspaceId;
    const content = await this.contentService.create(workspaceId, req.user.id, createDto);
    return { success: true, data: content };
  }

  @Get()
  @PermissionChecker('CONTENT_READ')
  @ApiOperation({ summary: 'List all content with optional filters' })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'scheduled', 'processing', 'published', 'failed', 'cancelled'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Success', type: [ContentDto] })
  async findAll(
    @Query('workspaceId') workspaceId: string,
    @Query('status') status?: ContentStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req: any,
  ) {
    const targetWorkspaceId = workspaceId || req.user.defaultWorkspaceId;
    const result = await this.contentService.findAll(targetWorkspaceId, req.user.id, status, page || 1, limit || 20);
    return { success: true, data: result.items, meta: { total: result.total, page: result.page, pages: result.pages } };
  }

  @Get(':id')
  @PermissionChecker('CONTENT_READ')
  @ApiOperation({ summary: 'Get content by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Success', type: ContentDto })
  async findOne(@Param('id') id: string, @Query('workspaceId') workspaceId: string, @Req() req: any) {
    const content = await this.contentService.findOne(id, workspaceId || req.user.defaultWorkspaceId, req.user.id);
    return { success: true, data: content };
  }

  @Patch(':id')
  @PermissionChecker('CONTENT_UPDATE')
  @ApiOperation({ summary: 'Update content' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateContentDto })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Content updated', type: ContentDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateContentDto,
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const content = await this.contentService.update(id, workspaceId || req.user.defaultWorkspaceId, req.user.id, updateDto);
    return { success: true, data: content };
  }

  @Delete(':id')
  @PermissionChecker('CONTENT_DELETE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete content (soft delete)' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 204, description: 'Content deleted' })
  async remove(@Param('id') id: string, @Query('workspaceId') workspaceId: string, @Req() req: any) {
    await this.contentService.delete(id, workspaceId || req.user.defaultWorkspaceId, req.user.id);
    return { success: true, message: 'Content deleted successfully' };
  }

  @Post(':id/publish')
  @PermissionChecker('CONTENT_PUBLISH')
  @ApiOperation({ summary: 'Publish content immediately to specified platforms' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: PublishContentDto, required: false })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Publish initiated', type: ContentDto })
  async publish(
    @Param('id') id: string,
    @Body() publishDto?: PublishContentDto,
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const content = await this.contentService.publish(id, workspaceId || req.user.defaultWorkspaceId, req.user.id, publishDto);
    return { success: true, data: content };
  }

  @Post(':id/schedule')
  @PermissionChecker('CONTENT_PUBLISH')
  @ApiOperation({ summary: 'Schedule content for future publishing' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ScheduleContentDto })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Content scheduled', type: ContentDto })
  async schedule(
    @Param('id') id: string,
    @Body() scheduleDto: ScheduleContentDto,
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const content = await this.contentService.schedule(id, workspaceId || req.user.defaultWorkspaceId, req.user.id, scheduleDto);
    return { success: true, data: content };
  }

  @Post(':id/cancel')
  @PermissionChecker('CONTENT_UPDATE')
  @ApiOperation({ summary: 'Cancel scheduled or processing content' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Content cancelled', type: ContentDto })
  async cancel(@Param('id') id: string, @Query('workspaceId') workspaceId: string, @Req() req: any) {
    const content = await this.contentService.cancel(id, workspaceId || req.user.defaultWorkspaceId, req.user.id);
    return { success: true, data: content };
  }

  @Get('stats')
  @PermissionChecker('CONTENT_READ')
  @ApiOperation({ summary: 'Get content statistics for workspace' })
  @ApiQuery({ name: 'workspaceId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Stats', type: ContentStatsDto })
  async getStats(@Query('workspaceId') workspaceId: string, @Req() req: any) {
    const stats = await this.contentService.getStats(workspaceId || req.user.defaultWorkspaceId, req.user.id);
    return { success: true, data: stats };
  }
}

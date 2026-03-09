import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @PermissionChecker('WEBHOOK_MANAGE')
  async create(@Body() createDto: { url: string; events: string[]; secret?: string }, @Req() req: any) {
    const webhook = await this.webhooksService.createWebhook(
      req.user.defaultWorkspaceId,
      req.user.id,
      createDto,
    );

    return { success: true, data: webhook };
  }

  @Get()
  @PermissionChecker('WEBHOOK_MANAGE')
  async findAll(@Query('workspaceId') workspaceId: string, @Req() req: any) {
    const webhooks = await this.webhooksService.findAll(
      workspaceId || req.user.defaultWorkspaceId,
      req.user.id,
    );

    return { success: true, data: webhooks };
  }

  @Get(':id')
  @PermissionChecker('WEBHOOK_MANAGE')
  async findOne(@Param('id') id: string, @Query('workspaceId') workspaceId: string, @Req() req: any) {
    const webhook = await this.webhooksService.findOne(
      workspaceId || req.user.defaultWorkspaceId,
      id,
      req.user.id,
    );

    return { success: true, data: webhook };
  }

  @Patch(':id')
  @PermissionChecker('WEBHOOK_MANAGE')
  async update(
    @Param('id') id: string,
    @Body() updateDto: { url?: string; events?: string[]; isActive?: boolean; secret?: string },
    @Query('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    const webhook = await this.webhooksService.updateWebhook(
      workspaceId || req.user.defaultWorkspaceId,
      id,
      req.user.id,
      updateDto,
    );

    return { success: true, data: webhook };
  }

  @Delete(':id')
  @PermissionChecker('WEBHOOK_MANAGE')
  async remove(@Param('id') id: string, @Query('workspaceId') workspaceId: string, @Req() req: any) {
    const result = await this.webhooksService.deleteWebhook(
      workspaceId || req.user.defaultWorkspaceId,
      id,
      req.user.id,
    );

    return result;
  }

  @Post(':id/test')
  @PermissionChecker('WEBHOOK_MANAGE')
  async test(@Param('id') id: string, @Query('workspaceId') workspaceId: string, @Req() req: any) {
    const result = await this.webhooksService.testWebhook(
      workspaceId || req.user.defaultWorkspaceId,
      id,
      req.user.id,
    );

    return result;
  }
}
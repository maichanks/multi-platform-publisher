import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SocialAccountsService } from './social-accounts.service';
import { ConnectionRequestDto } from './dto/connection-request.dto';
import { SocialAccountDto } from './dto/social-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@ApiTags('Social Accounts')
@ApiBearerAuth()
@Controller('social-accounts')
@UseGuards(JwtAuthGuard)
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Post(':platform/connect')
  @PermissionChecker('SOCIAL_ACCOUNT_CONNECT')
  @ApiOperation({ summary: 'Connect a social media account via OAuth' })
  @ApiParam({ name: 'platform', description: 'Platform name (twitter, reddit, linkedin)', enum: ['twitter', 'reddit', 'linkedin'] })
  @ApiBody({ type: ConnectionRequestDto })
  @ApiResponse({ status: 201, description: 'Account connected successfully', type: SocialAccountDto })
  async connect(
    @Param('platform') platform: string,
    @Body() connectionRequest: ConnectionRequestDto,
    @Req() req,
  ) {
    return this.socialAccountsService.connect(
      connectionRequest.workspaceId,
      req.user.id,
      platform,
      connectionRequest,
    );
  }

  @Delete(':accountId/disconnect')
  @PermissionChecker('SOCIAL_ACCOUNT_DISCONNECT')
  @ApiOperation({ summary: 'Disconnect a social media account' })
  @ApiParam({ name: 'accountId', description: 'Social account ID' })
  @ApiBody({ type: Object, description: 'Workspace ID' })
  @ApiResponse({ status: 204, description: 'Account disconnected successfully' })
  async disconnect(
    @Param('accountId') accountId: string,
    @Body() body: { workspaceId: string },
    @Req() req,
  ) {
    return this.socialAccountsService.disconnect(
      body.workspaceId,
      req.user.id,
      accountId,
    );
  }

  @Get('workspace/:workspaceId')
  @PermissionChecker('SOCIAL_ACCOUNT_READ')
  @ApiOperation({ summary: 'List all social accounts for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Success', type: [SocialAccountDto] })
  async listByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
  ) {
    return this.socialAccountsService.listByWorkspace(workspaceId, req.user.id);
  }

  @Get(':accountId/status')
  @PermissionChecker('SOCIAL_ACCOUNT_READ')
  @ApiOperation({ summary: 'Get social account status and rate limit info' })
  @ApiParam({ name: 'accountId', description: 'Social account ID' })
  @ApiResponse({
    status: 200,
    description: 'Account status',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        platform: { type: 'string', enum: ['twitter', 'reddit', 'linkedin'] },
        platformUsername: { type: 'string' },
        status: { type: 'string' },
        lastSyncAt: { type: 'string', format: 'date-time' },
        rateLimitRemaining: { type: 'number' },
        errorMessage: { type: 'string' },
      },
    },
  })
  async getStatus(
    @Param('accountId') accountId: string,
    @Req() req,
  ) {
    return this.socialAccountsService.getStatus(accountId, req.user.id);
  }

  @Post(':accountId/refresh')
  @PermissionChecker('SOCIAL_ACCOUNT_REFRESH')
  @ApiOperation({ summary: 'Manually refresh access token for a social account' })
  @ApiParam({ name: 'accountId', description: 'Social account ID' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refreshToken(@Param('accountId') accountId: string) {
    return this.socialAccountsService.refreshToken(accountId);
  }
}

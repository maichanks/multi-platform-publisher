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
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @PermissionChecker('WORKSPACE_CREATE')
  async create(@Body() createWorkspaceDto: CreateWorkspaceDto, @Req() req) {
    return this.workspacesService.create({
      ...createWorkspaceDto,
      ownerId: req.user.id,
    });
  }

  @Get()
  async findAll(@Req() req) {
    return this.workspacesService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    return this.workspacesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @PermissionChecker('WORKSPACE_UPDATE')
  async update(
    @Param('id') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @Req() req,
  ) {
    return this.workspacesService.update(id, updateWorkspaceDto, req.user.id);
  }

  @Delete(':id')
  @PermissionChecker('WORKSPACE_DELETE')
  async remove(@Param('id') id: string, @Req() req) {
    return this.workspacesService.delete(id, req.user.id);
  }

  @Post(':workspaceId/members')
  @PermissionChecker('MEMBER_INVITE')
  async inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() inviteMemberDto: any,
    @Req() req,
  ) {
    return this.workspacesService.inviteMember(workspaceId, inviteMemberDto, req.user.id);
  }

  @Delete(':workspaceId/members/:userId')
  @PermissionChecker('MEMBER_REMOVE')
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Req() req,
  ) {
    return this.workspacesService.removeMember(workspaceId, userId, req.user.id);
  }

  @Get(':workspaceId/members')
  @PermissionChecker('CONTENT_READ')
  async getMembers(@Param('workspaceId') workspaceId: string, @Req() req) {
    return this.workspacesService.getMembers(workspaceId, req.user.id);
  }

  @Put(':workspaceId/members/:userId/role')
  @PermissionChecker('member:update_role')
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @Req() req,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      userId,
      updateMemberRoleDto,
      req.user.id,
    );
  }

  @Get(':workspaceId/activity')
  @PermissionChecker('CONTENT_READ')
  async getWorkspaceActivity(
    @Param('workspaceId') workspaceId: string,
    @Req() req,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.workspacesService.getWorkspaceActivity(
      workspaceId,
      req.user.id,
      limit,
      before,
    );
  }
}

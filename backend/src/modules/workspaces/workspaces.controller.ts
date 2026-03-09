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
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionChecker } from '../auth/decorators/permission.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
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
}

import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum WorkspaceRole {
  creator = 'creator',
  admin = 'admin',
  approver = 'approver',
  editor = 'editor',
  viewer = 'viewer',
}

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'The new role for the member',
    enum: WorkspaceRole,
    example: WorkspaceRole.admin,
  })
  @IsEnum(WorkspaceRole, {
    message: 'Role must be one of: creator, admin, approver, editor, viewer',
  })
  role: WorkspaceRole;
}

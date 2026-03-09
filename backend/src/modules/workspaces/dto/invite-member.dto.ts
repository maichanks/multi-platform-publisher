import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}

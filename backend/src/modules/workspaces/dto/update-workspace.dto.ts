import { IsString, IsOptional, IsUrl } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

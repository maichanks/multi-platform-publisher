import { IsString, IsNotEmpty, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateAdaptationJobDto {
  @IsString()
  @IsNotEmpty()
  contentId: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

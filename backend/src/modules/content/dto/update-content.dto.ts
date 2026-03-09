import { IsString, IsOptional, IsArray, IsEnum, IsObject } from 'class-validator';

export class UpdateContentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  media?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  targetPlatforms?: SocialPlatform[];

  @IsOptional()
  @IsObject()
  aiAdaptationConfig?: {
    enabled?: boolean;
    model?: string;
    platformSpecific?: boolean;
  };

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

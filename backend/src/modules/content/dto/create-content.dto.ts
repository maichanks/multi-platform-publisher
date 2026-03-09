import { IsString, IsNotEmpty, MinLength, MaxLength, IsOptional, IsObject, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform } from '@prisma/client';

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

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
  scheduledAt?: string; // ISO date string
}

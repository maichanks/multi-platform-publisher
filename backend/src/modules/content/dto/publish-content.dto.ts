import { IsArray, IsEnum, IsOptional, IsObject } from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class PublishContentDto {
  @IsOptional()
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[]; // If empty, uses content.targetPlatforms

  @IsOptional()
  @IsObject()
  options?: {
    immediate?: boolean; // If false, respects scheduledAt
  };
}

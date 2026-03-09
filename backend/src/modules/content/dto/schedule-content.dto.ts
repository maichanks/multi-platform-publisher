import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';

export class ScheduleContentDto {
  @IsNotEmpty()
  @IsString()
  scheduledAt: string; // ISO date string

  @IsOptional()
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[];
}

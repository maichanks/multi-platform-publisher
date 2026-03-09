import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class ConnectionRequestDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  // For API-based platforms
  @IsOptional()
  @IsString()
  code?: string; // OAuth2 authorization code

  @IsOptional()
  @IsString()
  redirectUri?: string;

  // For browser automation platforms (xiaohongshu, douyin)
  @IsOptional()
  @IsString()
  sessionToken?: string; // QR code login session token

  @IsOptional()
  @IsString()
  cookie?: string; // Manual cookie-based session

  // For Reddit script flow
  @IsOptional()
  @IsString()
  username?: string;
  @IsOptional()
  @IsString()
  password?: string;
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}

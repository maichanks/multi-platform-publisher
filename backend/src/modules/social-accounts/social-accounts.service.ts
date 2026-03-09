import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectionRequestDto } from './dto/connection-request.dto';
import { SocialAccountDto } from './dto/social-account.dto';
import { EncryptorService } from '../common/encryptor.service';
import { SocialPlatformAdapterFactory } from '../platforms/adapters/factory';

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryptor: EncryptorService,
    private readonly adapterFactory: SocialPlatformAdapterFactory,
  ) {}

  async connect(
    workspaceId: string,
    userId: string,
    platform: string,
    connectionData: any,
  ): Promise<SocialAccountDto> {
    // Verify workspace membership
    const membership = await this.checkWorkspaceAccess(workspaceId, userId);
    if (!membership) {
      throw new ForbiddenException('No access to workspace');
    }

    // Get adapter for platform
    const adapter = this.adapterFactory.getAdapter(platform);

    // Exchange auth code for tokens (or handle browser automation)
    const tokens = await adapter.exchangeTokens(connectionData);

    // Encrypt tokens before storage
    const encryptedAccessToken = this.encryptor.encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? this.encryptor.encrypt(tokens.refreshToken)
      : null;

    // Create social account record
    const socialAccount = await this.prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: platform as any,
        platformAccountId: tokens.platformAccountId,
        platformUsername: tokens.platformUsername,
        platformDisplayName: tokens.platformDisplayName,
        profileUrl: tokens.profileUrl,
        avatarUrl: tokens.avatarUrl,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        tokenScope: tokens.scope,
        status: 'connected',
      },
    });

    return this.toDto(socialAccount);
  }

  async disconnect(workspaceId: string, userId: string, accountId: string): Promise<void> {
    await this.checkWorkspaceAccess(workspaceId, userId);

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    await this.prisma.socialAccount.delete({
      where: { id: accountId },
    });
  }

  async getAccessToken(accountId: string, workspaceId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    // Decrypt token
    return this.encryptor.decrypt(account.accessTokenEncrypted);
  }

  async refreshToken(accountId: string): Promise<void> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.refreshTokenEncrypted) {
      throw new BadRequestException('Cannot refresh token - no refresh token available');
    }

    const refreshToken = this.encryptor.decrypt(account.refreshTokenEncrypted);
    const adapter = this.adapterFactory.getAdapter(account.platform);

    const newTokens = await adapter.refreshAccessToken(refreshToken);

    // Update encrypted tokens
    await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: this.encryptor.encrypt(newTokens.accessToken),
        refreshTokenEncrypted: newTokens.refreshToken
          ? this.encryptor.encrypt(newTokens.refreshToken)
          : account.refreshTokenEncrypted,
        tokenExpiresAt: newTokens.expiresAt,
      },
    });
  }

  async listByWorkspace(workspaceId: string, userId: string): Promise<SocialAccountDto[]> {
    await this.checkWorkspaceAccess(workspaceId, userId);

    const accounts = await this.prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map(a => this.toDto(a));
  }

  async getStatus(accountId: string, workspaceId: string) {
    await this.checkWorkspaceAccess(workspaceId, workspaceId); // Simplified

    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    return {
      id: account.id,
      platform: account.platform,
      platformUsername: account.platformUsername,
      status: account.status,
      lastSyncAt: account.lastSyncAt,
      rateLimitRemaining: account.rateLimitRemaining,
      errorMessage: account.errorMessage,
    };
  }

  private async checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    return !!membership;
  }

  private toDto(account: any): SocialAccountDto {
    return {
      id: account.id,
      workspaceId: account.workspaceId,
      platform: account.platform,
      platformUsername: account.platformUsername,
      platformDisplayName: account.platformDisplayName,
      profileUrl: account.profileUrl,
      avatarUrl: account.avatarUrl,
      status: account.status,
      lastSyncAt: account.lastSyncAt,
      createdAt: account.createdAt,
    };
  }
}

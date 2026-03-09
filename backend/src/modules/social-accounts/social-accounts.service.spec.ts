import { Test, TestingModule } from '@nestjs/testing';
import { SocialAccountsService } from './social-accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EncryptorService } from '../common/encryptor.service';
import { SocialPlatformAdapterFactory } from '../platforms/adapters/factory';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('SocialAccountsService', () => {
  let service: SocialAccountsService;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let encryptor: jest.Mocked<EncryptorService>;
  let adapterFactory: jest.Mocked<SocialPlatformAdapterFactory>;

  const mockAccount = {
    id: 'sa-1',
    workspaceId: 'ws-1',
    platform: 'twitter' as const,
    platformAccountId: '12345',
    platformUsername: 'testuser',
    platformDisplayName: 'Test User',
    profileUrl: 'https://twitter.com/testuser',
    avatarUrl: 'https://example.com/avatar.jpg',
    accessTokenEncrypted: 'encrypted-token',
    refreshTokenEncrypted: 'encrypted-refresh',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    tokenScope: 'read,write',
    status: 'connected' as const,
    lastSyncAt: new Date(),
    rateLimitRemaining: 100,
    errorMessage: null,
    createdAt: new Date(),
  };

  const mockAdapter = {
    exchangeTokens: jest.fn(),
    refreshAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    prismaService = {
      workspaceMember: { findFirst: jest.fn() },
      socialAccount: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    configService = { get: jest.fn() } as any;
    encryptor = {
      encrypt: jest.fn().mockReturnValue('encrypted'),
      decrypt: jest.fn().mockReturnValue('decrypted'),
    } as any;
    adapterFactory = {
      getAdapter: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAccountsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ConfigService, useValue: configService },
        { provide: EncryptorService, useValue: encryptor },
        { provide: SocialPlatformAdapterFactory, useValue: adapterFactory },
      ],
    }).compile();

    service = module.get<SocialAccountsService>(SocialAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('connect', () => {
    it('should connect a new social account', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      mockAdapter.exchangeTokens.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        platformAccountId: '12345',
        platformUsername: 'testuser',
        platformDisplayName: 'Test User',
        profileUrl: 'https://twitter.com/testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        scope: 'read,write',
        expiresAt: new Date(Date.now() + 3600000),
      });
      prismaService.socialAccount.create.mockResolvedValue(mockAccount);

      const result = await service.connect('ws-1', 'user-1', 'twitter', { code: 'auth-code' });

      expect(result.platform).toBe('twitter');
      expect(result.platformUsername).toBe('testuser');
      expect(encryptor.encrypt).toHaveBeenCalledWith('token');
    });

    it('should throw ForbiddenException if no workspace access', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(service.connect('ws-1', 'user-1', 'twitter', {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('disconnect', () => {
    it('should delete social account', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.socialAccount.findFirst.mockResolvedValue(mockAccount);
      prismaService.socialAccount.delete.mockResolvedValue(mockAccount);

      await service.disconnect('ws-1', 'user-1', 'sa-1');

      expect(prismaService.socialAccount.delete).toHaveBeenCalledWith({
        where: { id: 'sa-1' },
      });
    });

    it('should throw NotFoundException if account not found', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.disconnect('ws-1', 'user-1', 'sa-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAccessToken', () => {
    it('should return decrypted access token', async () => {
      prismaService.socialAccount.findFirst.mockResolvedValue(mockAccount);

      const token = await service.getAccessToken('sa-1', 'ws-1');

      expect(token).toBe('decrypted');
      expect(encryptor.decrypt).toHaveBeenCalledWith('encrypted-token');
    });

    it('should throw NotFoundException if account not found', async () => {
      prismaService.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.getAccessToken('sa-1', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      prismaService.socialAccount.findUnique.mockResolvedValue({
        ...mockAccount,
        refreshTokenEncrypted: 'encrypted-refresh',
      });
      mockAdapter.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: new Date(Date.now() + 7200000),
      });
      prismaService.socialAccount.update.mockResolvedValue(mockAccount);

      await service.refreshToken('sa-1');

      expect(encryptor.decrypt).toHaveBeenCalledWith('encrypted-refresh');
      expect(encryptor.encrypt).toHaveBeenCalledWith('new-token');
      expect(prismaService.socialAccount.update).toHaveBeenCalledWith({
        where: { id: 'sa-1' },
        data: {
          accessTokenEncrypted: 'encrypted',
          refreshTokenEncrypted: 'encrypted',
          tokenExpiresAt: expect.any(Date),
        },
      });
    });

    it('should throw BadRequestException if no refresh token', async () => {
      prismaService.socialAccount.findUnique.mockResolvedValue({
        ...mockAccount,
        refreshTokenEncrypted: null,
      });

      await expect(service.refreshToken('sa-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listByWorkspace', () => {
    it('should return list of accounts', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.socialAccount.findMany.mockResolvedValue([mockAccount]);

      const result = await service.listByWorkspace('ws-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockAccount.id,
        platform: 'twitter',
      });
    });
  });

  describe('getStatus', () => {
    it('should return account status', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.socialAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await service.getStatus('sa-1', 'ws-1');

      expect(result).toMatchObject({
        id: mockAccount.id,
        platform: 'twitter',
        platformUsername: 'testuser',
        status: 'connected',
      });
    });

    it('should throw NotFoundException if account not found', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.socialAccount.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('sa-1', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

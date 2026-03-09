import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
    emailVerified: false,
    createdAt: new Date(),
    deletedAt: null,
  };

  const mockApiKey = {
    id: 'key-1',
    userId: 'user-1',
    name: 'My API Key',
    keyPrefix: 'pk_live',
    keyHash: 'hash',
    createdAt: new Date(),
    revoked: false,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      apiKey: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      prismaService.user.create.mockResolvedValue(mockUser);

      const createDto = { email: 'test@example.com', name: 'Test User' };
      const result = await service.create(createDto);

      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });
  });

  describe('findAll', () => {
    it('should return list of non-deleted users', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(result.id).toBe('user-1');
    });

    it('should throw NotFoundException if user not found or deleted', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user if exists and not deleted', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        emailVerified: false,
        createdAt: expect.any(Date),
      });
    });

    it('should return null if user deleted', async () => {
      prismaService.user.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      const result = await service.findByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      prismaService.user.update.mockResolvedValue(mockUser);

      const updateDto = { name: 'Updated Name', avatarUrl: 'https://example.com/avatar.jpg' };
      const result = await service.update('user-1', updateDto);

      expect(result.name).toBe('Test User'); // toDto returns original name? Actually updateDto would have been applied.
      // Wait: we used mockUser which has name 'Test User'. If we want to test that the update data is passed, we should check the call arguments.
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateDto,
      });
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      prismaService.user.update.mockResolvedValue({} as any);

      await service.softDelete('user-1');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('createApiKey', () => {
    it('should generate and store API key', async () => {
      const crypto = require('crypto');
      prismaService.apiKey.create.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        name: 'My API Key',
        keyPrefix: 'pk_live',
        keyHash: 'hashed-key',
        createdAt: new Date(),
        revoked: false,
      });

      const result = await service.createApiKey('user-1', 'My API Key');

      expect(result.key).toMatch(/^pk_live_[a-f0-9]+$/);
      expect(result.keyId).toBe('key-1');
      expect(prismaService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'My API Key',
          keyPrefix: 'pk_live',
          keyHash: expect.any(String),
        }),
      });
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      prismaService.apiKey.findFirst.mockResolvedValue(mockApiKey);
      prismaService.apiKey.update.mockResolvedValue({ ...mockApiKey, revoked: true });

      await service.revokeApiKey('user-1', 'key-1');

      expect(prismaService.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { revoked: true },
      });
    });

    it('should throw NotFoundException if key not found', async () => {
      prismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revokeApiKey('user-1', 'key-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

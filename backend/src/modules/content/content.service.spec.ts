import { Test, TestingModule } from '@nestjs/testing';
import { ContentService } from './content.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('ContentService', () => {
  let service: ContentService;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerService: jest.Mocked<LoggerService>;

  const mockContent = {
    id: 'content-1',
    workspaceId: 'ws-1',
    createdById: 'user-1',
    title: 'Test Content',
    body: 'Body text',
    summary: 'Summary',
    media: {},
    tags: ['test'],
    status: 'draft' as const,
    errorMessage: null,
    scheduledAt: null,
    targetPlatforms: ['twitter'],
    aiAdaptationConfig: { enabled: false },
    adaptationResults: null,
    publishResults: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    deletedAt: null,
    workspace: { id: 'ws-1', name: 'Workspace', slug: 'workspace' },
    createdBy: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
    aiAdaptationLogs: [],
    publishJobs: [],
  };

  beforeEach(async () => {
    prismaService = {
      content: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      workspaceMember: {
        findFirst: jest.fn(),
      },
      socialAccount: {
        findMany: jest.fn(),
      },
      publishJob: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    loggerService = {
      log: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: PrismaService, useValue: prismaService },
        { provide: LoggerService, useValue: loggerService },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      title: 'New Content',
      body: 'Body',
      summary: 'Summary',
      media: {},
      tags: ['tag'],
      targetPlatforms: ['linkedin'],
      aiAdaptationConfig: { enabled: false },
    };

    it('should create content successfully', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.content.create.mockResolvedValue(mockContent);

      const result = await service.create('ws-1', 'user-1', createDto);

      expect(result.title).toBe(mockContent.title);
      expect(result.status).toBe('draft');
    });

    it('should set status to scheduled if scheduledAt in future', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      const scheduledContent = { ...mockContent, scheduledAt: new Date(Date.now() + 86400000), status: 'scheduled' as const };
      prismaService.content.create.mockResolvedValue(scheduledContent);

      const result = await service.create('ws-1', 'user-1', { ...createDto, scheduledAt: new Date(Date.now() + 86400000) });

      expect(result.status).toBe('scheduled');
    });
  });

  describe('findAll', () => {
    it('should return paginated content list', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.content.findMany.mockResolvedValue([mockContent]);
      prismaService.content.count.mockResolvedValue(1);

      const result = await service.findAll('ws-1', 'user-1', undefined, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
    });

    it('should filter by status', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.content.findMany.mockResolvedValue([mockContent]);
      prismaService.content.count.mockResolvedValue(1);

      await service.findAll('ws-1', 'user-1', 'draft', 1, 20);

      expect(prismaService.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
        }),
        expect.anything(),
      );
    });
  });

  describe('findOne', () => {
    it('should return content by id', async () => {
      prismaService.content.findFirst.mockResolvedValue(mockContent);

      const result = await service.findOne('content-1', 'ws-1');

      expect(result.id).toBe('content-1');
    });

    it('should throw NotFoundException if content not found', async () => {
      prismaService.content.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update content successfully', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.content.findFirst.mockResolvedValue({ ...mockContent, status: 'draft' });
      prismaService.content.update.mockResolvedValue(mockContent);

      const result = await service.update('content-1', 'ws-1', 'user-1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });

    it('should prevent update if content is published and user not creator/admin', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.content.findFirst.mockResolvedValue({ ...mockContent, status: 'published' });
      // getUserRole is private, but we can test that the get fails because it calls private method indirectly

      await expect(service.update('content-1', 'ws-1', 'user-1', { title: 'New' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if user has insufficient role', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'viewer' });

      await expect(service.update('content-1', 'ws-1', 'user-1', { title: 'New' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete content', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'creator' });
      prismaService.content.findFirst.mockResolvedValue({ ...mockContent, status: 'draft' });
      prismaService.content.update.mockResolvedValue({} as any);

      await service.delete('content-1', 'ws-1', 'user-1');

      expect(prismaService.content.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
      );
    });

    it('should throw BadRequestException if content is published', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'creator' });
      prismaService.content.findFirst.mockResolvedValue({ ...mockContent, status: 'published' });

      await expect(service.delete('content-1', 'ws-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('publish', () => {
    it('should create publish jobs for connected social accounts', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'admin' });
      prismaService.content.findFirst.mockResolvedValue({ ...mockContent, targetPlatforms: ['twitter'] });
      prismaService.socialAccount.findMany.mockResolvedValue([
        { id: 'sa-1', platform: 'twitter' as const, workspaceId: 'ws-1', status: 'connected' },
      ]);
      const updatedContent = { ...mockContent, status: 'processing' as const };
      prismaService.content.update.mockResolvedValue(updatedContent);
      prismaService.publishJob.create.mockResolvedValue({} as any);
      prismaService.content.findFirst.mockResolvedValue(updatedContent); // for findOne inside publish

      const result = await service.publish('content-1', 'ws-1', 'user-1');

      expect(result.status).toBe('processing');
      expect(prismaService.publishJob.create).toHaveBeenCalledTimes(1);
    });

    it('should throw if no connected social accounts', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'admin' });
      prismaService.content.findFirst.mockResolvedValue({ ...mockContent, targetPlatforms: ['twitter'] });
      prismaService.socialAccount.findMany.mockResolvedValue([]);

      await expect(service.publish('content-1', 'ws-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStats', () => {
    it('should return content statistics', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'editor' });
      prismaService.content.groupBy.mockResolvedValue([
        { status: 'draft', _count: { status: 5 } },
        { status: 'published', _count: { status: 3 } },
        { status: 'scheduled', _count: { status: 2 } },
      ]);

      const stats = await service.getStats('ws-1', 'user-1');

      expect(stats).toMatchObject({
        total: 10,
        draft: 5,
        published: 3,
        scheduled: 2,
      });
    });
  });

  describe('verifyWorkspaceMembership', () => {
    it('should throw ForbiddenException if not a member', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(
        (service as any).verifyWorkspaceMembership('ws-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if role not allowed', async () => {
      prismaService.workspaceMember.findFirst.mockResolvedValue({ role: 'viewer' });

      await expect(
        (service as any).verifyWorkspaceMembership('ws-1', 'user-1', ['creator', 'admin']),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

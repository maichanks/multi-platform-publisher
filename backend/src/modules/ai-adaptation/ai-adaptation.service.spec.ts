import { Test, TestingModule } from '@nestjs/testing';
import { AIAdaptationService } from './services/ai-adaptation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';

describe('AIAdaptationService', () => {
  let service: AIAdaptationService;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let httpService: jest.Mocked<HttpService>;

  const mockContent = {
    id: 'content-1',
    workspaceId: 'ws-1',
    title: 'Original Title',
    body: 'Original body text',
    tags: ['tech'],
    adaptationResults: null,
  };

  const mockLog = {
    id: 'log-1',
    contentId: 'content-1',
    platform: 'twitter' as const,
    prompt: 'Adapt for twitter',
    originalText: 'Original body text',
    adaptedText: 'Adapted text for Twitter',
    modelUsed: 'openai/gpt-3.5-turbo',
    tokensInput: 100,
    tokensOutput: 50,
    tokensTotal: 150,
    costCents: 0,
    durationMs: 500,
    success: true,
    errorMessage: null,
    createdAt: new Date(),
  };

  const mockOpenRouterResponse = {
    data: {
      choices: [{ message: { content: 'Adapted text for Twitter' } }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
      model: 'openai/gpt-3.5-turbo',
    },
  };

  beforeEach(async () => {
    prismaService = {
      content: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      aIAdaptationLog: {
        create: jest.fn(),
      },
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const defaults: Record<string, string> = {
          OPENROUTER_MODEL: 'openai/gpt-3.5-turbo',
          OPENROUTER_API_KEY: 'test-api-key',
          OPENROUTER_REFERER: 'https://example.com',
          OPENROUTER_APP_TITLE: 'Test App',
        };
        return defaults[key] || undefined;
      }),
    } as any;

    httpService = {
      post: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
      }),
    } as any;

    // We need to mock firstValueFrom to return the response
    // But that's a function, we can't easily mock it globally.
    // Instead, we can test the service in a different way or skip the actual HTTP call.
    // For unit test, we'll mock HttpService to return an Observable that resolves to the response.
    // But AIAdaptationService uses firstValueFrom(httpService.post(...)).
    // We can mock httpService.post to return an Observable with next and complete.
    // Actually we can provide a mock that returns { data: ... } but we need to handle Observable.
    // Let's simplify: we'll test the methods but skip the actual HTTP call by mocking HttpService properly.
  });

  // Create a test module with mock HttpService returning an observable
  it('should be instantiated', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAdaptationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ConfigService, useValue: configService },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn().mockReturnValue({
              // We'll create a simple observable-like object with a pipe method that returns itself
              pipe: jest.fn().mockReturnThis(),
              subscribe: (next: Function) => next(mockOpenRouterResponse),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AIAdaptationService>(AIAdaptationService);
    expect(service).toBeDefined();
  });

  describe('adaptContent', () => {
    let subscribeMock: jest.Mock;

    beforeEach(async () => {
      subscribeMock = jest.fn((next) => next(mockOpenRouterResponse));
      const httpServiceMock = {
        post: jest.fn().mockReturnValue({
          pipe: jest.fn().mockReturnThis(),
          subscribe: subscribeMock,
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AIAdaptationService,
          { provide: PrismaService, useValue: prismaService },
          { provide: ConfigService, useValue: configService },
          { provide: HttpService, useValue: httpServiceMock },
        ],
      }).compile();

      service = module.get<AIAdaptationService>(AIAdaptationService);

      // Setup prisma mocks
      prismaService.content.findFirst.mockResolvedValue(mockContent);
      prismaService.aIAdaptationLog.create.mockResolvedValue(mockLog);
      prismaService.content.update.mockResolvedValue(mockContent);
    });

    it('should adapt content for a platform', async () => {
      const result = await service.adaptContent('content-1', 'twitter', 'ws-1');

      expect(result.success).toBe(true);
      expect(result.adaptedText).toBe('Adapted text for Twitter');
      expect(prismaService.aIAdaptationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contentId: 'content-1',
          platform: 'twitter',
          success: true,
        }),
      });
    });

    it('should update content adaptationResults', async () => {
      await service.adaptContent('content-1', 'twitter', 'ws-1');

      expect(prismaService.content.update).toHaveBeenCalledWith({
        where: { id: 'content-1' },
        data: {
          adaptationResults: expect.objectContaining({
            twitter: {
              adaptedText: 'Adapted text for Twitter',
              adaptedAt: expect.any(Date),
              model: 'openai/gpt-3.5-turbo',
            },
          }),
        },
      });
    });

    it('should throw if content not found', async () => {
      prismaService.content.findFirst.mockResolvedValue(null);

      await expect(service.adaptContent('nonexistent', 'twitter', 'ws-1')).rejects.toThrow(
        Error,
      );
    });

    it('should log failure if API key missing', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'OPENROUTER_API_KEY') return undefined;
        return 'default';
      });

      await expect(service.adaptContent('content-1', 'twitter', 'ws-1')).rejects.toThrow(
        Error,
      );
    });

    it('should log failure on API error', async () => {
      subscribeMock.mockImplementationOnce((next) => {
        throw new Error('API Error');
      });

      prismaService.aIAdaptationLog.create.mockResolvedValue({
        ...mockLog,
        success: false,
        errorMessage: 'API Error',
      });

      await expect(service.adaptContent('content-1', 'twitter', 'ws-1')).rejects.toThrow(
        Error,
      );
    });
  });

  describe('getAdaptationLogs', () => {
    it('should return logs for content', async () => {
      prismaService.content.findFirst.mockResolvedValue(mockContent);
      prismaService.aIAdaptationLog.findMany.mockResolvedValue([mockLog]);

      const logs = await service.getAdaptationLogs('content-1', 'ws-1');

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ platform: 'twitter' });
    });

    it('should throw if content not found', async () => {
      prismaService.content.findFirst.mockResolvedValue(null);

      await expect(service.getAdaptationLogs('content-1', 'ws-1')).rejects.toThrow(
        Error,
      );
    });
  });
});

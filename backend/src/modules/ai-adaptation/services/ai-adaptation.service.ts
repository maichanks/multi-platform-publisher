import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AIAdaptationLog } from '@prisma/client';
import { getAdaptationPrompt } from '../prompts/adaptation.prompt';

interface AdaptationRequest {
  model?: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

@Injectable()
export class AIAdaptationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIAdaptationService.name);
  private readonly defaultModel: string;
  private readonly httpService: HttpService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    httpService: HttpService,
  ) {
    this.httpService = httpService;
    this.defaultModel = configService.get('OPENROUTER_MODEL', 'openai/gpt-3.5-turbo');
  }

  onModuleInit() {
    this.logger.log(`AI Adaptation Service initialized. Default model: ${this.defaultModel}`);
  }

  onModuleDestroy() {
    this.logger.log('AI Adaptation Service destroyed');
  }

  async adaptContent(
    contentId: string,
    platform: string,
    workspaceId: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<AIAdaptationLog> {
    const startTime = Date.now();

    // Fetch content
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, workspaceId },
    });

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Build prompt
    const prompt = getAdaptationPrompt(platform, {
      title: content.title,
      body: content.body,
      tags: content.tags,
    });

    // Call OpenRouter
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const requestBody: AdaptationRequest = {
      model: options?.model || this.defaultModel,
      prompt,
      max_tokens: options?.maxTokens || 500,
      temperature: options?.temperature || 0.7,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<OpenRouterResponse>('https://openrouter.ai/api/v1/chat/completions', {
          messages: [{ role: 'user', content: requestBody.prompt }],
          model: requestBody.model,
          max_tokens: requestBody.max_tokens,
          temperature: requestBody.temperature,
        }, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': this.configService.get('OPENROUTER_REFERER', 'https://example.com'),
            'X-Title': this.configService.get('OPENROUTER_APP_TITLE', 'Multi-Platform Publisher'),
          },
        }),
      );

      const data = response.data;
      const adaptedText = data.choices[0]?.message?.content?.trim() || '';

      // Log adaptation
      const log = await this.prisma.aIAdaptationLog.create({
        data: {
          contentId,
          platform: platform as any,
          prompt,
          originalText: content.body,
          adaptedText,
          modelUsed: data.model,
          tokensInput: data.usage.prompt_tokens,
          tokensOutput: data.usage.completion_tokens,
          tokensTotal: data.usage.total_tokens,
          costCents: this.estimateCost(data.usage.total_tokens, data.model),
          durationMs: Date.now() - startTime,
          success: true,
        },
      });

      // Update content adaptationResults
      const existingResults = content.adaptationResults as Record<string, any> || {};
      const updatedResults = {
        ...existingResults,
        [platform]: {
          adaptedText,
          adaptedAt: new Date(),
          model: data.model,
          tokensTotal: data.usage.total_tokens,
        },
      };

      await this.prisma.content.update({
        where: { id: contentId },
        data: { adaptationResults: updatedResults },
      });

      this.logger.log(`Adaptation successful: content=${contentId}, platform=${platform}, model=${data.model}, tokens=${data.usage.total_tokens}`);
      return log;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      this.logger.error(`Adaptation failed for content ${contentId} on ${platform}:`, errorMessage);

      // Log failure
      const log = await this.prisma.aIAdaptationLog.create({
        data: {
          contentId,
          platform: platform as any,
          prompt,
          originalText: content.body,
          adaptedText: '',
          modelUsed: options?.model || this.defaultModel,
          tokensInput: 0,
          tokensOutput: 0,
          tokensTotal: 0,
          costCents: 0,
          durationMs: Date.now() - startTime,
          success: false,
          errorMessage: errorMessage,
        },
      });

      throw error;
    }
  }

  private estimateCost(tokens: number, model: string): number {
    // Simple cost estimation in cents (e.g., $0.002/1K tokens = 0.2 cents)
    // This can be expanded with a proper model pricing map
    const pricePerTokenCents: Record<string, number> = {
      'openai/gpt-3.5-turbo': 0.0002, // $0.002 per 1K tokens = 0.2 cents per 1K, so per token: 0.0002
      'openai/gpt-4': 0.03,
      'openai/gpt-4-turbo': 0.01,
      'anthropic/claude-3-haiku': 0.00025,
      'anthropic/claude-3-sonnet': 0.003,
    };
    const rate = pricePerTokenCents[model] || 0.0002;
    return Math.round(tokens * rate);
  }

  async getAdaptationLogs(contentId: string, workspaceId: string) {
    // Verify content belongs to workspace
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, workspaceId },
    });
    if (!content) {
      throw new Error('Content not found or access denied');
    }

    const logs = await this.prisma.aIAdaptationLog.findMany({
      where: { contentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { RateLimiterAbstract, RateLimiterMemory, RateLimiterRedis, RateLimitError } from 'rate-limiter-flexible';

@Injectable()
export class RateLimiterService {
  private rateLimiters: Map<string, RateLimiterAbstract>;
  private redisClient?: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.rateLimiters = new Map();
    this.initRedisClient();
  }

  private async initRedisClient() {
    try {
      const redisUrl = this.configService.get('REDIS_URL');
      if (redisUrl) {
        const Redis = require('ioredis');
        this.redisClient = new Redis(redisUrl);
        this.logger.debug('RateLimiterService: Redis client initialized');
      } else {
        this.logger.warn('RateLimiterService: REDIS_URL not set, using in-memory rate limiter');
      }
    } catch (error) {
      this.logger.error('RateLimiterService: Failed to initialize Redis client', error);
    }
  }

  /**
   * Get or create a rate limiter for a specific platform
   * @param platform - Platform name (twitter, reddit, linkedin)
   * @param points - Number of points (requests) allowed in the window
   * @param duration - Time window in seconds
   */
  getLimiter(platform: string, points: number = 100, duration: number = 900): RateLimiterAbstract {
    const key = `${platform}:${points}:${duration}`;

    if (!this.rateLimiters.has(key)) {
      const options: any = {
        points,
        duration,
      };

      if (this.redisClient) {
        options.storeClient = this.redisClient;
        this.rateLimiters.set(key, new RateLimiterRedis(options));
      } else {
        this.rateLimiters.set(key, new RateLimiterMemory(options));
      }
    }

    return this.rateLimiters.get(key)!;
  }

  /**
   * Check if a request is allowed for the platform
   * Throws RateLimitError if limit exceeded
   */
  async check(platform: string, keySuffix?: string, points?: number, duration?: number): Promise<boolean> {
    const limiter = this.getLimiter(platform, points, duration);
    const key = keySuffix ? `${platform}:${keySuffix}` : platform;

    try {
      const remaining = await limiter.get(key);
      if (remaining <= 0) {
        throw new RateLimitError(
          `Rate limit exceeded for platform: ${platform}`,
          { points: points || 100, duration: duration || 900 }
        );
      }
      return true;
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Consume points (decrement counter) - typically used after successful request
   */
  async consume(platform: string, keySuffix?: string, pointsToConsume: number = 1): Promise<{ remainingPoints: number }> {
    const limiter = this.getLimiter(platform);
    const key = keySuffix ? `${platform}:${keySuffix}` : platform;

    try {
      const result = await limiter.consume(key, pointsToConsume);
      return { remainingPoints: result.remainingPoints };
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Return current remaining points even if limit exceeded
        const remaining = await limiter.get(key);
        return { remainingPoints: remaining };
      }
      throw error;
    }
  }

  /**
   * Reset rate limit for a specific key (admin operation)
   */
  async reset(platform: string, keySuffix?: string): Promise<void> {
    const limiter = this.getLimiter(platform);
    const key = keySuffix ? `${platform}:${keySuffix}` : platform;
    await limiter.delete(key);
  }

  /**
   * Get current remaining points for a key
   */
  async getRemaining(platform: string, keySuffix?: string): Promise<number> {
    const limiter = this.getLimiter(platform);
    const key = keySuffix ? `${platform}:${keySuffix}` : platform;
    return await limiter.get(key);
  }
}

import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private redisClient: RedisClientType) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.redisClient.setEx(key, ttlSeconds, str);
    } else {
      await this.redisClient.set(key, str);
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Use SCAN to find keys matching pattern and delete them
    let cursor = '0';
    do {
      const result = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result.cursor;
      const keys = result.keys;
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } while (cursor !== '0');
  }

  async flush(): Promise<void> {
    await this.redisClient.flushdb();
  }

  async onModuleDestroy() {
    // Redis client is managed by RedisCacheModule, no need to close here
  }
}

import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { createClient, RedisClientType } from 'redis';

@Global()
@Module({})
export class RedisCacheModule {
  static registerAsync(): DynamicModule {
    return {
      module: RedisCacheModule,
      useFactory: async (configService: ConfigService) => {
        const client = createClient({
          url: configService.getRedisUrl(),
        });

        client.on('error', (err) => {
          console.error('Redis Client Error:', err);
        });

        await client.connect();

        return { client };
      },
      inject: [ConfigService],
      exports: ['REDIS_CLIENT'],
    };
  }
}

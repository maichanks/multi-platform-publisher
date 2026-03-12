import { DynamicModule, Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '../../config/config.service';

@Global()
@Module({})
export class RateLimitModule {
  static registerAsync(): DynamicModule {
    return ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const rules = [
          {
            // Global default
            ttl: configService.get<number>('RATE_LIMIT_WINDOW_MS', 60000),
            limit: configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
          },
          {
            // Auth endpoints
            ttl: configService.get<number>('RATE_LIMIT_AUTH_WINDOW_MS', 60000),
            limit: configService.get<number>('RATE_LIMIT_AUTH_MAX_REQUESTS', 5),
            prefix: 'auth', // matches routes starting with /api/auth
          },
          {
            // Admin endpoints
            ttl: configService.get<number>('RATE_LIMIT_ADMIN_WINDOW_MS', 60000),
            limit: configService.get<number>('RATE_LIMIT_ADMIN_MAX_REQUESTS', 30),
            prefix: 'admin',
          },
        ];
        return rules;
      },
      inject: [ConfigService],
    });
  }
}

import { DynamicModule, Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '../../config/config.service';

@Global()
@Module({})
export class RateLimitModule {
  static registerAsync(): DynamicModule {
    return ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('RATE_LIMIT_WINDOW_MS', 60000),
          limit: configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
        },
      ],
      inject: [ConfigService],
    });
  }
}

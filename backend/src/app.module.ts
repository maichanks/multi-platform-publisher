import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { SocialAccountsModule } from './modules/social-accounts/social-accounts.module';
import { ContentModule } from './modules/content/content.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AiAdaptationModule } from './modules/ai-adaptation/ai-adaptation.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RedisCacheModule } from './modules/common/redis-cache.module';
import { RateLimitModule } from './modules/common/rate-limit.module';
import { ConfigService } from './config/config.service';
import { LoggerService } from './common/logger/logger.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '.env',
      load: [() => ({})],
    }),

    // Winston Logger
    WinstonModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        level: configService.get('LOG_LEVEL', 'info'),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          configService.get('LOG_FORMAT', 'json') === 'json'
            ? winston.format.json()
            : winston.format.prettyPrint(),
        ),
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
          }),
        ],
      }),
      inject: [ConfigService],
    }),

    // Redis (for caching and Bull queues)
    RedisCacheModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB', 0),
      }),
      inject: [ConfigService],
    }),

    // Bull Queue
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 60 * 60 * 1000, // 24 hours
          },
          removeOnFail: {
            count: 1000,
            age: 24 * 60 * 60 * 1000,
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Queue definitions
    BullModule.registerQueueAsync([
      {
        name: 'publish',
        useFactory: (configService: ConfigService) => ({
          concurrency: configService.get('PUBLISH_QUEUE_CONCURRENCY', 5),
        }),
        inject: [ConfigService],
      },
      {
        name: 'adaptation',
        useFactory: (configService: ConfigService) => ({
          concurrency: configService.get('ADAPTATION_QUEUE_CONCURRENCY', 3),
        }),
        inject: [ConfigService],
      },
      {
        name: 'compliance-scan',
        useFactory: (configService: ConfigService) => ({
          concurrency: configService.get('SCAN_QUEUE_CONCURRENCY', 3),
        }),
        inject: [ConfigService],
      },
    ]),

    // Prisma
    PrismaModule,

    // Core modules
    AuthModule,
    UsersModule,
    WorkspacesModule,
    SocialAccountsModule,
    ContentModule,
    AnalyticsModule,
    ComplianceModule,
    AiAdaptationModule,
    PlatformsModule,
    WebhooksModule,

    // Common modules
    RateLimitModule,
  ],
  providers: [
    ConfigService,
    LoggerService,
  ],
})
export class AppModule {}

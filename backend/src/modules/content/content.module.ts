import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    PrismaModule,
    ActivityLogModule,
    BullModule.registerQueueAsync({
      name: 'publish',
      useFactory: (configService: ConfigService) => ({
        concurrency: configService.get('PUBLISH_QUEUE_CONCURRENCY', 5),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ContentService],
  controllers: [ContentController],
  exports: [ContentService],
})
export class ContentModule {}
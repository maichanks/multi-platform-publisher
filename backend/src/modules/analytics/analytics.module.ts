import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [PrismaModule, ActivityLogModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
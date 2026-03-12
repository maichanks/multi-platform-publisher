import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogsController } from './activity-logs.controller';

@Module({
  imports: [PrismaModule],
  providers: [ActivityLogService],
  controllers: [ActivityLogsController],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}

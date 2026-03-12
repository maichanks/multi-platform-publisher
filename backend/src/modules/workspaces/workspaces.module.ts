import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantMiddleware } from '../common/middleware/tenant.middleware';
import { APP_GUARD, APP_MIDDLEWARE } from '@nestjs/core';

@Module({
  imports: [PrismaModule, UsersModule, ActivityLogModule],
  providers: [
    WorkspacesService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_MIDDLEWARE,
      useClass: TenantMiddleware,
    },
  ],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

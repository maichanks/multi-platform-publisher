import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { SocialAccountsController } from './social-accounts.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [PrismaModule, WorkspacesModule, PlatformsModule, ActivityLogModule],
  providers: [SocialAccountsService],
  controllers: [SocialAccountsController],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}

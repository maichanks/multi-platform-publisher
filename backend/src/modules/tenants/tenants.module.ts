import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantMiddleware } from '../common/middleware/tenant.middleware';
import { APP_GUARD, APP_MIDDLEWARE } from '@nestjs/core';

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_MIDDLEWARE,
      useClass: TenantMiddleware,
    },
  ],
})
export class TenantsModule {}

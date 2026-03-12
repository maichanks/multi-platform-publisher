import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantSlug = (request.headers['x-tenant-slug'] as string) || 'default';
    
    // In mock mode, skip DB lookup and provide a fake tenant
    if (process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL) {
      (request as any).tenant = { id: 'default', slug: tenantSlug, name: 'Mock Tenant' };
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantSlug}' not found`);
    }

    // 将租户附加到请求
    (request as any).tenant = tenant;
    return true;
  }
}

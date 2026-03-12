import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: () => void) {
    const tenantSlug = (req.headers['x-tenant-slug'] as string) || 'default';
    
    // In mock mode, skip DB lookup
    if (process.env.MOCK_MODE === 'true' || !process.env.DATABASE_URL) {
      (req as any).tenant = { id: 'default', slug: tenantSlug, name: 'Mock Tenant' };
      return next();
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantSlug}' not found`);
    }

    (req as any).tenant = tenant;
    next();
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentTenant(req: any) {
    return req.tenant;
  }

  async createDefaultTenantForUser(userId: string, name?: string) {
    const slug = `tenant-${userId}-${Date.now().toString(36)}`;
    const tenant = await this.prisma.tenant.create({
      data: {
        name: name || `Default Tenant for ${userId}`,
        slug,
      },
    });

    // Optionally create a default workspace for this tenant
    return tenant;
  }

  async assignWorkspaceToTenant(workspaceId: string, tenantId: string) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { tenantId },
    });
    return workspace;
  }
}

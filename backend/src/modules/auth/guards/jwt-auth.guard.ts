import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Permission } from '../decorators/permission.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Add request.user to req object
    return super.canActivate(context);
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    // Extract workspaceId from request
    let workspaceId: string | null = null;
    if (request.params?.workspaceId) {
      workspaceId = request.params.workspaceId;
    } else if (request.query?.workspaceId) {
      workspaceId = request.query.workspaceId;
    } else if (request.body?.workspaceId) {
      workspaceId = request.body.workspaceId;
    }

    // If no workspace context, allow if user is authenticated (for global operations like user profile)
    if (!workspaceId) {
      return true;
    }

    // Get user's role in the workspace
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // Check if user has any of the required permissions
    const hasPermission = await this.checkPermission(membership.role, requiredPermissions);
    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }

  private async checkPermission(role: string, requiredPermissions: Permission[]): Promise<boolean> {
    // Define allowed permissions per role
    const rolePermissions: Record<string, Permission[]> = {
      creator: [
        Permission.WORKSPACE_CREATE,
        Permission.WORKSPACE_READ,
        Permission.WORKSPACE_UPDATE,
        Permission.WORKSPACE_DELETE,
        Permission.MEMBER_INVITE,
        Permission.MEMBER_REMOVE,
        Permission.MEMBER_UPDATE_ROLE,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_READ,
        Permission.CONTENT_UPDATE,
        Permission.CONTENT_DELETE,
        Permission.CONTENT_PUBLISH,
        Permission.SOCIAL_ACCOUNT_CONNECT,
        Permission.SOCIAL_ACCOUNT_DISCONNECT,
        Permission.SOCIAL_ACCOUNT_REFRESH,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
        Permission.COMPLIANCE_SCAN,
        Permission.COMPLIANCE_OVERRIDE,
        Permission.SYSTEM_CONFIG,
        Permission.API_KEY_MANAGE,
        Permission.WEBHOOK_MANAGE,
      ],
      admin: [
        Permission.WORKSPACE_READ,
        Permission.WORKSPACE_UPDATE,
        Permission.MEMBER_INVITE,
        Permission.MEMBER_REMOVE,
        Permission.MEMBER_UPDATE_ROLE,
        Permission.CONTENT_CREATE,
        Permission.CONTENT_READ,
        Permission.CONTENT_UPDATE,
        Permission.CONTENT_DELETE,
        Permission.CONTENT_PUBLISH,
        Permission.SOCIAL_ACCOUNT_CONNECT,
        Permission.SOCIAL_ACCOUNT_DISCONNECT,
        Permission.SOCIAL_ACCOUNT_REFRESH,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
        Permission.COMPLIANCE_SCAN,
        Permission.COMPLIANCE_OVERRIDE,
        Permission.API_KEY_MANAGE,
        Permission.WEBHOOK_MANAGE,
      ],
      approver: [
        Permission.CONTENT_READ,
        Permission.CONTENT_UPDATE,
        Permission.CONTENT_PUBLISH,
        Permission.COMPLIANCE_SCAN,
        Permission.COMPLIANCE_OVERRIDE,
        Permission.ANALYTICS_READ,
      ],
      editor: [
        Permission.CONTENT_CREATE,
        Permission.CONTENT_READ,
        Permission.CONTENT_UPDATE,
        Permission.ANALYTICS_READ,
      ],
      viewer: [
        Permission.CONTENT_READ,
        Permission.ANALYTICS_READ,
      ],
    };

    const allowed = rolePermissions[role] || [];
    return requiredPermissions.some(perm => allowed.includes(perm));
  }
}
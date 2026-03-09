import { applyDecorators, SetMetadata } from '@nestjs/common';

export enum Permission {
  // Workspace permissions
  WORKSPACE_CREATE = 'workspace:create',
  WORKSPACE_READ = 'workspace:read',
  WORKSPACE_UPDATE = 'workspace:update',
  WORKSPACE_DELETE = 'workspace:delete',

  // Member permissions
  MEMBER_INVITE = 'member:invite',
  MEMBER_REMOVE = 'member:remove',
  MEMBER_UPDATE_ROLE = 'member:update_role',

  // Content permissions
  CONTENT_CREATE = 'content:create',
  CONTENT_READ = 'content:read',
  CONTENT_UPDATE = 'content:update',
  CONTENT_DELETE = 'content:delete',
  CONTENT_PUBLISH = 'content:publish',

  // Social account permissions
  SOCIAL_ACCOUNT_CONNECT = 'social_account:connect',
  SOCIAL_ACCOUNT_DISCONNECT = 'social_account:disconnect',
  SOCIAL_ACCOUNT_REFRESH = 'social_account:refresh',

  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',

  // Compliance permissions
  COMPLIANCE_SCAN = 'compliance:scan',
  COMPLIANCE_OVERRIDE = 'compliance:override',

  // System permissions
  SYSTEM_CONFIG = 'system:config',
  API_KEY_MANAGE = 'api_key:manage',
  WEBHOOK_MANAGE = 'webhook:manage',
}

export function PermissionChecker(...permissions: Permission[]) {
  return applyDecorators(
    SetMetadata('permissions', permissions),
  );
}

export class SocialAccountDto {
  id: string;
  workspaceId: string;
  platform: string;
  platformUsername: string;
  platformDisplayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  status: 'connected' | 'disconnected' | 'expired' | 'error' | 'pending';
  lastSyncAt?: Date;
  createdAt: Date;
}

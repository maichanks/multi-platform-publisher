import { SocialPlatform } from '@prisma/client';

export class PublishJobDto {
  id: string;
  contentId: string;
  socialAccountId: string;
  platform: SocialPlatform;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Optional: include social account details
  socialAccount?: {
    id: string;
    platform: SocialPlatform;
    platformUsername: string;
    platformUserId?: string;
  };
}

import { SocialPlatform } from '@prisma/client';

export class ContentDto {
  id: string;
  workspaceId: string;
  createdById: string;
  title: string;
  body: string;
  summary?: string;
  media: Record<string, any>;
  tags: string[];
  status: 'draft' | 'scheduled' | 'processing' | 'published' | 'failed' | 'cancelled';
  errorMessage?: string;
  scheduledAt?: Date;
  targetPlatforms: SocialPlatform[];
  aiAdaptationConfig?: Record<string, any>;
  adaptationResults?: Record<string, any>;
  publishResults?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  deletedAt?: Date;

  // Optional: include related data
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy?: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
}

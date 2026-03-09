export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface PlatformAccountInfo {
  platformAccountId: string;
  platformUsername: string;
  platformDisplayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  errorCode?: string;
  rateLimitRemaining?: number;
  rateLimitResetAt?: Date;
}

export interface PlatformAdapter {
  readonly platform: string;

  /**
   * Exchange OAuth code or credentials for tokens
   */
  exchangeTokens(data: any): Promise<PlatformCredentials & PlatformAccountInfo>;

  /**
   * Refresh expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<PlatformCredentials>;

  /**
   * Publish content to the platform
   */
  publish(
    credentials: PlatformCredentials,
    content: {
      title?: string;
      body: string;
      media?: Array<{ url: string; type: 'image' | 'video' }>;
      tags?: string[];
      customOptions?: any;
    },
  ): Promise<PublishResult>;

  /**
   * Test connection validity
   */
  testConnection(credentials: PlatformCredentials): Promise<boolean>;

  /**
   * Get account info (optional, for syncing)
   */
  getAccountInfo(accessToken: string): Promise<PlatformAccountInfo>;
}

import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdapter } from './platform-adapter.interface';
import { PlatformCredentials, PlatformAccountInfo, PublishResult } from './platform-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { RateLimiterService } from '../services/rate-limiter.service';
import { withRetry, isRetryableError, PLATFORM_RETRY_CONFIGS } from './retry.policy';

@Injectable()
export class LinkedInAdapter implements PlatformAdapter {
  readonly platform = 'linkedin';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async exchangeTokens(data: { code: string; redirectUri: string }): Promise<PlatformCredentials & PlatformAccountInfo> {
    const clientId = this.configService.get('LINKEDIN_CLIENT_ID');
    const clientSecret = this.configService.get('LINKEDIN_CLIENT_SECRET');
    const redirectUri = data.redirectUri || this.configService.get('LINKEDIN_REDIRECT_URI');

    const startTime = Date.now();
    this.logger.log('LinkedInAdapter: Exchanging tokens', { platform: this.platform });

    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'exchange', 1);
          return this.httpService
            .post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
              grant_type: 'authorization_code',
              code: data.code,
              redirect_uri: redirectUri,
              client_id: clientId,
              client_secret: clientSecret,
            }), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.linkedin,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const { access_token, refresh_token, expires_in } = response.data;

      this.logger.log('LinkedInAdapter: Token exchange successful', {
        platform: this.platform,
        duration,
      });

      // Get account info
      const accountInfo = await this.getAccountInfo(access_token);

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        scope: 'r_liteprofile r_emailaddress w_member_social',
        ...accountInfo,
      };
    } catch (error: any) {
      this.logger.error('LinkedInAdapter: Token exchange failed', {
        platform: this.platform,
        error: error.message,
        code: error.response?.data?.error,
      });
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    const clientId = this.configService.get('LINKEDIN_CLIENT_ID');
    const clientSecret = this.configService.get('LINKEDIN_CLIENT_SECRET');

    const startTime = Date.now();
    this.logger.log('LinkedInAdapter: Refreshing access token', { platform: this.platform });

    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'refresh', 1);
          return this.httpService
            .post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: clientId,
              client_secret: clientSecret,
            }), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.linkedin,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

      this.logger.log('LinkedInAdapter: Token refresh successful', {
        platform: this.platform,
        duration,
      });

      return {
        accessToken: access_token,
        refreshToken: newRefreshToken || refreshToken,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        scope: 'r_liteprofile r_emailaddress w_member_social',
      };
    } catch (error: any) {
      this.logger.error('LinkedInAdapter: Token refresh failed', {
        platform: this.platform,
        error: error.message,
        code: error.response?.data?.error,
      });
      throw error;
    }
  }

  async publish(
    credentials: PlatformCredentials,
    content: {
      title?: string;
      body: string;
      media?: Array<{ url: string; type: 'image' | 'video' }>;
      tags?: string[];
      customOptions?: any;
    },
  ): Promise<PublishResult> {
    const startTime = Date.now();
    this.logger.log('LinkedInAdapter: Publishing content', {
      platform: this.platform,
      bodyLength: content.body.length,
      mediaCount: content.media?.length || 0,
    });

    try {
      // LinkedIn uses UGC posts (User Generated Content) API
      // First, get user's URN
      const profileResponse = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'profile', 1);
          return this.httpService
            .get('https://api.linkedin.com/v2/me', {
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
              },
              params: {
                projection: '(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.linkedin,
        isRetryableError
      );

      const user = profileResponse.data;
      const authorUrn = `urn:li:person:${user.id}`;

      // Post content
      const postData: any = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content.body,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      // Add media if provided
      if (content.media && content.media.length > 0) {
        // LinkedIn requires registering images first before posting
        // For MVP, we'll only support single image
        const image = content.media[0];
        if (image.type === 'image') {
          const uploadResponse = await this.uploadImage(credentials, image.url);
          if (uploadResponse) {
            postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
            postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
              status: 'READY',
              description: { text: content.body.substring(0, 500) },
              media: uploadResponse,
              title: { text: content.title || '' },
            }];
          }
        }
      }

      // Rate limit check before posting
      await this.rateLimiter.check(this.platform, 'publish');

      const response = await withRetry(
        async () => {
          return this.httpService
            .post('https://api.linkedin.com/v2/ugcPosts', postData, {
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.linkedin,
        isRetryableError
      );

      // Consume rate limit
      await this.rateLimiter.consume(this.platform, 'publish');

      const duration = Date.now() - startTime;
      const postId = response.data.id;
      const postUrl = `https://www.linkedin.com/feed/update/${postId}/`;

      this.logger.log('LinkedInAdapter: Publish successful', {
        platform: this.platform,
        postId,
        duration,
      });

      return {
        success: true,
        postId,
        postUrl,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorData = error.response?.data || {};
      this.logger.error('LinkedInAdapter: Publish failed', {
        platform: this.platform,
        error: errorData.message || error.message,
        code: errorData.status,
        duration,
      });

      return {
        success: false,
        error: errorData.message || error.message,
        errorCode: errorData.status || 'UNKNOWN_ERROR',
      };
    }
  }

  async testConnection(credentials: PlatformCredentials): Promise<boolean> {
    this.logger.log('LinkedInAdapter: Testing connection', { platform: this.platform });

    try {
      await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'test', 1);
          return this.httpService
            .get('https://api.linkedin.com/v2/me', {
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
              },
            })
            .toPromise();
        },
        { ...PLATFORM_RETRY_CONFIGS.linkedin, maxAttempts: 1 }
      );
      this.logger.log('LinkedInAdapter: Connection test successful', { platform: this.platform });
      return true;
    } catch (error) {
      this.logger.error('LinkedInAdapter: Connection test failed', {
        platform: this.platform,
        error: error.message,
      });
      return false;
    }
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccountInfo> {
    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'info', 1);
          return this.httpService
            .get('https://api.linkedin.com/v2/me', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
              params: {
                projection: '(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
              },
            })
            .toPromise();
        },
        { ...PLATFORM_RETRY_CONFIGS.linkedin, maxAttempts: 1 }
      );

      const user = response.data;
      const firstName = user.firstName?.localized?.[user.firstName?.preferredLocale?.country] || user.firstName;
      const lastName = user.lastName?.localized?.[user.lastName?.preferredLocale?.country] || user.lastName;
      const fullName = `${firstName} ${lastName}`;

      // Get profile picture
      let avatarUrl: string | undefined;
      const pictureElements = user.profilePicture?.['displayImage~']?.elements;
      if (pictureElements && pictureElements.length > 0) {
        // Get the best resolution
        const best = pictureElements[pictureElements.length - 1];
        avatarUrl = best.identifiers[0]?.identifier;
      }

      return {
        platformAccountId: user.id,
        platformUsername: user.id, // LinkedIn doesn't expose username in v2 easily
        platformDisplayName: fullName,
        profileUrl: `https://www.linkedin.com/in/${user.id}`,
        avatarUrl,
      };
    } catch (error) {
      this.logger.error('LinkedInAdapter: Failed to get account info', {
        platform: this.platform,
        error: error.message,
      });
      return {
        platformAccountId: 'unknown',
        platformUsername: 'unknown',
      };
    }
  }

  private async uploadImage(credentials: PlatformCredentials, imageUrl: string): Promise<{ uploadMechanism: { com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest: { uploadUrl: string } } } | null> {
    this.logger.warn('LinkedInAdapter: Image upload not fully implemented', {
      platform: this.platform,
      imageUrl,
    });
    // For MVP, this is a simplified placeholder
    // Full implementation would:
    // 1. Fetch image from URL
    // 2. Call LinkedIn's registerUpload API to get upload URL
    // 3. Upload binary data
    // 4. Return the image URN
    return null;
  }
}

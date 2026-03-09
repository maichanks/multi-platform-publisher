import { Injectable, HttpService, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdapter } from './platform-adapter.interface';
import { PlatformCredentials, PlatformAccountInfo, PublishResult } from './platform-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { RateLimiterService } from '../services/rate-limiter.service';
import { withRetry, isRetryableError, PLATFORM_RETRY_CONFIGS } from './retry.policy';
import * as crypto from 'crypto';

@Injectable()
export class TwitterAdapter implements PlatformAdapter {
  readonly platform = 'twitter';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async exchangeTokens(data: { code: string; redirectUri: string }): Promise<PlatformCredentials & PlatformAccountInfo> {
    const clientId = this.configService.get('TWITTER_CLIENT_ID');
    const clientSecret = this.configService.get('TWITTER_API_SECRET');
    const redirectUri = data.redirectUri || this.configService.get('TWITTER_REDIRECT_URI');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const startTime = Date.now();
    this.logger.log('TwitterAdapter: Exchanging tokens', { platform: this.platform });

    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'exchange', 1);
          return this.httpService
            .post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
              code: data.code,
              grant_type: 'authorization_code',
              client_id: clientId,
              redirect_uri: redirectUri,
            }), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.twitter,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const { access_token, refresh_token, expires_in, scope } = response.data;

      this.logger.log('TwitterAdapter: Token exchange successful', {
        platform: this.platform,
        duration,
        scope,
      });

      // Get account info (with retry)
      const accountInfo = await this.getAccountInfo(access_token);

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        scope,
        ...accountInfo,
      };
    } catch (error: any) {
      this.logger.error('TwitterAdapter: Token exchange failed', {
        platform: this.platform,
        error: error.message,
        code: error.response?.data?.type,
      });
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    const clientId = this.configService.get('TWITTER_CLIENT_ID');
    const clientSecret = this.configService.get('TWITTER_API_SECRET');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const startTime = Date.now();
    this.logger.log('TwitterAdapter: Refreshing access token', { platform: this.platform });

    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'refresh', 1);
          return this.httpService
            .post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
              client_id: clientId,
            }), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.twitter,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const { access_token, refresh_token: newRefreshToken, expires_in, scope } = response.data;

      this.logger.log('TwitterAdapter: Token refresh successful', {
        platform: this.platform,
        duration,
      });

      return {
        accessToken: access_token,
        refreshToken: newRefreshToken || refreshToken,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        scope,
      };
    } catch (error: any) {
      this.logger.error('TwitterAdapter: Token refresh failed', {
        platform: this.platform,
        error: error.message,
        code: error.response?.data?.type,
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
    try {
      const mediaIds: string[] = [];

      // Upload media first if any
      if (content.media && content.media.length > 0) {
        for (const media of content.media) {
          const mediaId = await this.uploadMedia(credentials, media);
          if (mediaId) {
            mediaIds.push(mediaId);
          }
        }
      }

      // Build tweet text
      let tweetText = content.body;
      if (content.tags && content.tags.length > 0) {
        const hashtags = content.tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
        tweetText = `${tweetText}\n\n${hashtags}`;
      }

      // Twitter has 280 character limit
      if (tweetText.length > 280) {
        tweetText = tweetText.substring(0, 277) + '...';
      }

      const response = await this.httpService
        .post('https://api.twitter.com/2/tweets', {
          text: tweetText,
          media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined,
          ...content.customOptions,
        }, {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        })
        .toPromise();

      const tweetId = response.data.data?.id;
      const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;

      return {
        success: true,
        postId: tweetId,
        postUrl: tweetUrl,
      };
    } catch (error: any) {
      const errorData = error.response?.data || {};
      return {
        success: false,
        error: errorData.title || error.message,
        errorCode: errorData.type || 'UNKNOWN_ERROR',
      };
    }
  }

  async testConnection(credentials: PlatformCredentials): Promise<boolean> {
    try {
      await this.httpService
        .get('https://api.twitter.com/2/users/me', {
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
          },
        })
        .toPromise();
      return true;
    } catch {
      return false;
    }
  }

  async getAccountInfo(accessToken: string): Promise<PlatformAccountInfo> {
    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'info', 1);
          return this.httpService
            .get('https://api.twitter.com/2/users/me', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
              params: {
                'user.fields': 'username,name,profile_image_url',
              },
            })
            .toPromise();
        },
        { ...PLATFORM_RETRY_CONFIGS.twitter, maxAttempts: 1 } // Usually no retry for getAccountInfo as it's called from other methods
      );

      const user = response.data.data;
      return {
        platformAccountId: user.id,
        platformUsername: user.username,
        platformDisplayName: user.name,
        profileUrl: `https://twitter.com/${user.username}`,
        avatarUrl: user.profile_image_url?.replace('_normal', ''),
      };
    } catch (error) {
      this.logger.error('TwitterAdapter: Failed to get account info', {
        platform: this.platform,
        error: error.message,
      });
      // If API fails, return minimal info
      return {
        platformAccountId: 'unknown',
        platformUsername: 'unknown',
      };
    }
  }

  private async uploadMedia(
    credentials: PlatformCredentials,
    media: { url: string; type: 'image' | 'video' },
  ): Promise<string | null> {
    this.logger.warn('TwitterAdapter: Media upload not fully implemented', {
      platform: this.platform,
      mediaType: media.type,
      mediaUrl: media.url,
    });
    // For MVP, we'll skip actual media upload and just return null
    // Full implementation would:
    // 1. Download media from URL
    // 2. Upload to Twitter's media upload endpoint (INIT, APPEND, FINALIZE)
    // 3. Poll for processing
    // 4. Return media_id
    return null;
  }
}

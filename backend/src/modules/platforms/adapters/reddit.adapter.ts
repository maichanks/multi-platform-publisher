import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdapter } from './platform-adapter.interface';
import { PlatformCredentials, PlatformAccountInfo, PublishResult } from './platform-adapter.interface';
import { LoggerService } from '../../common/logger/logger.service';
import { RateLimiterService } from '../services/rate-limiter.service';
import { withRetry, isRetryableError, PLATFORM_RETRY_CONFIGS } from './retry.policy';

@Injectable()
export class RedditAdapter implements PlatformAdapter {
  readonly platform = 'reddit';

  private userAgent: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.userAgent = this.configService.get('REDDIT_USER_AGENT', 'multi-platform-publisher/1.0.0');
  }

  async exchangeTokens(data: { username: string; password: string; twoFactorCode?: string }): Promise<PlatformCredentials & PlatformAccountInfo> {
    const clientId = this.configService.get('REDDIT_CLIENT_ID');
    const clientSecret = this.configService.get('REDDIT_CLIENT_SECRET');

    // Basic auth with client credentials
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const startTime = Date.now();
    this.logger.log('RedditAdapter: Exchanging tokens', { platform: this.platform, username: data.username });

    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'exchange', 1);
          return this.httpService
            .post('https://www.reddit.com/api/v1/access_token', new URLSearchParams({
              grant_type: 'password',
              username: data.username,
              password: data.password,
              ...(data.twoFactorCode && { totp: data.twoFactorCode }),
            }), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
                'User-Agent': this.userAgent,
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.reddit,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const { access_token, refresh_token, expires_in, scope } = response.data;

      this.logger.log('RedditAdapter: Token exchange successful', {
        platform: this.platform,
        username: data.username,
        duration,
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
      this.logger.error('RedditAdapter: Token exchange failed', {
        platform: this.platform,
        username: data.username,
        error: error.message,
        code: error.response?.data?.error,
      });
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    const clientId = this.configService.get('REDDIT_CLIENT_ID');
    const clientSecret = this.configService.get('REDDIT_CLIENT_SECRET');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const startTime = Date.now();
    this.logger.log('RedditAdapter: Refreshing access token', { platform: this.platform });

    try {
      const response = await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'refresh', 1);
          return this.httpService
            .post('https://www.reddit.com/api/v1/access_token', new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
            }), {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
                'User-Agent': this.userAgent,
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.reddit,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const { access_token, refresh_token: newRefreshToken, expires_in, scope } = response.data;

      this.logger.log('RedditAdapter: Token refresh successful', {
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
      this.logger.error('RedditAdapter: Token refresh failed', {
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
    const subreddit = content.customOptions?.subreddit;

    this.logger.log('RedditAdapter: Publishing content', {
      platform: this.platform,
      subreddit,
      bodyLength: content.body.length,
    });

    if (!subreddit) {
      this.logger.warn('RedditAdapter: Missing subreddit in customOptions', { platform: this.platform });
      return {
        success: false,
        error: 'subreddit is required',
        errorCode: 'MISSING_SUBREDDIT',
      };
    }

    try {
      // Reddit requires title
      const title = content.title || content.body.substring(0, 100);

      // Build post data
      const postData: any = {
        title,
        sr: subreddit,
        api_type: 'json',
      };

      if (content.body) {
        postData.text = content.body;
      }

      if (content.media && content.media.length > 0) {
        // For image posts, we need to upload to Reddit's image hosting first
        // For video, similar process but more complex
        // For now, support text-only or link posts
        const media = content.media[0];
        postData.url = media.url;
      }

      // Rate limit check
      await this.rateLimiter.check(this.platform, 'publish');

      const response = await withRetry(
        async () => {
          return this.httpService
            .post(`https://oauth.reddit.com/api/submit`, new URLSearchParams(postData), {
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'User-Agent': this.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            })
            .toPromise();
        },
        PLATFORM_RETRY_CONFIGS.reddit,
        isRetryableError
      );

      // Consume rate limit points
      await this.rateLimiter.consume(this.platform, 'publish');

      const duration = Date.now() - startTime;
      const postDataResult = response.data.json?.data;
      if (postDataResult && postDataResult.id) {
        const postId = postDataResult.id;
        const postUrl = `https://reddit.com/r/${subreddit}/comments/${postId}`;

        this.logger.log('RedditAdapter: Publish successful', {
          platform: this.platform,
          postId,
          subreddit,
          duration,
        });

        return {
          success: true,
          postId,
          postUrl,
        };
      } else {
        const error = response.data.error || 'Unknown error';
        this.logger.error('RedditAdapter: Publish failed - invalid response', {
          platform: this.platform,
          response: response.data,
        });
        return {
          success: false,
          error: error.message || error,
          errorCode: error.name || 'REDDIT_ERROR',
        };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorData = error.response?.data || {};
      this.logger.error('RedditAdapter: Publish failed', {
        platform: this.platform,
        error: errorData.message || error.message,
        code: errorData.name,
        duration,
      });

      return {
        success: false,
        error: errorData.message || error.message,
        errorCode: errorData.name || 'REDDIT_API_ERROR',
      };
    }
  }

  async testConnection(credentials: PlatformCredentials): Promise<boolean> {
    this.logger.log('RedditAdapter: Testing connection', { platform: this.platform });

    try {
      await withRetry(
        async () => {
          await this.rateLimiter.consume(this.platform, 'test', 1);
          return this.httpService
            .get('https://oauth.reddit.com/api/v1/me', {
              headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'User-Agent': this.userAgent,
              },
            })
            .toPromise();
        },
        { ...PLATFORM_RETRY_CONFIGS.reddit, maxAttempts: 1 }
      );
      this.logger.log('RedditAdapter: Connection test successful', { platform: this.platform });
      return true;
    } catch (error) {
      this.logger.error('RedditAdapter: Connection test failed', {
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
            .get('https://oauth.reddit.com/api/v1/me', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': this.userAgent,
              },
            })
            .toPromise();
        },
        { ...PLATFORM_RETRY_CONFIGS.reddit, maxAttempts: 1 }
      );

      const user = response.data;
      return {
        platformAccountId: user.id,
        platformUsername: user.name,
        platformDisplayName: user.name,
        profileUrl: `https://reddit.com/user/${user.name}`,
      };
    } catch (error) {
      this.logger.error('RedditAdapter: Failed to get account info', {
        platform: this.platform,
        error: error.message,
      });
      return {
        platformAccountId: 'unknown',
        platformUsername: 'unknown',
      };
    }
  }
}

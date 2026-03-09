import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdapter, PlatformCredentials, PlatformAccountInfo, PublishResult } from './platform-adapter.interface';
import { PuppeteerService } from '../browser-automation/puppeteer.service';
import { RateLimiterService } from '../services/rate-limiter.service';

/**
 * Xiaohongshu (Little Red Book) Adapter
 * 
 * Uses Puppeteer-based browser automation to interact with Xiaohongshu's web interface.
 * Supports phone number login with verification code and post creation with images/tags.
 * 
 * Note: This adapter does not use OAuth tokens; instead it maintains a browser session.
 * The "accessToken" in PlatformCredentials is used as a session identifier for internal tracking.
 */
@Injectable()
export class XiaohongshuAdapter implements PlatformAdapter, OnModuleInit, OnModuleDestroy {
  readonly platform = 'xiaohongshu';

  private readonly logger = new Logger(XiaohongshuAdapter.name);
  private sessionInitialized = false;
  private isLoggedIn = false;

  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Pre-initialize browser (optional, can also be lazy)
    if (this.configService.get('XHS_PREINIT_BROWSER') === 'true') {
      try {
        await this.puppeteerService['ensureBrowser']();
        this.logger.log('Browser pre-initialized');
      } catch (e) {
        this.logger.warn('Browser pre-initialization failed', { error: e.message });
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Exchange credentials for "tokens" - for Xiaohongshu this means logging in via phone
   * 
   * @param data - Should contain { phone: string, verificationCode: string, countryCode?: string }
   *                OR { sessionToken: string } for QR code session (if implemented)
   *                OR { cookie: string } for cookie-based login (if implemented)
   * 
   * @returns PlatformCredentials with dummy accessToken (session identifier) and account info
   */
  async exchangeTokens(data: any): Promise<PlatformCredentials & PlatformAccountInfo> {
    this.logger.log('Exchanging tokens (logging in)', { platform: this.platform });
    const startTime = Date.now();

    try {
      // Check which login method is provided
      if (data.sessionToken) {
        // Future: QR code session token
        throw new Error('QR code login not yet implemented');
      } else if (data.cookie) {
        // Cookie-based login - set cookies and verify
        await this.loginWithCookie(data.cookie);
      } else if (data.phone && data.verificationCode) {
        // Phone + verification code login
        const success = await this.puppeteerService.loginWithPhone(
          data.phone,
          data.verificationCode,
          data.countryCode || '+86'
        );
        if (!success) {
          throw new Error('Phone login failed');
        }
      } else {
        throw new Error('Invalid credentials: phone+verificationCode or cookie required');
      }

      this.isLoggedIn = true;
      this.sessionInitialized = true;

      // Get account info (username, etc.)
      const accountInfo = await this.getAccountInfo('session');

      const duration = Date.now() - startTime;
      this.logger.log('Login successful', { 
        platform: this.platform, 
        duration,
        username: accountInfo.platformUsername 
      });

      // Return credentials with a dummy accessToken (could be the cookies or a session ID)
      return {
        accessToken: 'xhs-session', // Placeholder
        refreshToken: undefined,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days (session typically lasts)
        scope: 'publish',
        ...accountInfo,
      };
    } catch (error: any) {
      this.logger.error('Token exchange failed', { 
        platform: this.platform, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Refresh access token - not applicable for Xiaohongshu (session-based)
   * Returns the same token or attempts to re-login.
   */
  async refreshAccessToken(refreshToken: string): Promise<PlatformCredentials> {
    this.logger.log('Refreshing access token (re-login)', { platform: this.platform });
    
    try {
      // For Xiaohongshu, refresh means re-login with stored credentials? 
      // Without stored credentials, we can't refresh. We could check if browser is still logged in.
      const stillLoggedIn = await this.puppeteerService.checkIfLoggedIn();
      if (stillLoggedIn) {
        return {
          accessToken: 'xhs-session',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
      }

      throw new Error('Session expired, need to re-authenticate');
    } catch (error: any) {
      this.logger.error('Token refresh failed', { platform: this.platform, error: error.message });
      throw error;
    }
  }

  /**
   * Publish a post to Xiaohongshu
   */
  async publish(
    credentials: PlatformCredentials,
    content: {
      title?: string;
      body: string;
      media?: Array<{ url: string; type: 'image' | 'video' }>;
      tags?: string[];
      customOptions?: {
        location?: string;
        privacy?: 'public' | 'private' | 'friends';
      };
    },
  ): Promise<PublishResult> {
    this.logger.log('Publishing post', { platform: this.platform, title: content.title?.substring(0, 50) });

    try {
      // Apply rate limiting
      await this.rateLimiter.consume(this.platform, 'publish', 1);

      // Ensure we're logged in
      if (!this.isLoggedIn) {
        const loggedIn = await this.puppeteerService.checkIfLoggedIn();
        if (!loggedIn) {
          throw new Error('Not logged in. Please call exchangeTokens first.');
        }
        this.isLoggedIn = true;
      }

      // Call the PuppeteerService to create post
      const result = await this.puppeteerService.createPost(
        content.title || '',
        content.body,
        content.media?.map(m => m.url),
        content.tags,
        content.customOptions?.location,
        content.customOptions?.privacy
      );

      if (result.success) {
        this.logger.log('Post published successfully', { 
          platform: this.platform, 
          postId: result.postId,
          postUrl: result.postUrl 
        });
        return {
          success: true,
          postId: result.postId,
          postUrl: result.postUrl,
        };
      } else {
        this.logger.error('Post publish failed', { 
          platform: this.platform, 
          error: result.error 
        });
        return {
          success: false,
          error: result.error,
          errorCode: 'PUBLISH_FAILED',
        };
      }
    } catch (error: any) {
      this.logger.error('Publish exception', { platform: this.platform, error: error.message });
      return {
        success: false,
        error: error.message,
        errorCode: 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Test connection - essentially check if we're logged in
   */
  async testConnection(credentials: PlatformCredentials): Promise<boolean> {
    try {
      // For Xiaohongshu, we need to check browser session
      const loggedIn = await this.puppeteerService.checkIfLoggedIn();
      return loggedIn;
    } catch (error: any) {
      this.logger.debug('Connection test failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get account info - scraped from page
   */
  async getAccountInfo(accessToken: string): Promise<PlatformAccountInfo> {
    try {
      // For Xiaohongshu, we'd need to navigate to profile page and scrape info
      // Simplified: return minimal info
      this.logger.debug('Getting account info', { platform: this.platform });
      
      // In a full implementation, we would:
      // 1. Navigate to profile page
      // 2. Extract username, display name, avatar
      // But for now, return placeholder based on any previous data or default
      return {
        platformAccountId: 'xhs-unknown',
        platformUsername: 'xiaohongshu_user',
        platformDisplayName: 'Xiaohongshu User',
        profileUrl: 'https://www.xiaohongshu.com',
      };
    } catch (error: any) {
      this.logger.error('Failed to get account info', { error: error.message });
      return {
        platformAccountId: 'unknown',
        platformUsername: 'unknown',
      };
    }
  }

  /**
   * Helper: Login via cookie string (for session restoration)
   */
  private async loginWithCookie(cookie: string): Promise<void> {
    // Parse cookie string (e.g., "name=value; name2=value2")
    const cookies = cookie.split(';').map(pair => {
      const [name, value] = pair.trim().split('=');
      return { name, value };
    });

    // Set cookies in browser context
    await this.puppeteerService.setCookies(cookies as any);
    
    // Verify by navigating to a page
    await this.puppeteerService.navigateTo('https://www.xiaohongshu.com/explore');
    await this.puppeteerService.waitForNetworkIdle(5000);

    const loggedIn = await this.puppeteerService.checkIfLoggedIn();
    if (!loggedIn) {
      throw new Error('Cookie login failed - not logged in after setting cookies');
    }
  }
}

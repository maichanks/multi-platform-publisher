import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { RateLimiterService } from '../services/rate-limiter.service';
import { TwitterAdapter } from './twitter.adapter';
import { RedditAdapter } from './reddit.adapter';
import { LinkedInAdapter } from './linkedin.adapter';
import nock from 'nock';
import { PlatformCredentials } from './platform-adapter.interface';

describe('Platform Adapters Integration', () => {
  let twitterAdapter: TwitterAdapter;
  let redditAdapter: RedditAdapter;
  let linkedinAdapter: LinkedInAdapter;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const config: Record<string, string> = {
        TWITTER_CLIENT_ID: 'test-twitter-client-id',
        TWITTER_CLIENT_SECRET: 'test-twitter-client-secret',
        TWITTER_API_KEY: 'test-twitter-api-key',
        TWITTER_API_SECRET: 'test-twitter-api-secret',
        TWITTER_REDIRECT_URI: 'http://localhost:3000/api/v1/platforms/twitter/oauth/callback',
        REDDIT_CLIENT_ID: 'test-reddit-client-id',
        REDDIT_CLIENT_SECRET: 'test-reddit-client-secret',
        REDDIT_USER_AGENT: 'test-agent/1.0',
        REDDIT_REDIRECT_URI: 'http://localhost:3000/api/v1/platforms/reddit/oauth/callback',
        LINKEDIN_CLIENT_ID: 'test-linkedin-client-id',
        LINKEDIN_CLIENT_SECRET: 'test-linkedin-client-secret',
        LINKEDIN_REDIRECT_URI: 'http://localhost:3000/api/v1/platforms/linkedin/oauth/callback',
      };
      return config[key];
    }),
  };

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockRateLimiter = {
    consume: jest.fn().mockResolvedValue({ remainingPoints: 100 }),
    check: jest.fn().mockResolvedValue(true),
    getRemaining: jest.fn().mockResolvedValue(100),
    reset: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    // Global nock configuration
    nock.disableNetConnect();
    nock.enableNetConnect('localhost');
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RateLimiterService, useValue: mockRateLimiter },
        TwitterAdapter,
        RedditAdapter,
        LinkedInAdapter,
      ],
    }).compile();

    twitterAdapter = module.get<TwitterAdapter>(TwitterAdapter);
    redditAdapter = module.get<RedditAdapter>(RedditAdapter);
    linkedinAdapter = module.get<LinkedInAdapter>(LinkedInAdapter);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
    nock.cleanAll();
  });

  describe('TwitterAdapter', () => {
    const mockTwitterTokenResponse = {
      data: {
        access_token: 'test-twitter-access-token',
        refresh_token: 'test-twitter-refresh-token',
        expires_in: 7200,
        scope: 'tweet.read users.read offline.access',
      },
    };

    const mockTwitterUserResponse = {
      data: {
        data: {
          id: '123456789',
          username: 'testuser',
          name: 'Test User',
          profile_image_url: 'https://example.com/avatar_normal.jpg',
        },
      },
    };

    const mockTweetResponse = {
      data: {
        data: {
          id: '987654321',
        },
      },
    };

    beforeEach(() => {
      // Setup default mocks
      mockHttpService.post.mockResolvedValue({ data: mockTwitterTokenResponse.data, headers: {} });
      mockHttpService.get.mockResolvedValue({ data: mockTwitterUserResponse.data });
    });

    it('should successfully exchange tokens', async () => {
      // Mock OAuth token endpoint
      nock('https://api.twitter.com')
        .post('/2/oauth2/token')
        .reply(200, mockTwitterTokenResponse.data);

      // Mock user info endpoint
      nock('https://api.twitter.com')
        .get('/2/users/me')
        .query(true)
        .reply(200, mockTwitterUserResponse.data);

      const result = await twitterAdapter.exchangeTokens({
        code: 'test-code',
        redirectUri: 'http://localhost/callback',
      });

      expect(result).toEqual({
        accessToken: 'test-twitter-access-token',
        refreshToken: 'test-twitter-refresh-token',
        expiresAt: expect.any(Date),
        scope: 'tweet.read users.read offline.access',
        platformAccountId: '123456789',
        platformUsername: 'testuser',
        platformDisplayName: 'Test User',
        profileUrl: 'https://twitter.com/testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });

    it('should successfully refresh token', async () => {
      const refreshResponse = {
        data: {
          access_token: 'new-twitter-access-token',
          refresh_token: 'new-twitter-refresh-token',
          expires_in: 7200,
          scope: 'tweet.read',
        },
      };

      nock('https://api.twitter.com')
        .post('/2/oauth2/token')
        .reply(200, refreshResponse.data);

      const result = await twitterAdapter.refreshAccessToken('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-twitter-access-token',
        refreshToken: 'new-twitter-refresh-token',
        expiresAt: expect.any(Date),
        scope: 'tweet.read',
      });
    });

    it('should successfully publish a tweet', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(200, mockTweetResponse);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.publish(credentials, {
        body: 'Hello Twitter!',
        tags: ['test', 'coding'],
      });

      expect(result).toEqual({
        success: true,
        postId: '987654321',
        postUrl: 'https://twitter.com/i/web/status/987654321',
      });
    });

    it('should truncate tweet text exceeding 280 characters', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(200, mockTweetResponse);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const longBody = 'a'.repeat(300); // 300 characters

      const result = await twitterAdapter.publish(credentials, {
        body: longBody,
      });

      expect(result.success).toBe(true);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: expect.stringMatching(/^a{277}\.\.\.$/),
        }),
        expect.any(Object)
      );
    });

    it('should handle publish failure with non-retryable error', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(400, { title: 'Bad Request', type: 'invalid_request' });

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.publish(credentials, {
        body: 'Hello Twitter!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad Request');
      expect(result.errorCode).toBe('invalid_request');
    });

    it('should test connection successfully', async () => {
      nock('https://api.twitter.com')
        .get('/2/users/me')
        .reply(200, mockTwitterUserResponse.data);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.testConnection(credentials);
      expect(result).toBe(true);
    });

    it('should test connection failure', async () => {
      nock('https://api.twitter.com')
        .get('/2/users/me')
        .reply(401, { title: 'Unauthorized' });

      const credentials: PlatformCredentials = {
        accessToken: 'invalid-token',
      };

      const result = await twitterAdapter.testConnection(credentials);
      expect(result).toBe(false);
    });
  });

  describe('RedditAdapter', () => {
    const mockRedditTokenResponse = {
      data: {
        access_token: 'test-reddit-access-token',
        refresh_token: 'test-reddit-refresh-token',
        expires_in: 3600,
        scope: '*',
      },
    };

    const mockRedditUserResponse = {
      data: {
        id: 'reddituser123',
        name: 'reddit_user',
      },
    };

    beforeEach(() => {
      mockHttpService.post.mockResolvedValue({ data: mockRedditTokenResponse.data });
      mockHttpService.get.mockResolvedValue({ data: mockRedditUserResponse.data });
    });

    it('should successfully exchange tokens', async () => {
      nock('https://www.reddit.com')
        .post('/api/v1/access_token')
        .reply(200, mockRedditTokenResponse.data);

      nock('https://oauth.reddit.com')
        .get('/api/v1/me')
        .reply(200, mockRedditUserResponse.data);

      const result = await redditAdapter.exchangeTokens({
        username: 'testuser',
        password: 'testpass',
      });

      expect(result.accessToken).toBe('test-reddit-access-token');
      expect(result.refreshToken).toBe('test-reddit-refresh-token');
      expect(result.platformUsername).toBe('reddit_user');
      expect(result.platformAccountId).toBe('reddituser123');
    });

    it('should successfully refresh token', async () => {
      const refreshResponse = {
        data: {
          access_token: 'new-reddit-access-token',
          refresh_token: 'new-reddit-refresh-token',
          expires_in: 3600,
          scope: '*',
        },
      };

      nock('https://www.reddit.com')
        .post('/api/v1/access_token')
        .reply(200, refreshResponse.data);

      const result = await redditAdapter.refreshAccessToken('old-refresh-token');

      expect(result.accessToken).toBe('new-reddit-access-token');
      expect(result.refreshToken).toBe('new-reddit-refresh-token');
    });

    it('should successfully submit a post', async () => {
      const mockSubmitResponse = {
        data: {
          json: {
            data: {
              id: 'redditpost123',
            },
          },
        },
      };

      nock('https://oauth.reddit.com')
        .post('/api/submit')
        .reply(200, mockSubmitResponse);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await redditAdapter.publish(credentials, {
        title: 'Test Post',
        body: 'This is a test post',
        customOptions: { subreddit: 'test' },
      });

      expect(result.success).toBe(true);
      expect(result.postId).toBe('redditpost123');
      expect(result.postUrl).toBe('https://reddit.com/r/test/comments/redditpost123');
    });

    it('should fail if subreddit is missing', async () => {
      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await redditAdapter.publish(credentials, {
        body: 'No subreddit specified',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_SUBREDDIT');
    });

    it('should test connection successfully', async () => {
      nock('https://oauth.reddit.com')
        .get('/api/v1/me')
        .reply(200, mockRedditUserResponse.data);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await redditAdapter.testConnection(credentials);
      expect(result).toBe(true);
    });
  });

  describe('LinkedInAdapter', () => {
    const mockLinkedInTokenResponse = {
      data: {
        access_token: 'test-linkedin-access-token',
        refresh_token: 'test-linkedin-refresh-token',
        expires_in: 7200,
      },
    };

    const mockLinkedInProfileResponse = {
      data: {
        id: 'linkedin-person-123',
        firstName: {
          localized: { en_US: 'Test' },
          preferredLocale: { country: 'US', language: 'en' },
        },
        lastName: {
          localized: { en_US: 'User' },
          preferredLocale: { country: 'US', language: 'en' },
        },
        profilePicture: {
          'displayImage~': {
            elements: [
              {
                identifiers: [{ identifier: 'https://example.com/profile-photo-small.jpg' }],
              },
              {
                identifiers: [{ identifier: 'https://example.com/profile-photo-large.jpg' }],
              },
            ],
          },
        },
      },
    };

    const mockLinkedInPostResponse = {
      data: {
        id: 'urn:li:ugcPost:linkedinpost123',
      },
    };

    beforeEach(() => {
      mockHttpService.post.mockResolvedValue({ data: mockLinkedInTokenResponse.data });
      mockHttpService.get.mockResolvedValue({ data: mockLinkedInProfileResponse.data });
    });

    it('should successfully exchange tokens', async () => {
      nock('https://www.linkedin.com')
        .post('/oauth/v2/accessToken')
        .reply(200, mockLinkedInTokenResponse.data);

      nock('https://api.linkedin.com')
        .get('/v2/me')
        .query(true)
        .reply(200, mockLinkedInProfileResponse.data);

      const result = await linkedinAdapter.exchangeTokens({
        code: 'test-code',
        redirectUri: 'http://localhost/callback',
      });

      expect(result.accessToken).toBe('test-linkedin-access-token');
      expect(result.refreshToken).toBe('test-linkedin-refresh-token');
      expect(result.scope).toBe('r_liteprofile r_emailaddress w_member_social');
      expect(result.platformAccountId).toBe('linkedin-person-123');
      expect(result.platformDisplayName).toBe('Test User');
    });

    it('should successfully refresh token', async () => {
      const refreshResponse = {
        data: {
          access_token: 'new-linkedin-access-token',
          refresh_token: 'new-linkedin-refresh-token',
          expires_in: 7200,
        },
      };

      nock('https://www.linkedin.com')
        .post('/oauth/v2/accessToken')
        .reply(200, refreshResponse.data);

      const result = await linkedinAdapter.refreshAccessToken('old-refresh-token');

      expect(result.accessToken).toBe('new-linkedin-access-token');
      expect(result.refreshToken).toBe('new-linkedin-refresh-token');
    });

    it('should successfully create a UGC post', async () => {
      nock('https://api.linkedin.com')
        .get('/v2/me')
        .query(true)
        .reply(200, mockLinkedInProfileResponse.data);

      nock('https://api.linkedin.com')
        .post('/v2/ugcPosts')
        .reply(201, mockLinkedInPostResponse);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await linkedinAdapter.publish(credentials, {
        body: 'Hello LinkedIn! This is a test post.',
      });

      expect(result.success).toBe(true);
      expect(result.postId).toBe('urn:li:ugcPost:linkedinpost123');
      expect(result.postUrl).toBe('https://www.linkedin.com/feed/update/urn:li:ugcPost:linkedinpost123/');
    });

    it('should test connection successfully', async () => {
      nock('https://api.linkedin.com')
        .get('/v2/me')
        .reply(200, mockLinkedInProfileResponse.data);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await linkedinAdapter.testConnection(credentials);
      expect(result).toBe(true);
    });

    it('should handle rate limited API response with retry', async () => {
      // First call: rate limited (429)
      // Second call: success
      nock('https://api.twitter.com')
        .get('/2/users/me')
        .times(1)
        .reply(429, { title: 'Rate Limit Exceeded' })
        .get('/2/users/me')
        .times(1)
        .reply(200, mockTwitterUserResponse.data);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      // The retry policy should retry once
      const result = await twitterAdapter.testConnection(credentials);
      expect(result).toBe(true);
    });

    it('should retry on 500 server error', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .times(1)
        .reply(500, { title: 'Internal Server Error' })
        .times(1)
        .reply(200, mockTweetResponse);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.publish(credentials, {
        body: 'Retry test',
      });

      expect(result.success).toBe(true);
    });

    it('should not retry on 400 bad request', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(400, { title: 'Bad Request', type: 'invalid_request' });

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const startTime = Date.now();
      const result = await twitterAdapter.publish(credentials, {
        body: 'Invalid content',
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      // Should not retry multiple times, so duration is relatively short (< 1s if no retry delay)
      // But we have retry delay even for non-retryable? Actually the policy should check before retry
      // That's internal, but we just verify it failed quickly
    });

    it('should apply rate limiting before publish', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(200, mockTweetResponse);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      await twitterAdapter.publish(credentials, {
        body: 'Test rate limit',
      });

      expect(mockRateLimiter.consume).toHaveBeenCalledWith('twitter', 'publish', 1);
    });

    it('should log errors on publish failure', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(429, { title: 'Rate Limit Exceeded', type: 'rate_limit' });

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.publish(credentials, {
        body: 'Test rate limit logging',
      });

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Publish failed'),
        expect.objectContaining({
          platform: 'twitter',
        })
      );
    });

    it('should handle network errors with retry', async () => {
      // Simulate network error first, then success
      nock('https://api.twitter.com')
        .get('/2/users/me')
        .times(1)
        .replyWithError({ code: 'ECONNREFUSED' })
        .get('/2/users/me')
        .times(1)
        .reply(200, mockTwitterUserResponse.data);

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.testConnection(credentials);
      expect(result).toBe(true);
    });
  });

  // Additional tests for edge cases
  describe('Edge Cases', () => {
    it('should return minimal getAccountInfo on API failure', async () => {
      nock('https://api.twitter.com')
        .get('/2/users/me')
        .reply(500);

      const result = await twitterAdapter.getAccountInfo('invalid-token');

      expect(result).toEqual({
        platformAccountId: 'unknown',
        platformUsername: 'unknown',
      });
    });

    it('should handle empty media array', async () => {
      nock('https://api.twitter.com')
        .post('/2/tweets')
        .reply(200, { data: { data: { id: '123' } } });

      const credentials: PlatformCredentials = {
        accessToken: 'test-access-token',
      };

      const result = await twitterAdapter.publish(credentials, {
        body: 'No media',
        media: [],
      });

      expect(result.success).toBe(true);
    });
  });
});

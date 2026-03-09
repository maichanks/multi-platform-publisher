import { Test, TestingModule } from '@nestjs/testing';
import { SocialPlatformAdapterFactory } from './factory';
import { PlatformAdapter } from './platform-adapter.interface';
import { NotFoundException } from '@nestjs/common';

class MockAdapter implements PlatformAdapter {
  platform = 'mock';

  async exchangeTokens(connectionData: any) {
    return {
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      platformAccountId: '123',
      platformUsername: 'mockuser',
      platformDisplayName: 'Mock User',
      profileUrl: 'https://example.com/mockuser',
      avatarUrl: null,
      scope: 'read',
      expiresAt: new Date(Date.now() + 3600000),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: 'new-mock-token',
      refreshToken: 'new-mock-refresh',
      expiresAt: new Date(Date.now() + 7200000),
    };
  }

  async publish(content: any, tokens: any) {
    return { success: true, platformId: '123' };
  }
}

describe('SocialPlatformAdapterFactory', () => {
  let factory: SocialPlatformAdapterFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialPlatformAdapterFactory],
    }).compile();

    factory = module.get<SocialPlatformAdapterFactory>(SocialPlatformAdapterFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('getAdapter', () => {
    it('should return TwitterAdapter for twitter', () => {
      const adapter = factory.getAdapter('twitter');
      expect(adapter).toBeDefined();
      expect(adapter.platform).toBe('twitter');
    });

    it('should return LinkedInAdapter for linkedin', () => {
      const adapter = factory.getAdapter('linkedin');
      expect(adapter).toBeDefined();
      expect(adapter.platform).toBe('linkedin');
    });

    it('should return RedditAdapter for reddit', () => {
      const adapter = factory.getAdapter('reddit');
      expect(adapter).toBeDefined();
      expect(adapter.platform).toBe('reddit');
    });

    it('should return MockAdapter for mock', () => {
      const adapter = factory.getAdapter('mock');
      expect(adapter).toBeDefined();
      expect(adapter.platform).toBe('mock');
    });

    it('should throw NotFoundException for unsupported platform', () => {
      expect(() => factory.getAdapter('unsupported')).toThrow(NotFoundException);
    });

    it('should haveAdapter return true for supported platforms', () => {
      expect(factory.hasAdapter('twitter')).toBe(true);
      expect(factory.hasAdapter('linkedin')).toBe(true);
      expect(factory.hasAdapter('reddit')).toBe(true);
      expect(factory.hasAdapter('mock')).toBe(true);
    });

    it('should haveAdapter return false for unsupported platform', () => {
      expect(factory.hasAdapter('unknown')).toBe(false);
    });
  });
});

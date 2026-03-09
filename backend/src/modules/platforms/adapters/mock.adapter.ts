import { Injectable } from '@nestjs/common';
import { PlatformAdapter } from './platform-adapter.interface';

@Injectable()
export class MockAdapter implements PlatformAdapter {
  readonly platform = 'mock';

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

  async testConnection(credentials: any): Promise<boolean> {
    return true;
  }

  async getAccountInfo(accessToken: string) {
    return {
      platformAccountId: '123',
      platformUsername: 'mockuser',
      platformDisplayName: 'Mock User',
      profileUrl: 'https://example.com/mockuser',
    };
  }
}

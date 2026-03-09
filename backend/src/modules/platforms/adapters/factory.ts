import { Injectable, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { PlatformAdapter } from './platform-adapter.interface';
import { TwitterAdapter } from './twitter.adapter';
import { RedditAdapter } from './reddit.adapter';
import { LinkedInAdapter } from './linkedin.adapter';
import { MockAdapter } from './mock.adapter';

@Injectable()
export class SocialPlatformAdapterFactory {
  private adapters: Map<string, PlatformAdapter>;

  constructor(
    private readonly twitterAdapter: TwitterAdapter,
    private readonly redditAdapter: RedditAdapter,
    private readonly linkedinAdapter: LinkedInAdapter,
    private readonly mockAdapter: MockAdapter,
  ) {
    this.adapters = new Map([
      ['twitter', twitterAdapter],
      ['linkedin', linkedinAdapter],
      ['reddit', redditAdapter],
      ['mock', mockAdapter],
    ]);
  }

  getAdapter(platform: string): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      // Check if we have a dynamic implementation using require()
      try {
        // Dynamic import for optional adapters
        const dynamicAdapter = this.loadDynamicAdapter(platform);
        if (dynamicAdapter) {
          this.adapters.set(platform, dynamicAdapter);
          return dynamicAdapter;
        }
      } catch (e) {
        // Continue to error
      }

      throw new NotFoundException(`No adapter found for platform: ${platform}`);
    }
    return adapter;
  }

  hasAdapter(platform: string): boolean {
    return this.adapters.has(platform) || this.canLoadDynamicAdapter(platform);
  }

  private loadDynamicAdapter(platform: string): PlatformAdapter | null {
    const adapterMap: Record<string, string> = {
      xiaohongshu: './xiaohongshu.adapter',
      douyin: './douyin.adapter',
      youtube: './youtube.adapter',
      facebook: './facebook.adapter',
      instagram: './instagram.adapter',
      tiktok: './tiktok.adapter',
      weibo: './weibo.adapter',
    };

    const modulePath = adapterMap[platform];
    if (!modulePath) return null;

    // Check if file exists before attempting to import
    const fullPath = require('path').resolve(__dirname, modulePath);
    try {
      require('fs').accessSync(fullPath, require('fs').constants.R_OK);
      const mod = require(modulePath);
      return new mod.default || mod;
    } catch (e) {
      return null;
    }
  }

  private canLoadDynamicAdapter(platform: string): boolean {
    try {
      return this.loadDynamicAdapter(platform) !== null;
    } catch {
      return false;
    }
  }
}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SocialPlatformAdapterFactory } from './adapters/factory';
import { TwitterAdapter } from './adapters/twitter.adapter';
import { RedditAdapter } from './adapters/reddit.adapter';
import { LinkedInAdapter } from './adapters/linkedin.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { XiaohongshuAdapter } from './adapters/xiaohongshu.adapter';
import { RateLimiterService } from './services/rate-limiter.service';
import { BrowserAutomationModule } from '../browser-automation/browser-automation.module';

@Module({
  imports: [HttpModule, ConfigModule, BrowserAutomationModule],
  providers: [
    TwitterAdapter,
    RedditAdapter,
    LinkedInAdapter,
    MockAdapter,
    XiaohongshuAdapter,
    RateLimiterService,
    SocialPlatformAdapterFactory,
  ],
  exports: [SocialPlatformAdapterFactory],
})
export class PlatformsModule {}

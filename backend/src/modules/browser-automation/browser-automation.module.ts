import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PuppeteerService } from './puppeteer.service';

/**
 * Browser Automation Module
 * 
 * Provides Puppeteer-based browser automation for platforms
 * requiring UI-based interactions (e.g., Xiaohongshu, TikTok)
 * 
 * Features:
 * - Lazy browser initialization
 * - Multiple selector strategies with fallbacks
 * - Session persistence (optional)
 * - Resource optimization (blocking unnecessary assets)
 * 
 * Configuration (.env):
 * - PUPPETEER_EXECUTABLE_PATH: Path to Chrome/Chromium
 * - PUPPETEER_HEADLESS: 'true' (default) or 'false'
 * - PUPPETEER_ARGS: JSON array of launch arguments
 * - PUPPETEER_USER_DATA_DIR: Path for persistent profile
 * - PUPPETEER_RESOURCE_LOGGING: 'true' to log all resources
 */
@Global() // Make PuppeteerService available globally
@Module({
  imports: [ConfigModule],
  providers: [PuppeteerService],
  exports: [PuppeteerService],
})
export class BrowserAutomationModule {}

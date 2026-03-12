import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as puppeteer from 'puppeteer';
import {
  xhsSelectors,
  findElementWithFallbacks,
  waitForPageLoad,
  PageSelectors,
  ElementConfig
} from './selectors/xhs.selectors';

/**
 * Browser automation service using Puppeteer
 * Handles Xiaohongshu login and post creation via UI automation
 */
@Injectable()
export class PuppeteerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerService.name);
  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // Defer initialization to first use (lazy loading)
    this.logger.log('PuppeteerService module initialized (lazy load)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Initialize browser instance
   * Configurable via environment variables:
   * - PUPPETEER_EXECUTABLE_PATH: Path to Chrome/Chromium executable
   * - PUPPETEER_HEADLESS: 'true' (default) or 'false'
   * - PUPPETEER_ARGS: JSON array of additional launch arguments
   */
  private async ensureBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.isInitialized) {
      return this.browser;
    }

    // Avoid multiple concurrent initializations
    if (!this.initPromise) {
      this.initPromise = this.initializeBrowser();
    }

    return this.initPromise;
  }

  private async initializeBrowser(): Promise<puppeteer.Browser> {
    this.logger.log('Initializing Puppeteer browser...');

    const headless = this.configService.get('PUPPETEER_HEADLESS') !== 'false';
    const executablePath = this.configService.get('PUPPETEER_EXECUTABLE_PATH') || undefined;
    const argsJson = this.configService.get('PUPPETEER_ARGS');
    const defaultArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1366,768',
    ];

    const launchArgs: puppeteer.LaunchOptions = {
      headless,
      executablePath,
      args: defaultArgs,
      defaultViewport: { width: 1366, height: 768 },
    };

    // Add custom args if provided
    if (argsJson) {
      try {
        const customArgs = JSON.parse(argsJson);
        launchArgs.args.push(...customArgs);
      } catch (e) {
        this.logger.warn(`Failed to parse PUPPETEER_ARGS: ${e.message}`);
      }
    }

    // Set up user data directory for persistent sessions (optional)
    const userDataDir = this.configService.get('PUPPETEER_USER_DATA_DIR');
    if (userDataDir) {
      launchArgs.userDataDir = userDataDir;
    }

    try {
      this.browser = await puppeteer.launch(launchArgs);
      this.page = await this.browser.newPage();
      
      // Set realistic user agent
      await this.page.setUserAgent(this.getRandomUserAgent());
      
      // Set viewport
      await this.page.setViewport({ width: 1366, height: 768 });
      
      // Block resources we don't need (speeds up page loads)
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType) && !this.configService.get('PUPPETEER_RESOURCE_LOGGING')) {
          request.abort();
        } else {
          request.continue();
        }
      });

      this.isInitialized = true;
      this.logger.log('Puppeteer browser initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize Puppeteer browser', { error: error.message });
      throw error;
    }

    return this.browser;
  }

  /**
   * Navigate to URL with retry logic
   */
  async navigateTo(url: string, timeout: number = 30000): Promise<void> {
    const browser = await this.ensureBrowser();
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.logger.log(`Navigating to: ${url}`);
    
    try {
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout,
      });
    } catch (error: any) {
      // Retry once on timeout
      if (error.message.includes('Timeout')) {
        this.logger.warn(`Navigation timeout, retrying: ${url}`);
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      } else {
        throw error;
      }
    }
  }

  /**
   * Login to Xiaohongshu using phone number and verification code
   */
  async loginWithPhone(
    phone: string, 
    verificationCode: string,
    countryCode: string = '+86'
  ): Promise<boolean> {
    this.logger.log('Starting Xiaohongshu login with phone', { phone: phone.slice(0, 3) + '***' });

    const browser = await this.ensureBrowser();
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Navigate to Xiaohongshu login page
      await this.navigateTo('https://www.xiaohongshu.com/explore');
      
      // Check if we're already logged in (look for user avatar or specific page)
      const isLoggedIn = await this.checkIfLoggedIn();
      if (isLoggedIn) {
        this.logger.log('Already logged in to Xiaohongshu');
        return true;
      }

      // Wait for page to load
      const loaded = await waitForPageLoad(this.page, xhsSelectors, 'login', this.logger, 30000);
      if (!loaded) {
        throw new Error('Login page did not load properly');
      }

      // Try to switch to phone login if QR code is shown
      try {
        const switchBtn = await findElementWithFallbacks(this.page, xhsSelectors.login.switchToPhoneLogin, this.logger);
        if (switchBtn) {
          await switchBtn.click();
          await this.page.waitForTimeout(2000);
        }
      } catch {
        // Switch button not found, assuming we're already on phone login
      }

      // Fill country code (if selector exists)
      try {
        const countrySelector = xhsSelectors.login.countryCodeSelector;
        if (countrySelector) {
          const countryEl = await findElementWithFallbacks(this.page, countrySelector, this.logger);
          if (countryEl) {
            await countryEl.click();
            await this.page.waitForTimeout(1000);
            // Select country code - simplified, would need actual dropdown interaction
            await this.page.keyboard.type(countryCode.replace('+', ''));
          }
        }
      } catch (e) {
        this.logger.warn('Country code selector not found or failed', { error: e.message });
      }

      // Fill phone number
      const phoneInput = await findElementWithFallbacks(this.page, xhsSelectors.login.phoneInput, this.logger);
      await phoneInput.click();
      await phoneInput.clear();
      await phoneInput.type(phone);
      this.logger.debug('Phone number entered');

      // Click "Get Verification Code" button
      const getCodeBtn = await findElementWithFallbacks(this.page, xhsSelectors.login.getVerificationCodeBtn, this.logger);
      await getCodeBtn.click();
      this.logger.log('Verification code requested');

      // Wait a moment for code to be sent (in real scenario, user provides code)
      await this.page.waitForTimeout(2000);

      // Fill verification code
      const codeInput = await findElementWithFallbacks(this.page, xhsSelectors.login.verificationCodeInput, this.logger);
      await codeInput.click();
      await codeInput.clear();
      await codeInput.type(verificationCode);
      this.logger.debug('Verification code entered');

      // Click login button
      const loginBtn = await findElementWithFallbacks(this.page, xhsSelectors.login.loginBtn, this.logger);
      await loginBtn.click();
      this.logger.log('Login submitted');

      // Wait for login to complete (check for success indicator or error)
      await this.page.waitForTimeout(5000);

      // Verify login success
      const success = await this.checkIfLoggedIn();
      
      if (success) {
        this.logger.log('Xiaohongshu login successful');
      } else {
        // Check for error message
        try {
          const errorEl = await findElementWithFallbacks(this.page, xhsSelectors.login.errorMessage, this.logger);
          if (errorEl) {
            const errorText = await this.page.evaluate(el => el.textContent, errorEl);
            this.logger.error('Login failed with error', { error: errorText });
            throw new Error(`Login failed: ${errorText}`);
          }
        } catch {
          // No error element found
        }
        throw new Error('Login failed: Unknown reason');
      }

      return success;
    } catch (error: any) {
      this.logger.error('Xiaohongshu login failed', { error: error.message });
      return false;
    }
  }

  /**
   * Check if currently logged in to Xiaohongshu
   */
  async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Multiple indicators of logged-in state:
      // 1. URL contains /explore or /profile but not login
      const url = this.page.url();
      if (url.includes('login') || url.includes('signin')) {
        return false;
      }

      // 2. Look for user avatar/menu
      const userMenuSelectors = [
        '[class*="Avatar"]',
        '[class*="avatar"]',
        '[class*="User"]',
        '[class*="Profile"]',
        '[class*="Menu"]',
      ];

      for (const selector of userMenuSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) return true;
        } catch {
          continue;
        }
      }

      // 3. Check for absence of login elements
      try {
        const loginBtn = await this.page.$('[class*="login"], button:has-text("登录")');
        if (loginBtn) return false;
      } catch {
        // No login button found, likely logged in
        return true;
      }

      return false;
    } catch (error: any) {
      this.logger.debug('Error checking login status', { error: error.message });
      return false;
    }
  }

  /**
   * Create a new post on Xiaohongshu
   */
  async createPost(
    title: string,
    content: string,
    imageUrls?: string[],
    tags?: string[],
    location?: string,
    privacy: 'public' | 'private' | 'friends' = 'public'
  ): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
    this.logger.log('Creating Xiaohongshu post', { title: title.substring(0, 50) });

    if (!this.page) {
      throw new Error('Browser not initialized. Please login first.');
    }

    try {
      // Navigate to create post page
      await this.navigateTo('https://www.xiaohongshu.com/explore/create');
      
      // Wait for page to load
      const loaded = await waitForPageLoad(this.page, xhsSelectors, 'createPost', this.logger, 30000);
      if (!loaded) {
        throw new Error('Create post page did not load properly');
      }

      // Handle any cookie banners or popups
      await this.dismissPopups();

      // Fill title
      if (title) {
        const titleInput = await findElementWithFallbacks(this.page, xhsSelectors.createPost.titleInput, this.logger);
        await titleInput.click();
        await titleInput.clear();
        await titleInput.type(title);
        this.logger.debug('Title entered');
      }

      // Fill content
      if (content) {
        const contentInput = await findElementWithFallbacks(this.page, xhsSelectors.createPost.contentTextarea, this.logger);
        await contentInput.click();
        await contentInput.clear();
        await contentInput.type(content);
        this.logger.debug('Content entered');
        // Wait a moment for any auto-save or validation
        await this.page.waitForTimeout(1000);
      }

      // Upload images (if provided)
      if (imageUrls && imageUrls.length > 0) {
        for (const imageUrl of imageUrls) {
          await this.uploadImage(imageUrl);
        }
        this.logger.debug(`Uploaded ${imageUrls.length} image(s)`);
      }

      // Add tags (if provided)
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await this.addTag(tag);
        }
        this.logger.debug(`Added ${tags.length} tag(s)`);
      }

      // Set location (if provided)
      if (location) {
        await this.setLocation(location);
        this.logger.debug(`Set location: ${location}`);
      }

      // Set privacy (if not default public)
      if (privacy !== 'public') {
        await this.setPrivacy(privacy);
        this.logger.debug(`Set privacy: ${privacy}`);
      }

      // Click publish button
      const submitBtn = await findElementWithFallbacks(this.page, xhsSelectors.createPost.submitBtn, this.logger);
      await submitBtn.click();
      this.logger.log('Publish button clicked');

      // Wait for publish to complete
      await this.page.waitForTimeout(5000);

      // Check for success
      try {
        const successModal = await findElementWithFallbacks(this.page, xhsSelectors.createPost.successModal, this.logger);
        if (successModal) {
          const successText = await this.page.evaluate(el => el.textContent, successModal);
          if (successText && successText.includes('成功')) {
            // Extract post ID from URL or page content
            const postUrl = this.page.url();
            const postIdMatch = postUrl.match(/\/([^\/]+)$/);
            const postId = postIdMatch ? postIdMatch[1] : `xhs_${Date.now()}`;
            
            this.logger.log('Post published successfully', { postId, postUrl });
            return { success: true, postId, postUrl };
          }
        }
      } catch {
        // No success modal found
      }

      // Check for validation errors
      try {
        const errorEl = await findElementWithFallbacks(this.page, xhsSelectors.createPost.validationError, this.logger);
        if (errorEl) {
          const errorText = await this.page.evaluate(el => el.textContent, errorEl);
          this.logger.error('Post validation failed', { error: errorText });
          return { success: false, error: errorText };
        }
      } catch {
        // No validation error found
      }

      // Assume success if no errors and we're redirected
      const currentUrl = this.page.url();
      if (currentUrl.includes('/explore/') || currentUrl.includes('/profile/')) {
        return { success: true, postUrl: currentUrl };
      }

      throw new Error('Unknown publish result');
    } catch (error: any) {
      this.logger.error('Failed to create post', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload a single image to Xiaohongshu.
   * If imageUrl is a remote URL, it will be downloaded to a temporary file first.
   */
  private async uploadImage(imageUrl: string): Promise<void> {
    try {
      let filePath = imageUrl;
      // If imageUrl is a remote URL, download it to a temp file
      if (imageUrl.startsWith('http')) {
        filePath = await this.downloadImageToTemp(imageUrl);
      }

      // Find the upload input (typically hidden file input)
      const uploadInput = await findElementWithFallbacks(this.page, xhsSelectors.createPost.imageUpload, this.logger);
      
      if (!uploadInput) {
        throw new Error('Image upload element not found');
      }

      // Check if it's a file input
      const tagName = await this.page.evaluate(el => el.tagName, uploadInput);
      const inputType = await this.page.evaluate(el => el.type, uploadInput);
      
      if (tagName === 'INPUT' && inputType === 'file') {
        // Use setInputFiles to upload the file (works with local paths)
        await this.page.setInputFiles(uploadInput, filePath);
      } else {
        // If not a file input, click to trigger file dialog and then set files via page.waitForFileChooser?
        // Fallback: try to click and then use page.setInputFiles on the opened dialog's input (not straightforward)
        // For simplicity, we assume it's a file input or we can directly set files.
        this.logger.warn('Upload element is not a file input; attempting to set files directly anyway');
        await this.page.setInputFiles(uploadInput, filePath);
      }

      // If we downloaded a temp file, clean up after a short delay
      if (filePath !== imageUrl && filePath.startsWith(os.tmpdir())) {
        // Wait a bit to ensure upload completed
        setTimeout(() => {
          fs.unlink(filePath, err => {
            if (err) this.logger.warn('Failed to delete temp image', err);
          });
        }, 5000); // delete after 5 seconds
      }

      this.logger.debug('Image uploaded successfully', { imageUrl });
    } catch (error: any) {
      this.logger.error('Image upload failed', { error: error.message, imageUrl });
      throw error;
    }
  }

  /**
   * Add a tag to the post
   */
  private async addTag(tag: string): Promise<void> {
    try {
      // First, try to find tag input
      const tagInput = await findElementWithFallbacks(this.page, xhsSelectors.createPost.tagInput, this.logger);
      
      if (tagInput) {
        await tagInput.click();
        await tagInput.clear();
        await tagInput.type(tag);
        await this.page.waitForTimeout(1000);

        // Try to select from suggestions if available
        try {
          const suggestedTags = await findElementWithFallbacks(this.page, xhsSelectors.createPost.suggestedTags, this.logger);
          if (suggestedTags) {
            // Click first suggested tag
            const firstTag = await suggestedTags.$('div, span, button');
            if (firstTag) {
              await firstTag.click();
              return;
            }
          }
        } catch {
          // No suggestions found, try pressing Enter
        }

        // Press Enter to add tag
        await tagInput.press('Enter');
        await this.page.waitForTimeout(500);
      }
    } catch (error: any) {
      this.logger.error('Failed to add tag', { tag, error: error.message });
      // Don't throw - tag is optional
    }
  }

  /**
   * Set location/topic for the post
   */
  private async setLocation(location: string): Promise<void> {
    try {
      const locationSelector = xhsSelectors.createPost.locationSelector;
      if (!locationSelector) return;

      const locEl = await findElementWithFallbacks(this.page, locationSelector, this.logger);
      if (!locEl) return;

      await locEl.click();
      await this.page.waitForTimeout(1000);

      // Type location and select from dropdown
      await this.page.keyboard.type(location);
      await this.page.waitForTimeout(1000);

      // Select first result from dropdown (simplified)
      await this.page.keyboard.press('Enter');
    } catch (error: any) {
      this.logger.warn('Failed to set location', { location, error: error.message });
    }
  }

  /**
   * Set privacy/visibility for the post
   */
  private async setPrivacy(privacy: 'public' | 'private' | 'friends'): Promise<void> {
    try {
      const privacySelector = xhsSelectors.createPost.privacySelector;
      if (!privacySelector) return;

      const privacyEl = await findElementWithFallbacks(this.page, privacySelector, this.logger);
      if (!privacyEl) return;

      await privacyEl.click();
      await this.page.waitForTimeout(1000);

      // Map privacy to expected button text
      const privacyMap = {
        'public': '公开',
        'private': '私密',
        'friends': '好友可见'
      };

      const targetText = privacyMap[privacy];
      if (!targetText) return;

      // Find and click the privacy option
      await this.page.click(`text="${targetText}"`, { timeout: 5000 }).catch(() => {
        // Alternative: use text-based selector
        return this.page.evaluate((text) => {
          const elements = Array.from(document.querySelectorAll('button, div, li'));
          return elements.find(el => el.textContent?.trim() === text);
        }, targetText) as any;
      });
    } catch (error: any) {
      this.logger.warn('Failed to set privacy', { privacy, error: error.message });
    }
  }

  /**
   * Dismiss common popups (cookies, notifications, etc.)
   */
  private async dismissPopups(): Promise<void> {
    const popups = [
      xhsSelectors.common.cookieBanner,
      xhsSelectors.common.closeModalBtn,
    ];

    for (const popup of popups) {
      if (!popup) continue;
      
      try {
        const popupEl = await findElementWithFallbacks(this.page, popup, this.logger);
        if (popupEl) {
          // If it's a close button, click it
          if (popup === xhsSelectors.common.closeModalBtn) {
            await popupEl.click();
          } else {
            // For cookie banners, try to find and click "Accept" or "Close"
            const acceptBtn = await popupEl.$('button:has-text("接受")');
            if (!acceptBtn) {
              await popupEl.$('button:has-text("同意")');
            }
            if (acceptBtn) {
              await acceptBtn.click();
            }
          }
          await this.page.waitForTimeout(1000);
        }
      } catch {
        // Popup not present, continue
      }
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(path?: string): Promise<Buffer> {
    const browser = await this.ensureBrowser();
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    if (path) {
      return this.page.screenshot({ path, fullPage: true });
    }
    return this.page.screenshot({ fullPage: true });
  }

  /**
   * Get current page content (HTML)
   */
  async getPageContent(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    return this.page.content();
  }

  /**
   * Execute custom script in page context
   */
  async evaluate(pageFunction: (...args: any[]) => any, ...args: any[]): Promise<any> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    return this.page.evaluate(pageFunction, ...args);
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        this.logger.log('Browser closed');
      }
    } catch (error: any) {
      this.logger.error('Error during cleanup', { error: error.message });
    }
  }

  /**
   * Force cleanup and reinitialization (useful for recovery)
   */
  async reset(): Promise<void> {
    await this.cleanup();
    this.initPromise = null;
    this.logger.log('PuppeteerService reset - will reinitialize on next use');
  }

  /**
   * Get random user agent to avoid detection
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(timeout: number = 30000): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.waitForNetworkIdle({
      idleTime: 1000,
      timeout,
    });
  }

  /**
   * Get cookies for current page (useful for session persistence)
   */
  async getCookies(): Promise<puppeteer.Cookie[]> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    return this.page.cookies();
  }

  /**
   * Set cookies (for session restoration)
   */
  async setCookies(cookies: puppeteer.Cookie[]): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    await this.page.setCookie(...cookies);
  }
}

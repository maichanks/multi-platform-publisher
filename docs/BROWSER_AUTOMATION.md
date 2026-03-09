# Browser Automation Guide

## Overview

The Multi-Platform Publisher includes a browser automation module for platforms that require UI-based interaction instead of API access. Currently, this is used for **Xiaohongshu (Little Red Book)**.

The browser automation is built on **Puppeteer**, which controls a headless Chrome/Chromium instance to navigate websites, fill forms, and submit content programmatically.

## Features

- **Robust element selection** using multiple fallback strategies (CSS selectors, XPath, text matching, custom functions)
- **Lazy browser initialization** to save resources
- **Session persistence** via cookies or storage
- **Rate limit friendly** with configurable delays and batch scheduling
- **Comprehensive error handling** and retry logic
- **Resource optimization** (blocks unnecessary assets for faster loads)

## Architecture

```
┌─────────────────────────────────────────────┐
│          Controller / API Layer             │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│    XiaohongshuPublisherService             │
│  (Batch scheduling, queuing, progress)    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│      XiaohongshuAdapter                    │
│  (PlatformAdapter interface)              │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│       PuppeteerService                     │
│  (Browser control, selectors, helpers)    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│           Chrome / Chromium                │
└─────────────────────────────────────────────┘
```

## Installation

### Prerequisites

1. **Node.js** (v16+ recommended)
2. **Chrome or Chromium** installed on the system

#### Install Chrome (Ubuntu/Debian):
```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install google-chrome-stable
```

#### Install Chromium (alternative):
```bash
sudo apt-get install chromium-browser
```

3. **Puppeteer NPM package** (included in dependencies)

```bash
npm install puppeteer
```

### Environment Variables

Configure browser automation in your `.env` file:

```env
# Puppeteer Settings
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable  # Path to Chrome/Chromium
PUPPETEER_HEADLESS=true                                   # Run in headless mode (default: true)
PUPPETEER_ARGS=[]                                         # Additional launch arguments (JSON array)
PUPPETEER_USER_DATA_DIR=./chrome-profile                 # Optional: persistent profile directory
PUPPETEER_RESOURCE_LOGGING=false                          # Set true to log all network resources

# Xiaohongshu Specific
XHS_PREINIT_BROWSER=false                                # Pre-initialize browser on module load
XHS_AUTO_PROCESS_QUEUE=true                              # Auto-start batch job processor

# Rate Limiting (these are in rate-limiter service but affect publisher)
XHS_RATE_LIMIT_DELAY=5000                                # Minimum delay between posts (ms)
XHS_BATCH_CONCURRENCY=1                                  # Concurrent publishes (usually 1)
```

### Launch Arguments (PUPPETEER_ARGS)

Common arguments to pass:

```json
[
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu",
  "--window-size=1366,768",
  "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]
```

## Usage

### 1. Connecting a Xiaohongshu Account

Use the `/social-accounts/:platform/connect` endpoint with the appropriate credentials:

#### Phone Login (recommended for automation)

```bash
curl -X POST http://localhost:3000/api/v1/social-accounts/xiaohongshu/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "phone": "+8613900000000",
    "verificationCode": "123456",
    "countryCode": "+86"
  }'
```

The system will:
1. Launch browser (if not already)
2. Navigate to Xiaohongshu
3. Enter phone number and verification code
4. Store session cookies in the database

#### Cookie-Based Login (for restoring sessions)

```bash
curl -X POST http://localhost:3000/api/v1/social-accounts/xiaohongshu/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_123",
    "cookie": "session=abc123; webId=xyz789"
  }'
```

### 2. Publishing a Single Post

Use the generic publish endpoint (once account is connected):

```bash
curl -X POST http://localhost:3000/api/v1/workspaces/ws_123/posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "title": "My First Xiaohongshu Post",
      "body": "This is an automated post from the Multi-Platform Publisher!",
      "imageUrls": ["https://example.com/image1.jpg"],
      "tags": ["automation", "tech"]
    },
    "platforms": ["xiaohongshu"],
    "socialAccountIds": ["xhs_account_123"]
  }'
```

### 3. Batch Publishing

The XiaohongshuPublisherService supports batch publishing with configurable delays to avoid rate limiting.

#### Using the Service Programmatically

```typescript
import { XiaohongshuPublisherService } from './platforms/services/xiaohongshu.publisher.service';

const publisher = new XiaohongshuPublisherService(
  xiaohongshuAdapter,
  rateLimiter,
  configService,
);

const job = await publisher.publishBatch(
  {
    posts: [
      { title: 'Post 1', body: 'Content 1', tags: ['tech'] },
      { title: 'Post 2', body: 'Content 2', tags: ['life'] },
      { title: 'Post 3', body: 'Content 3', tags: ['food'] },
    ],
    credentials: { accessToken: 'xhs-session' },
  },
  {
    delayMs: 10000,        // Wait 10 seconds between posts
    stopOnFailure: false,  // Continue even if one post fails
  }
);

// Check job status
const status = await publisher.getJobStatus(job.id);
console.log(`Progress: ${status.progress.current}/${status.progress.total}`);
```

#### Scheduled Publishing

```typescript
const futureDate = new Date();
futureDate.setHours(futureDate.getHours() + 2); // 2 hours from now

const scheduledJob = await publisher.scheduleBatch(
  {
    posts: [...],
    credentials: {...},
  },
  futureDate
);
```

## Handling Errors

### Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| `Failed to launch the browser process` | Chrome not installed or wrong path | Set `PUPPETEER_EXECUTABLE_PATH` correctly; install Chrome |
| `Timeout - element not found` | Website UI changed, selectors outdated | Update selectors in `xhs.selectors.ts`; check for recent UI changes |
| `Login failed` | Wrong phone/code, or 2FA required | Verify credentials; check SMS code; ensure account can login manually |
| `Publish failed: validation error` | Missing required fields (title, content) | Ensure title is 1-30 chars, content meets Xiaohongshu guidelines |
| `Network error` | Intermittent connectivity | Retry with exponential backoff; check network |
| `Rate limit exceeded` | Too many posts too quickly | Increase `delayMs` in batch publish; respect Xiaohongshu limits |

### Logging

All browser automation operations are logged at appropriate levels:

- `log`: General progress (login start, publish success)
- `warn`: Recoverable issues (missing optional fields, fallback selectors)
- `error`: Failures (login failed, publish error, element not found)
- `debug`: Detailed selector attempts, timing info

Configure logging level in your NestJS logger configuration.

## Selector Fallback Strategy

The selectors are designed with multiple strategies to handle UI changes:

1. **Primary**: Test ID (data-testid) - most reliable
2. **Secondary**: CSS class (partial match) or attribute selectors
3. **Tertiary**: XPath with text content matching
4. **Fallback**: Custom JavaScript evaluation (heuristics)

When an element is not found with one strategy, the system automatically tries the next. Logs indicate which strategy succeeded.

## Testing

### Unit Tests

XiaohongshuAdapter tests are in `adapters.integration.spec.ts` (mocked PuppeteerService).

Run all tests:
```bash
npm run test
```

Run only Xiaohongshu tests:
```bash
npm run test -- --testNamePattern="XiaohongshuAdapter"
```

### Manual Testing

Use the `--dry-run` flag (if supported) to simulate publishing without actual browser actions:

```bash
# Dry run - no browser launched
curl -X POST ... -d '{"dryRun": true}'
```

## Rate Limiting

Xiaohongshu imposes rate limits on publishing. To avoid being banned:

- Minimum delay between posts: **5 seconds** (configurable)
- Maximum posts per day: Respect platform limits (tbd)
- Use batch scheduler for large volumes

The `RateLimiterService` uses a token bucket algorithm. Adjust limits in configuration:

```typescript
// Example rate limiter configuration (in rate-limiter.service.ts)
const RATE_LIMITS = {
  xiaohongshu: {
    publish: { points: 100, duration: 86400 }, // 100 posts per day
  },
};
```

## Browser Automation Best Practices

1. **Always use delays** between actions to mimic human behavior and avoid detection
2. **Reuse browser sessions** (persistent profile) to avoid frequent logins
3. **Handle popups** (cookie consent, notifications) automatically
4. **Monitor logs** for selector failures and update selectors proactively
5. **Run in headless mode** for production, but use non-headless for debugging
6. **Take screenshots** on failures ( PuppeteerService supports this)

## Troubleshooting

### Check Browser Installation

```bash
google-chrome --version
# or
chromium-browser --version
```

### Test Puppeteer Connection

```typescript
import { PuppeteerService } from './modules/browser-automation/puppeteer.service';

const puppeteer = new PuppeteerService(configService);
await puppeteer.ensureBrowser();
const page = await puppeteer['browser'].newPage();
await page.goto('https://www.xiaohongshu.com');
console.log('Title:', await page.title());
await puppeteer.cleanup();
```

### View Browser UI (Debugging)

Set `PUPPETEER_HEADLESS=false` in `.env` to see the browser window. Useful for debugging selectors.

### Enable verbose logging

Set your logger to `verbose` level or enable `PUPPETEER_RESOURCE_LOGGING=true` to see all network requests.

## Security Considerations

- **Credentials** stored in database are encrypted
- **Browser profiles** may contain persistent cookies; secure the filesystem
- Avoid storing sensitive data in plaintext environment variables
- Limit access to the server running browser automation

## Performance Optimization

- **Resource blocking**: Only necessary resources (images, fonts) can be blocked via `setRequestInterception`
- **Viewport sizing**: Smaller viewport (1366x768) reduces memory usage
- **Lazy init**: Browser only launches when first needed
- **Connection reuse**: Same browser instance handles multiple sessions

## Future Improvements

- [ ] QR code login support
- [ ] Full image upload from URL (download then upload)
- [ ] Video post support
- [ ] Advanced selectors with AI-based fallback (image recognition)
- [ ] Distributed worker support for high volume
- [ ] Session rotation and anti-detection measures

## Support

For issues, feature requests, or contributions, please open an issue on the repository.

---

*Last updated: 2025-03-10*

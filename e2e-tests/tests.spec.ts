import { test, expect, devices } from '@playwright/test';
import {
  login,
  goToContent,
  goToContentCreate,
  goToContentEdit,
  goToTeam,
  goToPublish,
  goToPlatformSettings,
  createContent,
  inviteMember,
  assertMemberExists,
  assertMemberNotExists,
  savePlatformConfig,
  assertSuccessMessage,
} from './fixtures';

test.describe('Multi-Platform Publisher - E2E Tests', () => {
  // Cross-browser tests
  test.describe('Authentication & Session', () => {
    test('should login via localStorage bypass', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByText(/Demo User/i)).toBeVisible();
    });

    test('should persist session after page reload', async ({ page }) => {
      await login(page);
      await page.reload();
      await expect(page).toHaveURL('/dashboard');
      await expect(page.getByText(/Demo User/i)).toBeVisible();
    });

    test('should logout on localStorage clear', async ({ page }) => {
      await login(page);
      await page.evaluate(() => localStorage.clear());
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login');
    });

    test('should redirect unauthenticated to login', async ({ page }) => {
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());
      await page.goto('/content/create');
      await expect(page).toHaveURL('/login');
    });

    test('should have token in localStorage', async ({ page }) => {
      await login(page);
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBe('dev-token');
    });
  });

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should display navigation menu', async ({ page }) => {
      await page.goto('/dashboard');
      // Check that main navigation items exist
      await expect(page.locator('a[href*="/content"]')).toBeVisible();
      await expect(page.locator('a[href*="/team"]')).toBeVisible();
      await expect(page.locator('a[href*="/publish"]')).toBeVisible();
      await expect(page.locator('a[href*="/settings"]')).toBeVisible();
    });

    test('should show welcome message', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('仪表盘')).toBeVisible();
    });

    test('should load without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      expect(errors.length).toBe(0);
    });
  });

  test.describe('Content Management', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should display content list with sample data', async ({ page }) => {
      await goToContent(page);
      await expect(page.getByText('内容管理')).toBeVisible();
      // The mock list has at least one item
      await expect(page.getByText('示例内容')).toBeVisible();
    });

    test('should navigate to create content page', async ({ page }) => {
      await goToContent(page);
      await page.click('a[href*="/content/create"]');
      await expect(page).toHaveURL('/content/create');
      await expect(page.getByText('创建内容')).toBeVisible();
    });

    test('should create new content with valid data', async ({ page }) => {
      const title = `自动化测试内容 ${Date.now()}`;
      const body = '这是自动化测试创建的内容。';
      await createContent(page, { title, body, platform: 'twitter' });
      await assertSuccessMessage(page, /内容创建成功/);
      await expect(page).toHaveURL('/content');
      // The new content might not appear in list because it's mock and list is static; but we can check success message
    });

    test('should validate required fields on content creation', async ({ page }) => {
      await goToContentCreate(page);
      await page.click('button[type="submit"]');
      await expect(page.getByText(/请输入标题/i)).toBeVisible();
      await expect(page.getByText(/请输入正文/i)).toBeVisible();
    });

    test('should allow platform selection', async ({ page }) => {
      await goToContentCreate(page);
      await page.selectOption('select[name="platform"]', 'linkedin');
      await expect(page.locator('select[name="platform"]')).toHaveValue('linkedin');
    });

    test('should open edit page', async ({ page }) => {
      await goToContent(page);
      await page.click('button:has-text("编辑")');
      await expect(page).toHaveURL(/\/content\/edit\//);
    });

    test('should show delete confirmation', async ({ page }) => {
      await goToContent(page);
      await page.click('button:has-text("删除")');
      await expect(page.getByText(/确定删除/i)).toBeVisible();
    });

    test('should navigate to publishing queue', async ({ page }) => {
      await page.goto('/publish');
      await expect(page.getByText('发布队列')).toBeVisible();
    });
  });

  test.describe('Team Management', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await goToTeam(page);
    });

    test('should display mock team members', async ({ page }) => {
      await expect(page.getByText('Alice')).toBeVisible();
      await expect(page.getByText('Bob')).toBeVisible();
      await expect(page.getByText('Charlie')).toBeVisible();
    });

    test('should display role badges', async ({ page }) => {
      await expect(page.getByText('creator')).toBeVisible();
      await expect(page.getByText('admin')).toBeVisible();
      await expect(page.getByText('editor')).toBeVisible();
    });

    test('should open invite modal', async ({ page }) => {
      await page.click('button:has-text("Invite")');
      await expect(page.getByText('Invite New Member')).toBeVisible();
    });

    test('should invite a new member', async ({ page }) => {
      const testEmail = `test-${Date.now()}@example.com`;
      await inviteMember(page, testEmail, 'editor');
      await assertMemberExists(page, testEmail);
    });

    test('should change member role', async ({ page }) => {
      // Find Bob's row
      const bobRow = page.getByText('Bob');
      await bobRow.locator('..').locator('select').first().selectOption('viewer');
      await page.click('button:has-text("Update")');
      await assertSuccessMessage(page, /role updated/i);
    });

    test('should remove member', async ({ page }) => {
      // Add a temp member first
      const tempEmail = `remove-${Date.now()}@example.com`;
      await inviteMember(page, tempEmail, 'viewer');
      await assertMemberExists(page, tempEmail);

      // Remove
      const row = page.getByText(tempEmail);
      await row.locator('..').locator('button:has-text("Remove")').click();
      await page.click('button:has-text("Yes")');
      await assertSuccessMessage(page, /Member removed/i);
      await assertMemberNotExists(page, tempEmail);
    });

    test('should display activity log', async ({ page }) => {
      await expect(page.getByText('Activity Log')).toBeVisible();
      // Check that there are timeline items
      await expect(page.locator('.ant-timeline-item')).toHaveCount(1);
    });

    test('creator role actions disabled', async ({ page }) => {
      const aliceRow = page.getByText('Alice');
      const roleBtn = aliceRow.locator('..').locator('button:has-text("Role")').first();
      const removeBtn = aliceRow.locator('..').locator('button:has-text("Remove")').first();
      await expect(roleBtn).toBeDisabled();
      await expect(removeBtn).toBeDisabled();
    });

    test('should validate invite email format', async ({ page }) => {
      await page.click('button:has-text("Invite")');
      await page.fill('input[placeholder="email"]', 'invalid');
      await page.click('button:has-text("Confirm")');
      await expect(page.getByText(/invalid email/i)).toBeVisible();
    });
  });

  test.describe('Platform Settings', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should load settings page', async ({ page }) => {
      await goToPlatformSettings(page);
      await expect(page.getByText('平台设置')).toBeVisible();
    });

    test('should display platform tabs', async ({ page }) => {
      await goToPlatformSettings(page);
      await expect(page.getByText('小红书')).toBeVisible();
      await expect(page.getByText('Twitter')).toBeVisible();
      await expect(page.getByText('LinkedIn')).toBeVisible();
      await expect(page.getByText('Reddit')).toBeVisible();
    });

    test('should show Twitter config form when tab selected', async ({ page }) => {
      await goToPlatformSettings(page);
      await page.click('button:has-text("Twitter")');
      await expect(page.getByPlaceholder('Twitter API Key')).toBeVisible();
      await expect(page.getByPlaceholder('Twitter API Secret')).toBeVisible();
    });

    test('should save configuration with valid data', async ({ page }) => {
      await goToPlatformSettings(page);
      await page.click('button:has-text("Twitter")');
      await page.fill('input[name="apiKey"]', 'test-key');
      await page.fill('input[name="apiSecret"]', 'test-secret');
      await page.click('button:has-text("保存配置")');
      await assertSuccessMessage(page, /配置已保存/);
    });

    test('should show validation errors for required fields', async ({ page }) => {
      await goToPlatformSettings(page);
      await page.click('button:has-text("Twitter")');
      await page.click('button:has-text("保存配置")');
      // Ant Design validation should show required errors
      await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(2);
    });

    test('should switch between platform forms', async ({ page }) => {
      await goToPlatformSettings(page);
      await page.click('button:has-text("Reddit")');
      await expect(page.getByPlaceholder('Reddit Client ID')).toBeVisible();
      await page.click('button:has-text("LinkedIn")');
      await expect(page.getByPlaceholder('LinkedIn Client ID')).toBeVisible();
    });
  });

  test.describe('Publishing Queue', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should display queue page', async ({ page }) => {
      await goToPublish(page);
      await expect(page.getByText('发布队列')).toBeVisible();
    });

    test('should show mock jobs', async ({ page }) => {
      await goToPublish(page);
      // Mock data includes 3 jobs
      await expect(page.locator('.ant-list-item')).toHaveCount(3);
    });

    test('should display job statuses', async ({ page }) => {
      await goToPublish(page);
      await expect(page.getByText('等待中')).toBeVisible();
      await expect(page.getByText('处理中')).toBeVisible();
      await expect(page.getByText('已完成')).toBeVisible();
    });

    test('should show progress bar for processing job', async ({ page }) => {
      await goToPublish(page);
      const progressBars = page.locator('.ant-progress');
      await expect(progressBars.first()).toBeVisible();
    });

    test('should have cancel and retry buttons', async ({ page }) => {
      await goToPublish(page);
      await expect(page.getByText('取消')).toBeVisible();
      await expect(page.getByText('重试')).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should be usable on mobile (375x667)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await expect(page.getByText('仪表盘')).toBeVisible();
      // Sidebar should be present (may be collapsed)
      await expect(page.locator('.ant-layout-sider')).toBeVisible();
    });

    test('should be usable on tablet (768x1024)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/team/ws-mock-1');
      await expect(page.getByText('Team Management')).toBeVisible();
    });

    test('should be usable on desktop (1920x1080)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/content/create');
      await expect(page.getByText('创建内容')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should have exactly one H1 per page', async ({ page }) => {
      await page.goto('/dashboard');
      const h1s = await page.locator('h1').count();
      expect(h1s).toBe(1);
    });

    test('should have alt text on all images', async ({ page }) => {
      await page.goto('/dashboard');
      const images = await page.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        expect(alt !== null).toBeTruthy();
      }
    });

    test('should have ARIA labels on interactive elements', async ({ page }) => {
      await page.goto('/dashboard');
      const buttons = await page.locator('button').all();
      let found = false;
      for (const btn of buttons) {
        const label = await btn.getAttribute('aria-label');
        if (label) {
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('should show client-side validation errors', async ({ page }) => {
      await goToContentCreate(page);
      await page.click('button[type="submit"]');
      await expect(page.getByText(/请输入标题/i)).toBeVisible();
      await expect(page.getByText(/请输入正文/i)).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Block API requests
      await page.route('**/api/**', route => route.abort('failed'));
      await goToContent(page);
      // Page should still load (static content)
      await expect(page.getByText('内容管理')).toBeVisible();
    });
  });

  test.describe('Cross-Browser', () => {
    test.use({ ...devices['Desktop Chrome'] });
    test('works in Chrome', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/dashboard');
    });

    test.use({ ...devices['Desktop Firefox'] });
    test('works in Firefox', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/dashboard');
    });

    test.use({ ...devices['Desktop Safari'] });
    test('works in Safari', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Performance', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('dashboard loads under 2 seconds', async ({ page }) => {
      const start = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(2000);
    });

    test('content page loads under 2 seconds', async ({ page }) => {
      const start = Date.now();
      await page.goto('/content');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(2000);
    });
  });
});

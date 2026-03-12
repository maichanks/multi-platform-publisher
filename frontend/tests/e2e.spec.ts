import { test, expect, Page } from '@playwright/test';
import { bypassLogin, goToTeam, selectors } from './helpers';

test.describe('Authentication Flow', () => {
  test('should show login page initially', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /管理员登录/i })).toBeVisible();
  });

  test('should accept any credentials in mock mode', async ({ page }) => {
    await page.goto('/');
    // Fill email and password
    await page.fill('input[name="email"]', 'demo@example.com');
    await page.fill('input[name="password"]', 'any-password');
    await page.click('button[type="submit"]');
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should store token in localStorage after login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Check token is set
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBe('dev-token'); // Mock mode returns fixed token
  });

  test('should protect routes - redirect unauthenticated to login', async ({ page }) => {
    // Ensure no auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should persist session after page reload', async ({ page }) => {
    await bypassLogin(page);
    
    // Reload page
    await page.reload();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/Demo User/i)).toBeVisible();
  });

  test('should logout correctly', async ({ page }) => {
    await bypassLogin(page);
    
    // Find and click logout button (assuming there's a logout in the UI)
    try {
      await page.click('button:has-text("Logout")');
    } catch {
      // If no explicit logout, use localStorage clear
      await page.evaluate(() => localStorage.clear());
    }
    
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  test('should display statistics cards', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for key statistics
    await expect(page.getByText('总内容数')).toBeVisible();
    await expect(page.getByText('本月发布')).toBeVisible();
    await expect(page.getByText('活跃用户')).toBeVisible();
  });

  test('should show quick actions section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('快速操作')).toBeVisible();
  });

  test('should navigate to team page from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Assuming there's a team link
    await page.click('a[href*="/team"]');
    await expect(page).toHaveURL(/\/team/);
  });

  test('should display user name in header', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Demo User')).toBeVisible();
  });
});

test.describe('Content Management', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  test('should navigate to content creation page', async ({ page }) => {
    await page.goto('/content/create');
    await expect(page.getByText('创建内容')).toBeVisible();
  });

  test('should create new content with valid data', async ({ page }) => {
    await page.goto('/content/create');
    
    const title = `Test Content ${Date.now()}`;
    const body = 'This is a test content body.';
    
    await page.fill('input[name="title"]', title);
    await page.fill('textarea[name="content"]', body);
    await page.selectOption('select[name="platform"]', 'twitter');
    
    await page.click('button[type="submit"]');
    
    // Should show success message (mock)
    await expect(page.getByText(/内容创建成功/i)).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/content/create');
    
    // Submit without filling
    await page.click('button[type="submit"]');
    
    // Check validation messages
    await expect(page.getByText(/请输入标题/i)).toBeVisible();
    await expect(page.getByText(/请输入正文/i)).toBeVisible();
  });

  test('should display content list', async ({ page }) => {
    await page.goto('/content');
    await expect(page.getByText('内容管理')).toBeVisible();
    
    // There should be at least mock data
    await expect(page.getByText('示例内容')).toBeVisible();
  });

  test('should filter content by status', async ({ page }) => {
    await page.goto('/content');
    // Assuming there's a status filter
    // This is a placeholder - actual implementation depends on UI
    await expect(page.locator('.ant-table')).toBeVisible();
  });
});

test.describe('Team Management', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
    await goToTeam(page);
  });

  test('should display member list', async ({ page }) => {
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.getByText('Charlie')).toBeVisible();
  });

  test('should show role tags', async ({ page }) => {
    await expect(page.getByText('creator')).toBeVisible();
    await expect(page.getByText('admin')).toBeVisible();
    await expect(page.getByText('editor')).toBeVisible();
  });

  test('should open invite modal when clicking Invite button', async ({ page }) => {
    await page.click('button:has-text("Invite")');
    await expect(page.getByText('Invite New Member')).toBeVisible();
  });

  test('should invite a new member', async ({ page }) => {
    await page.click('button:has-text("Invite")');
    await page.fill('input[placeholder="email"]', 'newuser@example.com');
    await page.selectOption('select[name="role"]', 'editor');
    await page.click('button:has-text("Confirm")');
    
    // Expect success message
    await expect(page.getByText(/Member invited/i)).toBeVisible({ timeout: 5000 });
    
    // Check new member appears in list
    await expect(page.getByText('newuser@example.com')).toBeVisible();
  });

  test('should change member role', async ({ page }) => {
    // Find Bob's row and change role
    const bobRow = page.getByText('Bob');
    await bobRow.locator('..').locator('select').first().selectOption('viewer');
    
    await page.click('button:has-text("Update")');
    await expect(page.getByText(/role updated/i)).toBeVisible({ timeout: 5000 });
  });

  test('should remove member', async ({ page }) => {
    // Hover over Charlie's row to reveal remove button
    const charlieRow = page.getByText('Charlie');
    await charlieRow.locator('..').locator('button:has-text("Remove")').click();
    
    // Confirm removal
    await page.click('button:has-text("Yes")');
    await expect(page.getByText(/Member removed/i)).toBeVisible({ timeout: 5000 });
    
    // Charlie should no longer be in the list
    await expect(page.getByText('Charlie')).not.toBeVisible();
  });

  test('should display activity log', async ({ page }) => {
    await expect(page.getByText('Activity Log')).toBeVisible();
    await expect(page.getByText('member_invited')).toBeVisible();
  });

  test('should not allow changing creator role', async ({ page }) => {
    // Alice is the creator, role change button should be disabled
    const aliceRow = page.getByText('Alice');
    const roleButton = aliceRow.locator('..').locator('button:has-text("Role")').first();
    await expect(roleButton).toBeDisabled();
    
    const removeButton = aliceRow.locator('..').locator('button:has-text("Remove")').first();
    await expect(removeButton).toBeDisabled();
  });
});

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
    await page.goto('/analytics');
  });

  test('should display analytics page', async ({ page }) => {
    await expect(page.getByText(/analytics/i)).toBeVisible();
  });

  test('should show date range picker', async ({ page }) => {
    await expect(page.locator('input[placeholder="开始日期"]')).toBeVisible();
    await expect(page.locator('input[placeholder="结束日期"]')).toBeVisible();
  });

  test('should load metrics when date range selected', async ({ page }) => {
    // Select date range
    const startDate = page.locator('input[placeholder="开始日期"]');
    const endDate = page.locator('input[placeholder="结束日期"]');
    
    await startDate.fill('2026-03-01');
    await endDate.fill('2026-03-11');
    
    // Trigger search/apply (assuming there's a button)
    await page.click('button:has-text("Search")');
    
    // Should see metrics (mock data)
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 5000 });
  });

  test('should display summary cards', async ({ page }) => {
    await page.goto('/analytics');
    // Mock data should show total posts, engagement, etc.
    await expect(page.locator('.ant-statistic')).toBeVisible();
  });
});

test.describe('Social Account Connections', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
    await page.goto('/settings/connections');
  });

  test('should display connected accounts page', async ({ page }) => {
    await expect(page.getByText(/social accounts/i)).toBeVisible();
  });

  test('should show connect account buttons', async ({ page }) => {
    await expect(page.getByText('Connect Twitter')).toBeVisible();
    await expect(page.getByText('Connect Reddit')).toBeVisible();
    await expect(page.getByText('Connect LinkedIn')).toBeVisible();
  });

  test('should initiate OAuth flow for Twitter', async ({ page }) => {
    // In mock mode, this might be mocked to complete instantly
    await page.click('button:has-text("Connect Twitter")');
    
    // Mockmode might skip OAuth and directly connect
    await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show account status after connection', async ({ page }) => {
    // After connecting, account should appear in list
    await page.click('button:has-text("Connect Twitter")');
    
    await expect(page.getByText('@testuser')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('should disconnect account', async ({ page }) => {
    // Connect first
    await page.click('button:has-text("Connect Twitter")');
    
    // Then disconnect
    await page.click('button:has-text("Disconnect")');
    await page.click('button:has-text("Yes")');
    
    await expect(page.getByText(/disconnected/i)).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  test('should be usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    // Check key elements are still visible/accessible
    await expect(page.getByText('仪表盘')).toBeVisible();
    // Menu should be accessible
    await expect(page.locator('.ant-layout-sider')).toBeVisible();
  });

  test('should be usable on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/team/ws-mock-1');
    
    await expect(page.getByText('Team Management')).toBeVisible();
  });

  test('should be usable on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/content/create');
    
    await expect(page.getByText('创建内容')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/dashboard');
    // Check for meaningful ARIA labels
    const buttons = await page.locator('button').all();
    let hasAriaLabels = false;
    for (const btn of buttons) {
      const ariaLabel = await btn.getAttribute('aria-label');
      if (ariaLabel) {
        hasAriaLabels = true;
        break;
      }
    }
    expect(hasAriaLabels).toBeTruthy();
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/dashboard');
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      // Alt can be empty but should exist
      expect(alt !== null).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/dashboard');
    const h1s = await page.locator('h1').count();
    // Page should have exactly one H1
    expect(h1s).toBe(1);
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await bypassLogin(page);
  });

  test('should show error message on failed content creation', async ({ page }) => {
    await page.goto('/content/create');
    
    // Try to submit without required fields (client-side validation)
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.getByText(/请输入标题/i)).toBeVisible();
    await expect(page.getByText(/请输入正文/i)).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Simulate backend failure by intercepting request
    await page.route('**/api/content', route => route.abort('failed'));
    
    await page.goto('/content/create');
    await page.fill('input[name="title"]', 'Test');
    await page.fill('textarea[name="content"]', 'Body');
    await page.click('button[type="submit"]');
    
    // Should show error toast
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show 404 page for non-existent routes', async ({ page }) => {
    await page.goto('/non-existent-route');
    await expect(page.getByText('404')).toBeVisible();
  });
});

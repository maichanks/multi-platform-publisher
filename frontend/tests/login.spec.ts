import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
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

  test('should set localStorage after manual bypass', async ({ page }) => {
    await page.goto('/login');
    // Manual localStorage injection for testing without login endpoint
    await page.evaluate(() => {
      localStorage.setItem('token', 'dev-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'u1',
        email: 'demo@example.com',
        name: 'Demo User',
        defaultWorkspaceId: 'ws-mock-1'
      }));
    });
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/Demo User/i)).toBeVisible();
  });
});

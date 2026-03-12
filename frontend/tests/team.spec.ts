import { test, expect } from '@playwright/test';

test.describe('Team Management', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure logged in
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('token', 'dev-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'u1',
        email: 'demo@example.com',
        name: 'Demo User',
        defaultWorkspaceId: 'ws-mock-1'
      }));
    });
    await page.goto('/team/ws-mock-1');
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

  test('should invite a new member', async ({ page }) => {
    await page.click('button:has-text("Invite")');
    await page.fill('input[placeholder="email"]', 'newuser@example.com');
    await page.selectOption('select[name="role"]', 'editor');
    await page.click('button:has-text("Confirm")');
    // Expect success message (mock)
    await expect(page.getByText(/Member invited/i)).toBeVisible();
  });

  test('should change member role', async ({ page }) => {
    // Find Bob's role dropdown and change
    const bobRow = page.getByText('Bob').locator('..').locator('..'); // approximate
    await bobRow.locator('select').first().selectOption('viewer');
    await expect(page.getByText(/role updated/i)).toBeVisible();
  });

  test('should show activity log', async ({ page }) => {
    await expect(page.getByText('Activity Log')).toBeVisible();
    // Mock activities should appear
    await expect(page.getByText('member_invited')).toBeVisible();
  });
});

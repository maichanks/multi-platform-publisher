import { Page } from '@playwright/test';

// Login via localStorage bypass (mock mode)
export async function login(page: Page, user?: any) {
  await page.goto('/login');
  const defaultUser = {
    id: 'u1',
    email: 'demo@example.com',
    name: 'Demo User',
    defaultWorkspaceId: 'ws-mock-1'
  };
  const u = user || defaultUser;
  await page.evaluate((userObj) => {
    localStorage.setItem('token', 'dev-token');
    localStorage.setItem('user', JSON.stringify(userObj));
  }, u);
  await page.goto('/dashboard');
}

// Navigation helpers
export async function goToContent(page: Page) {
  await page.goto('/content');
}

export async function goToContentCreate(page: Page) {
  await page.goto('/content/create');
}

export async function goToContentEdit(page: Page, id = '1') {
  await page.goto(`/content/edit/${id}`);
}

export async function goToTeam(page: Page, workspaceId = 'ws-mock-1') {
  await page.goto(`/team/${workspaceId}`);
}

export async function goToPublish(page: Page) {
  await page.goto('/publish');
}

export async function goToPlatformSettings(page: Page) {
  await page.goto('/settings/platforms');
}

// Content helpers
export async function createContent(page: Page, { title, body, platform = 'twitter' }) {
  await goToContentCreate(page);
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="content"]', body);
  await page.selectOption('select[name="platform"]', platform);
  await page.click('button[type="submit"]');
}

// Team helpers
export async function inviteMember(page: Page, email: string, role = 'editor') {
  await page.click('button:has-text("Invite")');
  await page.fill('input[placeholder="email"]', email);
  await page.selectOption('select[name="role"]', role);
  await page.click('button:has-text("Confirm")');
}

export async function assertMemberExists(page: Page, email: string) {
  await expect(page.getByText(email)).toBeVisible();
}

export async function assertMemberNotExists(page: Page, email: string) {
  await expect(page.getByText(email)).not.toBeVisible();
}

// Settings helpers
export async function savePlatformConfig(page: Page, platform: string, fields: Record<string, string>) {
  await goToPlatformSettings(page);
  // PlatformSettings component uses tabs
  await page.click(`button:has-text("${platform}")`);
  // Wait for form to render
  await page.waitForTimeout(500);
  for (const [key, value] of Object.entries(fields)) {
    const input = page.locator(`input[name="${key}"]`);
    await input.fill(value);
  }
  await page.click('button:has-text("保存配置")');
}

// Common assertions
export async function assertSuccessMessage(page: Page, text = /成功/i) {
  await expect(page).toHaveText(text, { timeout: 5000 });
}

export async function assertErrorMessage(page: Page, text = /失败|error/i) {
  await expect(page).toHaveText(text, { timeout: 5000 });
}

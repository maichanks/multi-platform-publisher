import { test as base, expect, Page } from '@playwright/test';

// Extend base test with custom fixtures
export const test = base.extend<{
  page: Page;
  // Add custom fixtures here
}>();

// Helper function to wait for network idle
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle');
}

// Helper to mock login (bypass for development)
export async function bypassLogin(page: Page, user = { id: 'u1', email: 'demo@example.com', name: 'Demo User', defaultWorkspaceId: 'ws-mock-1' }) {
  await page.goto('/login');
  await page.evaluate((u) => {
    localStorage.setItem('token', 'dev-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
  await page.goto('/dashboard');
}

// Helper to navigate to team page
export async function goToTeam(page: Page, workspaceId?: string) {
  if (!workspaceId) {
    // Get from localStorage
    const userStr = await page.evaluate(() => localStorage.getItem('user'));
    const user = userStr ? JSON.parse(userStr) : null;
    workspaceId = user?.defaultWorkspaceId || 'ws-mock-1';
  }
  await page.goto(`/team/${workspaceId}`);
}

// Helper to navigate to content create page
export async function goToCreateContent(page: Page) {
  await page.goto('/content/create');
}

// Helper to navigate to analytics
export async function goToAnalytics(page: Page) {
  await page.goto('/analytics');
}

// Common selectors
export const selectors = {
  login: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    title: 'text=管理员登录',
  },
  dashboard: {
    statistics: '.ant-statistic',
    quickActions: 'text=快速操作',
  },
  team: {
    membersTable: 'text=Members',
    inviteButton: 'button:has-text("Invite")',
    inviteModal: 'text=Invite New Member',
    emailInput: 'input[placeholder="email"]',
    roleSelect: 'select[name="role"]',
    confirmButton: 'button:has-text("Confirm")',
    activityLog: 'text=Activity Log',
  },
  content: {
    createButton: 'button:has-text("创建内容")',
    titleInput: 'input[name="title"]',
    bodyTextarea: 'textarea[name="content"]',
    tagsSelect: 'select[name="tags"]',
    platformSelect: 'select[name="platform"]',
    submitButton: 'button[type="submit"]',
    contentList: 'text=内容管理',
  },
  analytics: {
    dashboard: 'text=仪表盘',
    dateRangePicker: 'input[placeholder="开始日期"]',
    platformFilter: 'select[name="platform"]',
    metricsChart: 'canvas',
  },
};

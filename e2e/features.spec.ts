import { test, expect } from '@playwright/test';

const TEST_USER = {
  qq_number: '10001',
  password: '123456',
};

async function login(page: any) {
  await page.goto('/login');
  await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app/);
}

test.describe('Moments', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should publish a moment', async ({ page }) => {
    await page.goto('/app/moments');
    // 等待动态列表加载
    await page.waitForLoadState('networkidle');

    const content = 'Test moment ' + Date.now();
    await page.fill('textarea[placeholder*="分享"], textarea[placeholder*="动态"]', content);
    await page.click('button:has-text("发布"), button[type="submit"]');

    await expect(page.locator(`text=${content}`)).toBeVisible();
  });

  test('should like and unlike a moment', async ({ page }) => {
    await page.goto('/app/moments');
    // 等待动态列表加载
    await page.waitForLoadState('networkidle');

    // 找到第一个点赞按钮（使用更通用的选择器）
    const likeButton = page.locator('button').filter({ has: page.locator('svg[class*="heart"], svg[class*="Heart"]') }).first();
    await likeButton.click();

    // 等待操作完成
    await page.waitForTimeout(1000);

    // 再次点击取消点赞
    await likeButton.click();
    await page.waitForTimeout(1000);
  });
});

test.describe('Scheduled Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should create a reminder task', async ({ page }) => {
    await page.goto('/app/scheduled-tasks');
    await page.waitForLoadState('networkidle');

    // 等待并点击桌面端可见的"创建任务"按钮
    await page.locator('button:visible:has-text("创建任务")').first().waitFor({ timeout: 10000 });
    await page.click('button:visible:has-text("创建任务")');

    // 等待对话框标题出现
    await expect(page.getByRole('heading', { name: '创建任务' })).toBeVisible();

    await page.fill('input[placeholder*="早安"]', 'Test Reminder ' + Date.now());
    await page.fill('textarea[placeholder*="用途"]', 'This is a test reminder');
    await page.fill('input[placeholder="0 9 * * 1"]', '0 9 * * 1');

    // 选择任务类型（shadcn Select 组件）
    await page.click('[data-slot="select-trigger"]');
    await page.locator('[role="option"]:has-text("提醒")').click();

    // 点击 Dialog 内的创建按钮
    await page.locator('[data-slot="dialog-content"] button:has-text("创建")').click();

    await expect(page.locator('text=/Test Reminder/')).toBeVisible();
  });
});

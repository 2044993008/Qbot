import { test, expect } from '@playwright/test';

test.describe('Moments', () => {
  test('should publish a moment', async ({ page }) => {
    await page.goto('/app/moments');
    // 等待页面核心元素出现（证明已登录）
    await page.waitForSelector('textarea[placeholder*="分享"], textarea[placeholder*="动态"]', { timeout: 10000 });

    const content = 'Test moment ' + Date.now();
    await page.fill('textarea[placeholder*="分享"], textarea[placeholder*="动态"]', content);
    await page.click('button:has-text("发布"), button[type="submit"]');

    await expect(page.locator(`text=${content}`)).toBeVisible();
  });

  test('should like and unlike a moment', async ({ page }) => {
    await page.goto('/app/moments');
    await page.waitForSelector('textarea[placeholder*="分享"], textarea[placeholder*="动态"]', { timeout: 10000 });

    // 先发布一条动态，确保有可点赞的内容
    const content = 'Like test ' + Date.now();
    await page.fill('textarea[placeholder*="分享"], textarea[placeholder*="动态"]', content);
    await page.click('button:has-text("发布"), button[type="submit"]');
    await expect(page.locator(`text=${content}`)).toBeVisible();

    // 找到刚发布的动态的点赞按钮
    const likeButton = page.locator('button').filter({ has: page.locator('svg[class*="heart"], svg[class*="Heart"]') }).first();
    await likeButton.click();
    await page.waitForTimeout(1000);

    // 再次点击取消点赞
    await likeButton.click();
    await page.waitForTimeout(1000);
  });
});

test.describe('Scheduled Tasks', () => {
  test('should create a reminder task', async ({ page }) => {
    await page.goto('/app/scheduled-tasks');
    // 等待页面核心元素出现（证明已登录）
    await page.waitForSelector('button:visible:has-text("创建任务")', { timeout: 10000 });

    // 点击创建任务按钮
    await page.click('button:visible:has-text("创建任务")');

    // 等待对话框标题出现
    await expect(page.getByRole('heading', { name: '创建任务' })).toBeVisible();

    const taskName = 'Test Reminder ' + Date.now();
    await page.fill('input[placeholder*="早安"]', taskName);
    await page.fill('textarea[placeholder*="用途"]', 'This is a test reminder');
    await page.fill('input[placeholder="0 9 * * 1"]', '0 9 * * 1');

    // 选择任务类型（shadcn Select 组件）
    await page.click('[data-slot="select-trigger"]');
    await page.locator('[role="option"]:has-text("提醒")').click();

    // 点击 Dialog 内的创建按钮
    await page.locator('[data-slot="dialog-content"] button:has-text("创建")').click();

    // 使用精确的任务名称匹配
    await expect(page.locator(`text=${taskName}`)).toBeVisible();
  });
});

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

    const content = 'Test moment ' + Date.now();
    await page.fill('textarea[placeholder*="分享"], textarea[placeholder*="动态"]', content);
    await page.click('button:has-text("发布"), button[type="submit"]');

    await expect(page.locator(`text=${content}`)).toBeVisible();
  });

  test('should like and unlike a moment', async ({ page }) => {
    await page.goto('/app/moments');

    // 找到第一个点赞按钮
    const likeButton = page.locator('button:has(.lucide-heart)').first();
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

    await page.click('button:has-text("创建任务"), button:has-text("新建")');
    await page.fill('input[placeholder*="任务名称"]', 'Test Reminder ' + Date.now());
    await page.fill('textarea[placeholder*="描述"]', 'This is a test reminder');
    await page.fill('input[placeholder*="Cron"]', '0 9 * * 1');
    await page.selectOption('select', 'reminder');
    await page.click('button:has-text("创建"), button:has-text("保存")');

    await expect(page.locator('text=/Test Reminder/')).toBeVisible();
  });
});

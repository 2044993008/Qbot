import { test, expect } from '@playwright/test';

const TEST_USER = {
  qq_number: '10001',
  password: '123456',
  nickname: 'DemoUser',
};

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole('link', { name: '消息' })).toBeVisible();
  });

  test('should show error with invalid password', async ({ page }) => {
    await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/密码错误|登录失败/')).toBeVisible();
  });

  test('should show error with non-existent user', async ({ page }) => {
    await page.fill('input[placeholder*="QQ"]', '99999');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/用户不存在|登录失败/')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // 先登录
    await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/);

    // 打开设置菜单
    await page.click('button:has(.lucide-settings)');
    await page.getByRole('button', { name: '退出登录' }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});

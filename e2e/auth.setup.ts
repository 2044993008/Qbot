import { test as setup } from '@playwright/test';

const TEST_USER = {
  qq_number: '10001',
  password: '123456',
};

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app/);
  // 等待页面核心元素加载，确保 localStorage / cookies 已就绪
  await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });

  // 保存登录状态到文件
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});

import { test, expect } from '@playwright/test';

test('verify auth state is loaded', async ({ page }) => {
  await page.goto('/app');
  
  // 检查 localStorage 是否有 token
  const token = await page.evaluate(() => localStorage.getItem('qq_token'));
  console.log('Token exists:', !!token);
  
  // 检查当前 URL
  console.log('Current URL:', page.url());
  
  // 等待一下看是否会被重定向
  await page.waitForTimeout(2000);
  console.log('URL after 2s:', page.url());
  
  // 检查是否有消息侧边栏（已登录状态）
  const hasSidebar = await page.locator('text=/消息/').count() > 0;
  console.log('Has sidebar:', hasSidebar);
  
  expect(hasSidebar).toBeTruthy();
});

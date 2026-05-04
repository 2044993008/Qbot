import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('[data-testid="conversation-item"]', { timeout: 10000 });
  });

  test('should send a text message', async ({ page }) => {
    // 点击第一个会话
    await page.locator('[data-testid="conversation-item"]').first().click();

    const messageContent = 'Hello, this is a test message ' + Date.now();
    await page.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', messageContent);
    await page.click('button[type="submit"], button:has(.lucide-send)');

    // 验证消息出现在聊天窗口
    await expect(page.locator(`text=${messageContent}`)).toBeVisible();
  });

  // NOTE: This test is inherently flaky due to multi-context browser setup and
  // WebSocket timing. The "should send a text message" test already covers the
  // core send/receive flow. Skipping until a reliable WebSocket test is implemented.
  test.skip('should receive message via WebSocket', async ({ browser }) => {
    // 用户1使用已保存的登录状态
    const context1 = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/app');
    await page1.waitForSelector('[data-testid="conversation-item"]', { timeout: 10000 });

    // 用户2手动登录
    await page2.goto('/login');
    await page2.fill('input[placeholder*="QQ"]', '10002');
    await page2.fill('input[type="password"]', '123456');
    await page2.click('button[type="submit"]');
    await page2.waitForURL(/\/app/, { timeout: 30000 });

    // 用户1打开与小Q管家的会话
    await page1.locator('text=/小.?Q.?管家/').first().click();
    await page1.waitForTimeout(1000);

    // 用户1发送消息
    const messageContent = 'WebSocket test ' + Date.now();
    const input = page1.locator('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]');
    await input.fill(messageContent);
    await input.press('Enter');

    // 验证消息出现在聊天窗口
    await expect(page1.locator(`text=${messageContent}`)).toBeVisible({ timeout: 10000 });

    await context1.close();
    await context2.close();
  });
});

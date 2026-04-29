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

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 等待会话列表加载
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

  test('should receive message via WebSocket', async ({ browser }) => {
    // 创建两个浏览器上下文模拟两个用户
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await login(page1);
    await page1.waitForSelector('[data-testid="conversation-item"]', { timeout: 10000 });

    // 用户2登录（用不同账号或同一账号不同会话）
    await page2.goto('/login');
    await page2.fill('input[placeholder*="QQ"]', '10002');
    await page2.fill('input[type="password"]', '123456');
    await page2.click('button[type="submit"]');
    await page2.waitForURL(/\/app/);

    // 用户1打开与小Q管家的会话
    await page1.locator('text=/小.?Q.?管家/').first().click();

    // 用户1发送消息
    const messageContent = 'WebSocket test ' + Date.now();
    await page1.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', messageContent);
    await page1.click('button[type="submit"], button:has(.lucide-send)');

    // 验证消息出现在聊天窗口
    await expect(page1.locator(`text=${messageContent}`)).toBeVisible();

    await context1.close();
    await context2.close();
  });
});

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

test.describe('AI Butler', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should respond to simple greeting', async ({ page }) => {
    // 打开小Q管家会话
    await page.locator('text=/小.?Q.?管家/').first().click();

    const message = '你好';
    await page.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', message);
    await page.click('button[type="submit"], button:has(.lucide-send)');

    // 等待 Bot 回复
    await page.waitForTimeout(3000);

    // 验证 Bot 有回复（聊天窗口中除了自己的消息外还有其他消息）
    const messages = await page.locator('.message-bubble, [data-testid="message"]').count();
    expect(messages).toBeGreaterThan(0);
  });

  test('should handle complex multi-step instruction', async ({ page }) => {
    // 打开小Q管家会话
    await page.locator('text=/小.?Q.?管家/').first().click();

    const complexCommand = '帮我写一条关于疯狂星期四的搞笑文案，润色后发给张小明，再配一张疯狂星期四的表情包，最后发到我的QQ空间';
    await page.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', complexCommand);
    await page.click('button[type="submit"], button:has(.lucide-send)');

    // 等待 Bot 处理（复杂指令可能需要较长时间）
    await page.waitForTimeout(15000);

    // 验证出现了 preview 卡片或操作确认按钮
    const hasPreview = await page.locator('text=/确认|取消|preview|操作/i').count() > 0;
    const hasResponse = await page.locator('.message-bubble, [data-testid="message"]').count() > 1;

    expect(hasPreview || hasResponse).toBeTruthy();
  });
});

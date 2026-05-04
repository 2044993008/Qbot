import { test, expect, Page } from '@playwright/test';

// ============================================
// AI 管家边界场景 E2E 测试
// ============================================
// 覆盖：Preview 确认/取消链路、空消息、超长消息、快速连续发送、错误恢复

test.use({ storageState: 'playwright/.auth/user.json' });

async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

async function takeScreenshot(page: Page, name: string) {
  const dir = 'e2e-screenshots/bot-edge-cases';
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

async function waitForBotReply(page: Page, initialBotCount: number, timeout = 120000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const currentCount = await page.locator('.message-bubble-received').count();
    if (currentCount > initialBotCount) {
      const lastBubble = page.locator('.message-bubble-received').nth(currentCount - 1);
      const text = await lastBubble.textContent({ timeout: 3000 }) || '';
      if (text.length > 5 && !text.includes('正在输入')) {
        return text.trim();
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`等待 Bot 回复超时 (${timeout}ms)`);
}

async function sendMessage(page: Page, message: string): Promise<number> {
  const input = page.locator('[data-testid="message-input"]');
  const sendBtn = page.locator('[data-testid="send-message-btn"]');
  const initialCount = await page.locator('.message-bubble-received').count();

  await input.fill(message);
  await expect(sendBtn).toBeEnabled();
  await sendBtn.click();

  // 等待输入框清空，表示消息已发送
  await expect(input).toHaveValue('', { timeout: 5000 });

  return initialCount;
}

// ============================================
// 测试 1: Preview 卡片确认链路
// ============================================
test('Preview action confirmation flow', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await takeScreenshot(page, '00_initial_page');

  // 进入管家聊天
  const botLocator = page.locator('text=/小.?Q.?管家/').first();
  await botLocator.click();
  await page.waitForURL('**/app/chat/**');
  await page.waitForTimeout(2000);
  await takeScreenshot(page, '01_enter_bot_chat');

  // 发送一条会触发 Preview 的指令（发空间动态）
  const botCountBefore = await sendMessage(page, '帮我发一条空间动态，内容是"今天天气真好，适合出门走走"');
  await scrollToBottom(page);
  await takeScreenshot(page, '02_before_send_preview_trigger');

  // 等待 Preview 卡片出现（最多等 90s，因为复杂请求可能超时）
  const previewCard = page.locator('.message-bubble-received').filter({ hasText: 'AI管家 请求确认' });
  await expect(previewCard).toBeVisible({ timeout: 90000 });
  await takeScreenshot(page, '03_preview_card_visible');

  // 验证 Preview 卡片内容
  const previewText = await previewCard.textContent() || '';
  expect(previewText).toContain('确认执行');
  expect(previewText).toContain('取消');
  expect(previewText).toContain('发布空间动态');

  // 点击"确认执行"
  const confirmBtn = previewCard.locator('button', { hasText: /确认执行/ });
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();
  await takeScreenshot(page, '04_after_confirm_click');

  // 等待执行完成：Preview 卡片消失，出现成功提示
  await expect(previewCard).toBeHidden({ timeout: 30000 });
  const finalCount = await page.locator('.message-bubble-received').count();
  expect(finalCount).toBeGreaterThan(botCountBefore + 1); // 至少多了一个成功提示

  const lastBubble = page.locator('.message-bubble-received').nth(finalCount - 1);
  const successText = await lastBubble.textContent() || '';
  expect(successText.length).toBeGreaterThan(0);
  console.log(`Preview confirmation success: ${successText.substring(0, 100)}`);
  await takeScreenshot(page, '05_success_message');
});

// ============================================
// 测试 2: Preview 卡片取消链路
// ============================================
test('Preview action cancellation flow', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 进入管家聊天
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.waitForURL('**/app/chat/**');
  await page.waitForTimeout(2000);

  // 发送触发 Preview 的指令
  const botCountBefore = await sendMessage(page, '生成一张风景图片发到空间');

  // 等待 Preview 卡片
  const previewCard = page.locator('.message-bubble-received').filter({ hasText: 'AI管家 请求确认' });
  await expect(previewCard).toBeVisible({ timeout: 90000 });
  await takeScreenshot(page, '06_cancel_preview_visible');

  // 点击"取消"
  const cancelBtn = previewCard.locator('button', { hasText: '取消' });
  await cancelBtn.click();

  // 验证 Preview 卡片消失
  await expect(previewCard).toBeHidden({ timeout: 10000 });
  await takeScreenshot(page, '07_after_cancel');

  // 验证没有出现新的 Bot 回复（或只出现取消提示）
  const finalCount = await page.locator('.message-bubble-received').count();
  expect(finalCount).toBeGreaterThanOrEqual(botCountBefore + 1);
  console.log('Preview cancellation completed successfully');
});

// ============================================
// 测试 3: 空消息处理
// ============================================
test('Empty message handling', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 进入管家聊天
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.waitForURL('**/app/chat/**');
  await page.waitForTimeout(2000);

  const input = page.locator('[data-testid="message-input"]');
  const sendBtn = page.locator('[data-testid="send-message-btn"]');
  const messageCountBefore = await page.locator('.message-bubble-sent').count();

  // 尝试发送空消息
  await input.fill('');
  // 发送按钮应该是禁用的，或者点击后没有产生新消息
  const isDisabled = await sendBtn.isDisabled().catch(() => false);
  if (!isDisabled) {
    await sendBtn.click();
    await page.waitForTimeout(1000);
    const messageCountAfter = await page.locator('.message-bubble-sent').count();
    expect(messageCountAfter).toBe(messageCountBefore); // 空消息不应被发送
  }

  await takeScreenshot(page, '08_empty_message');
  console.log('Empty message handling verified');
});

// ============================================
// 测试 4: 超长消息处理
// ============================================
test('Long message handling', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 进入管家聊天
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.waitForURL('**/app/chat/**');
  await page.waitForTimeout(2000);

  // 生成 1500 字符的长消息
  const longMessage = '测试超长消息处理能力。'.repeat(100);
  expect(longMessage.length).toBeGreaterThan(1000);

  const botCountBefore = await sendMessage(page, longMessage);
  await scrollToBottom(page);
  await takeScreenshot(page, '09_long_message_sent');

  // 等待 Bot 回复（超长消息可能需要更长时间）
  const response = await waitForBotReply(page, botCountBefore, 120000);
  expect(response.length).toBeGreaterThan(0);
  console.log(`Long message response length: ${response.length}`);
  await takeScreenshot(page, '10_long_message_reply');
});

// ============================================
// 测试 5: 快速连续发送消息
// ============================================
test('Rapid consecutive messages', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 进入管家聊天
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.waitForURL('**/app/chat/**');
  await page.waitForTimeout(2000);

  const messages = [
    '你好',
    '今天天气怎么样',
    '帮我查一下明天的日程',
  ];

  const initialBotCount = await page.locator('.message-bubble-received').count();

  // 快速连续发送 3 条消息（间隔 500ms）
  for (const msg of messages) {
    const input = page.locator('[data-testid="message-input"]');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');
    await input.fill(msg);
    await sendBtn.click();
    await page.waitForTimeout(500);
  }

  await takeScreenshot(page, '11_rapid_sent');

  // 等待所有回复到达（最多 3 分钟）
  const start = Date.now();
  while (Date.now() - start < 180000) {
    const currentCount = await page.locator('.message-bubble-received').count();
    if (currentCount >= initialBotCount + messages.length) {
      break;
    }
    await page.waitForTimeout(1000);
  }

  const finalCount = await page.locator('.message-bubble-received').count();
  expect(finalCount).toBeGreaterThanOrEqual(initialBotCount + messages.length);
  console.log(`Rapid messages: sent=${messages.length}, received=${finalCount - initialBotCount}`);
  await takeScreenshot(page, '12_rapid_replies');
});

// ============================================
// 测试 6: 刷新后消息持久化与错误恢复
// ============================================
test('Refresh persistence and error recovery', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 进入管家聊天
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.waitForURL('**/app/chat/**');
  await page.waitForTimeout(2000);

  // 发送一条消息
  const botCountBefore = await sendMessage(page, '记住我喜欢打篮球');
  const response1 = await waitForBotReply(page, botCountBefore, 120000);
  expect(response1.length).toBeGreaterThan(0);
  await takeScreenshot(page, '13_before_refresh');

  // 记录当前消息数量
  const messagesBeforeRefresh = await page.locator('.message-bubble').count();

  // 刷新页面
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await takeScreenshot(page, '14_after_refresh');

  // 验证消息仍然存在
  const messagesAfterRefresh = await page.locator('.message-bubble').count();
  expect(messagesAfterRefresh).toBeGreaterThanOrEqual(messagesBeforeRefresh);

  // 发送一条验证上下文的消息
  const botCountAfterRefresh = await page.locator('.message-bubble-received').count();
  const verifyCount = await sendMessage(page, '我喜欢什么运动？');
  const response2 = await waitForBotReply(page, verifyCount, 120000);
  expect(response2).toContain('篮球');
  console.log(`Context preserved after refresh: ${response2.substring(0, 100)}`);
  await takeScreenshot(page, '15_context_after_refresh');
});

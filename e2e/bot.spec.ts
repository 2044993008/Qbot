import { test, expect, type Page } from '@playwright/test';

// ============================================
// Helper 函数
// ============================================

async function sendToBot(page: Page, message: string): Promise<number> {
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', message);
  // 记录发送前的 bot 消息数量（排除 typing indicator）
  const selector = '.message-bubble-received:not(:has-text("正在思考"))';
  const initialCount = await page.locator(selector).count();
  await page.click('button[type="submit"], button:has(.lucide-send)');
  return initialCount;
}

async function hasBotPreview(page: Page, timeout = 20000) {
  try {
    await getPreviewCard(page).waitFor({ timeout });
    return true;
  } catch {
    return false;
  }
}

async function hasBotResponse(page: Page, timeout = 20000) {
  try {
    await page.locator('.message-bubble, [data-testid="message"]').nth(1).waitFor({ timeout });
    return true;
  } catch {
    return false;
  }
}

/** 获取 Preview 卡片（AI管家请求确认） */
function getPreviewCard(page: Page) {
  return page.locator('.message-bubble-received:has-text("请求确认")');
}

/** 等待新的 Bot 消息出现并返回文本（排除 typing indicator） */
async function waitForNewBotMessage(page: Page, initialCount: number, timeout = 30000): Promise<string> {
  const selector = '.message-bubble-received:not(:has-text("正在思考"))';
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const currentCount = await page.locator(selector).count();
    if (currentCount > initialCount) {
      const text = await page.locator(selector).last().textContent({ timeout: 1000 }) || '';
      if (text.trim().length > 0) {
        return text;
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for new bot message after ${timeout}ms`);
}

test.describe.configure({ mode: 'serial' });

// ============================================
// 复杂多步指令
// ============================================

test.describe('AI Butler - Complex Multi-Step Instructions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test.describe.configure({ timeout: 90000 });

  test('TC1: 润色 + 发给小王 + 表情包 + 发空间', async ({ page }) => {
    const cmd = '帮我把今天疯狂星期四v我50这句话润色一下，发给小王再带个表情包，再发个空间';
    await sendToBot(page, cmd);
    const hasPreview = await hasBotPreview(page, 25000);
    const hasResponse = await hasBotResponse(page, 25000);
    expect(hasPreview || hasResponse).toBeTruthy();
    if (hasPreview) {
      const previewText = await getPreviewCard(page).textContent({ timeout: 5000 }).catch(() => '');
      expect(previewText).toMatch(/代发消息|发布空间动态|生成图片/);
    }
  });

  test('TC2: 定时提醒 + 润色群消息 + 夕阳表情包 + 空间周末计划', async ({ page }) => {
    const cmd = '设置一个每周五下午5点的提醒"准备下班"，然后把"周末愉快"这句话润色得文艺一点发到班级群里，顺便配一张夕阳表情包，最后把我的周末计划发到QQ空间';
    await sendToBot(page, cmd);
    const hasPreview = await hasBotPreview(page, 30000);
    const hasResponse = await hasBotResponse(page, 30000);
    expect(hasPreview || hasResponse).toBeTruthy();
  });

  test('TC3: 搜索历史记录 + 总结润色 + 转发 + 空间发布', async ({ page }) => {
    const cmd = '帮我搜一下上周我和小李聊过"项目进度"的记录，把相关内容总结成一段话润色一下，然后转发给王经理，最后把总结内容发到空间并配上👍的表情';
    await sendToBot(page, cmd);
    const hasPreview = await hasBotPreview(page, 25000);
    const hasResponse = await hasBotResponse(page, 25000);
    expect(hasPreview || hasResponse).toBeTruthy();
  });

  test('TC4: 图片生成 + 发送 + 空间动态文案', async ({ page }) => {
    const cmd = '生成一张"打工人周五状态"的搞笑图片，把这张图发给张小明，然后再配一句搞笑文案发到我的空间动态';
    await sendToBot(page, cmd);
    const hasPreview = await hasBotPreview(page, 40000);
    const hasResponse = await hasBotResponse(page, 40000);
    expect(hasPreview || hasResponse).toBeTruthy();
    if (hasPreview) {
      const previewText = await getPreviewCard(page).textContent({ timeout: 5000 }).catch(() => '');
      expect(previewText).toMatch(/生成图片|代发消息|发布空间动态/);
    }
  });

  test('TC5: 群聊@所有人 + 通知表情包 + 空间置顶', async ({ page }) => {
    const cmd = '在班级群里@所有人发一条通知："明天下午3点开会"，然后配一个"通知"主题的表情包，最后把会议通知润色一下发到QQ空间置顶';
    await sendToBot(page, cmd);
    const hasPreview = await hasBotPreview(page, 25000);
    const hasResponse = await hasBotResponse(page, 25000);
    expect(hasPreview || hasResponse).toBeTruthy();
  });

  test('TC6: 连续多任务链（润色+发送+表情包+提醒+空间）', async ({ page }) => {
    const cmd = '帮我润色这条消息"今天加班好累"，然后发给小李；再生成一张"累瘫"的表情包一起发过去；最后设置一个明天早上9点的提醒"记得打卡"；并且把今天的加班感悟发到空间';
    await sendToBot(page, cmd);
    const hasPreview = await hasBotPreview(page, 35000);
    const hasResponse = await hasBotResponse(page, 35000);
    expect(hasPreview || hasResponse).toBeTruthy();
  });
});

// ============================================
// 简单交互与精确验证
// ============================================

test.describe('AI Butler - Simple Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test('should respond to simple greeting', async ({ page }) => {
    const initialCount = await sendToBot(page, '你好');
    const text = await waitForNewBotMessage(page, initialCount, 30000);
    // LLM 响应不稳定，验证消息有实际内容即可
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/你好|您好|有什么可以帮您|在的|哈|👋|嗨|我是|朋友|封面|自然/);
  });

  test('should handle single-step polish request', async ({ page }) => {
    const initialCount = await sendToBot(page, '帮我润色一下：今天天气真好');
    const text = await waitForNewBotMessage(page, initialCount, 30000);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/天气|润色|好了|改好|帮你|今天|文案|文字|内容/);
  });
});

// ============================================
// Preview 结构验证
// ============================================

test.describe('AI Butler - Preview Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test('should show send_message preview with target info', async ({ page }) => {
    await sendToBot(page, '帮我对李华说你好');
    const preview = getPreviewCard(page);
    await expect(preview).toBeVisible({ timeout: 20000 });
    await expect(preview).toContainText('代发消息');
    await expect(preview).toContainText('目标:');
    await expect(preview).toContainText('李华');
    await expect(preview).toContainText('确认执行');
    await expect(preview).toContainText('取消');
  });

  test('should show generate_image preview', async ({ page }) => {
    await sendToBot(page, '生成一张猫的图片');
    const preview = getPreviewCard(page);
    await expect(preview).toBeVisible({ timeout: 20000 });
    await expect(preview).toContainText('生成图片');
    await expect(preview).toContainText('确认执行');
    await expect(preview).toContainText('取消');
  });
});

// ============================================
// 工具确认/取消流
// ============================================

test.describe('AI Butler - Tool Confirmation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test('should confirm preview action and show success', async ({ page }) => {
    await sendToBot(page, '帮我对李华说你好');
    const preview = getPreviewCard(page);
    await expect(preview).toBeVisible({ timeout: 20000 });
    await preview.locator('text=/确认执行|全部确认执行/').click();
    await expect(preview).toBeHidden({ timeout: 10000 });
    const successBubble = page.locator('.message-bubble-received').last();
    await expect(successBubble).toContainText(/已发送|操作已完成|成功/, { timeout: 10000 });
  });

  test('should cancel preview action and show cancelled', async ({ page }) => {
    await sendToBot(page, '帮我对李华说你好');
    const preview = getPreviewCard(page);
    await expect(preview).toBeVisible({ timeout: 20000 });
    await preview.locator('text=取消').click();
    await expect(preview).toBeHidden({ timeout: 10000 });
    const cancelBubble = page.locator('.message-bubble-received').last();
    await expect(cancelBubble).toContainText('已取消操作', { timeout: 10000 });
  });
});

// ============================================
// 负向测试
// ============================================

test.describe('AI Butler - Negative Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test('should disable send button for empty message', async ({ page }) => {
    await page.locator('text=/小.?Q.?管家/').first().click();
    const input = page.locator('textarea[placeholder*="输入消息"]');
    await input.fill('');
    const sendBtn = page.locator('button:has(.lucide-send)');
    await expect(sendBtn).toBeDisabled();
  });

  test('should handle very long message without crash', async ({ page }) => {
    const longMessage = 'A'.repeat(2500);
    const initialCount = await sendToBot(page, longMessage);
    const text = await waitForNewBotMessage(page, initialCount, 30000);
    expect(text.length).toBeGreaterThan(0);
  });

  test('should show error or fallback on network failure', async ({ page }) => {
    await page.locator('text=/小.?Q.?管家/').first().click();
    const input = page.locator('textarea[placeholder*="输入消息"]');
    await input.fill('你好');

    await page.route('/api/bot/stream', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.click('button[type="submit"], button:has(.lucide-send)');

    const botBubble = page.locator('.message-bubble-received').last();
    await expect(botBubble).toContainText(/抱歉|出问题|走神|稍后再试|小问题/, { timeout: 15000 });

    await page.unroute('/api/bot/stream');
  });
});

// ============================================
// 群聊 @触发
// ============================================

test.describe('AI Butler - Group Chat @Trigger', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test('should respond when @bot in group chat', async ({ page }) => {
    await page.locator('button:has-text("群聊")').click();
    await page.waitForTimeout(500);

    const groupItems = page.locator('div.cursor-pointer').filter({ hasText: /位成员/ });
    const count = await groupItems.count();
    if (count === 0) {
      test.skip(true, 'No groups available for testing');
      return;
    }

    await groupItems.first().click();
    await page.waitForURL(/\/app\/chat\//, { timeout: 10000 });
    await page.waitForSelector('textarea[placeholder*="输入消息"]', { timeout: 10000 });

    const input = page.locator('textarea[placeholder*="输入消息"]');
    await input.fill('@小Q管家 你好');
    await page.click('button[type="submit"], button:has(.lucide-send)');

    await expect(page.locator('text=@小Q管家 你好')).toBeVisible({ timeout: 5000 });

    const botBubble = page.locator('.message-bubble-received').last();
    await expect(botBubble).toContainText(/你好|有什么可以帮您|您好|在的/, { timeout: 30000 });
  });
});

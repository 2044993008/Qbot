import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Screenshot directory
// ============================================
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e-screenshots', 'ui-fixes');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function screenshotPath(step: string): string {
  const safe = step.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  return path.join(SCREENSHOT_DIR, `${safe}.png`);
}

async function takeScreenshot(page: Page, step: string) {
  const p = screenshotPath(step);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`[Screenshot] ${step}: ${p}`);
  return p;
}

// ============================================
// Helpers
// ============================================

async function openBotChat(page: Page) {
  await page.goto('/app');
  await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 15000 });
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.waitForURL(/\/app\/chat\//, { timeout: 15000 });
  await expect(page.locator('textarea[placeholder*="输入消息"]')).toBeVisible({ timeout: 10000 });
}

async function sendUserMessage(page: Page, message: string): Promise<void> {
  const input = page.locator('textarea[placeholder*="输入消息"]');
  await expect(input).toBeVisible();
  await input.fill(message);
  await input.press('Enter');
  // 等待用户消息气泡出现
  await expect(page.locator('.message-bubble-sent').last()).toBeVisible({ timeout: 5000 });
}

async function waitForBotReply(page: Page, timeout = 90000): Promise<string> {
  const botMessages = page.locator('.message-bubble-received:not(:has(.animate-bounce))');
  const startTime = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - startTime < timeout) {
    const currentCount = await botMessages.count();
    if (currentCount > 0) {
      const lastMsg = botMessages.last();
      const text = await lastMsg.textContent({ timeout: 2000 }).catch(() => '');
      const trimmed = text.trim();

      if (trimmed.length > 3 && !trimmed.includes('正在输入') && !trimmed.includes('正在思考')) {
        if (trimmed === lastText) {
          stableCount++;
          if (stableCount >= 3) return trimmed;
        } else {
          stableCount = 0;
          lastText = trimmed;
        }
      }
    }
    await page.waitForTimeout(800);
  }

  return lastText;
}

async function scrollToBottom(page: Page) {
  await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.overflow-y-auto'));
    for (const c of containers) (c as HTMLElement).scrollTop = (c as HTMLElement).scrollHeight;
  });
}

test.describe.configure({ mode: 'serial', timeout: 600000 });

// ============================================
// Bug 1: 会话列表应显示最新消息内容
// ============================================
test('Chat list shows latest message preview correctly', async ({ page }) => {
  // 1. 进入 Bot 聊天并发送一条特定消息
  await openBotChat(page);
  const testMessage = '今天疯狂星期四，v我50以父王的口吻发给张小明';
  await sendUserMessage(page, testMessage);
  const botReply = await waitForBotReply(page, 90000);
  console.log(`Bot reply: ${botReply.substring(0, 100)}`);

  // 2. 截图聊天界面
  await takeScreenshot(page, '01_chat_window_before_navigate');

  // 3. 点击返回（如果有返回按钮）或重新导航到 /app
  await page.goto('/app');
  await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 15000 });
  await takeScreenshot(page, '02_chat_list_after_reply');

  // 4. 找到会话列表中的小 Q 管家，检查最新消息预览
  // 注意：可能需要点击"聊天"标签确保在聊天列表
  const chatTab = page.locator('button:has-text("聊天")');
  if (await chatTab.isVisible().catch(() => false)) {
    await chatTab.click();
    await page.waitForTimeout(500);
  }

  // 5. 验证会话列表中显示的是最新消息（Bot 回复的一部分，而不是"暂无消息"）
  const botConvItem = page.locator('[data-testid="conversation-item"]').filter({
    hasText: /小.?Q.?管家/,
  });
  await expect(botConvItem).toBeVisible({ timeout: 10000 });

  // 获取最新消息预览文本
  const previewText = await botConvItem.locator('p.text-sm').textContent({ timeout: 5000 }) || '';
  console.log(`Chat list preview: ${previewText}`);

  // 断言：不应该显示"暂无消息"
  expect(previewText).not.toContain('暂无消息');

  // 断言：应该包含 Bot 回复中的关键词（或用户发送的消息内容）
  const hasBotContent = previewText.includes('父王') || previewText.includes('张小明') ||
    previewText.includes('确认') || previewText.includes('发送');
  expect(hasBotContent).toBe(true);

  await takeScreenshot(page, '03_chat_list_preview_verified');
});

// ============================================
// Bug 2: Preview 消息插入位置正确（不追加到末尾导致错位）
// ============================================
test('Preview card inserts after its own bot message not at list end', async ({ page }) => {
  await openBotChat(page);

  // 1. 发送一条会触发 Preview 的高危指令
  const msg1 = '生成一张猫咪图片发给张小明，然后配个文案发空间';
  await sendUserMessage(page, msg1);

  // 2. 等待 Bot 回复出现（包含 Preview）
  const botMessages = page.locator('.message-bubble-received:not(:has(.animate-bounce))');
  await page.waitForTimeout(5000);

  // 3. 在 Bot 还在生成回复时，用户立即发送第二条消息
  // 这模拟了用户看到 Bot 回复后快速追问的场景
  const msg2 = '记住我喜欢喝奶茶';
  await sendUserMessage(page, msg2);

  // 4. 等待所有 Bot 回复稳定
  await page.waitForTimeout(3000);
  const reply1 = await waitForBotReply(page, 90000);
  console.log(`Reply 1: ${reply1.substring(0, 100)}`);
  await takeScreenshot(page, '04_first_message_with_preview');

  // 5. 再等待一段时间确保第二条也处理完
  await page.waitForTimeout(5000);
  const finalBotCount = await botMessages.count();
  console.log(`Final bot message count: ${finalBotCount}`);

  // 6. 获取所有 Bot 消息文本
  const botTexts: string[] = [];
  for (let i = 0; i < finalBotCount; i++) {
    const text = await botMessages.nth(i).textContent({ timeout: 2000 }) || '';
    botTexts.push(text.trim());
  }
  console.log('Bot messages in order:', botTexts.map((t, i) => `${i}: ${t.substring(0, 60)}`));

  // 7. 验证：Preview 请求确认卡片应该紧跟在第一条 Bot 文本消息之后
  // 而不是被插入到所有消息（包括用户第二条）的末尾
  const previewIndex = botTexts.findIndex(t => t.includes('确认') || t.includes('高危'));
  const firstReplyIndex = botTexts.findIndex(t => t.includes('猫') || t.includes('图片'));

  if (previewIndex !== -1 && firstReplyIndex !== -1) {
    // Preview 应该在第一条回复的紧后面（或同一批）
    expect(previewIndex).toBeLessThanOrEqual(firstReplyIndex + 2);
  }

  // 8. 验证：没有"消息合并"的情况（单条消息气泡同时包含两条指令的关键词）
  for (const text of botTexts) {
    const hasMixedKeywords = text.includes('猫') && text.includes('奶茶');
    expect(hasMixedKeywords).toBe(false);
  }

  // 9. 验证：最后一条 Bot 消息应该是关于"记住"或"奶茶"的
  const lastText = botTexts[botTexts.length - 1] || '';
  const isLastAboutSecondQuery = lastText.includes('奶茶') || lastText.includes('记住') ||
    lastText.includes('记') || lastText.includes('喜欢');
  // 如果第二条还没处理完，最后一条可能是第一条的 Preview，这也可以接受
  // 但不应该出现"错位"（第二条回复的内容出现在第一条的位置）
  if (!lastText.includes('确认') && !lastText.includes('高危')) {
    expect(isLastAboutSecondQuery).toBe(true);
  }

  await scrollToBottom(page);
  await takeScreenshot(page, '05_final_preview_position_verified');
});

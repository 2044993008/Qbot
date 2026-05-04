import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Screenshot directory
// ============================================
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e-screenshots', 'bot-conversation-chain');
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
  await expect(page.locator('button:has-text("好友")')).toBeVisible({ timeout: 10000 });
  await page.locator('button:has-text("好友")').click();
  const botLocator = page.locator('text=/小.?Q.?管家/').first();
  await expect(botLocator).toBeVisible({ timeout: 10000 });
  await botLocator.click();
  await page.waitForURL(/\/app\/chat\//, { timeout: 15000 });
  await expect(page.locator('textarea[placeholder*="输入消息"]')).toBeVisible({ timeout: 10000 });
}

async function sendMessage(page: Page, message: string): Promise<number> {
  const input = page.locator('textarea[placeholder*="输入消息"]');
  await expect(input).toBeVisible();
  await input.fill(message);

  const userMessages = page.locator('.message-bubble-sent');
  const userCountBefore = await userMessages.count();

  // 记录当前 Bot 消息数量（不含 typing indicator）
  const botMessages = page.locator('.message-bubble-received:not(:has(.animate-bounce))');
  const botCountBefore = await botMessages.count();

  await input.press('Enter');
  await expect.poll(async () => await userMessages.count(), { timeout: 10000, intervals: [300] }).toBeGreaterThan(userCountBefore);

  return botCountBefore;
}

/**
 * 等待新增 Bot 回复完成。
 * @param initialBotCount 发送指令前已有的 Bot 消息数量（不含 typing indicator）
 */
async function waitForBotReply(page: Page, initialBotCount: number, timeout = 60000): Promise<string> {
  const botMessages = page.locator('.message-bubble-received:not(:has(.animate-bounce))');
  const startTime = Date.now();
  let lastText = '';
  let stableCount = 0;

  while (Date.now() - startTime < timeout) {
    const currentCount = await botMessages.count();

    // 必须出现新增的 Bot 消息（数量 > initialBotCount）
    if (currentCount > initialBotCount) {
      const lastMsg = botMessages.last();
      const text = await lastMsg.textContent({ timeout: 2000 }).catch(() => '');
      const trimmed = text.trim();

      // 排除 typing indicator 和空内容
      if (trimmed.length > 3 && !trimmed.includes('正在思考')) {
        // 检查内容是否稳定（SSE 打字机效果是否结束）
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

  // 超时返回当前最后一条消息
  const text = await botMessages.last().textContent({ timeout: 2000 }).catch(() => '');
  return text.trim();
}

async function checkPreviewCard(page: Page, timeout = 15000) {
  const previewCard = page.locator('.message-bubble-received:has-text("请求确认")');
  try {
    await expect(previewCard).toBeVisible({ timeout });
    return previewCard;
  } catch {
    return null;
  }
}

async function scrollToBottom(page: Page) {
  await page.evaluate(() => {
    const containers = document.querySelectorAll('.overflow-y-auto');
    for (const c of containers) (c as HTMLElement).scrollTop = c.scrollHeight;
  });
}

// ============================================
// 10 Complex Commands
// ============================================

interface TestCommand {
  id: string;
  name: string;
  command: string;
  expectedKeywords: string[];
  description: string;
}

const COMMANDS: TestCommand[] = [
  {
    id: 'RC1',
    name: 'Identity_Memory_Greeting',
    command: '你以后叫我老大，记住我喜欢吃火锅，然后跟我说句话',
    expectedKeywords: ['老大', '火锅'],
    description: 'write_identity + write_memory + read_identity',
  },
  {
    id: 'RC2',
    name: 'Search_Polish_Send',
    command: '搜一下群里关于项目的消息，把相关内容润色一下发给小李',
    expectedKeywords: ['搜索', '润色', '小李'],
    description: 'search_messages + polish_text + send_message',
  },
  {
    id: 'RC3',
    name: 'Image_Send_Moment',
    command: '生成一张猫咪图片发给张小明，然后配个文案发空间',
    expectedKeywords: ['猫', '发送', '空间'],
    description: 'generate_image + send_message + publish_moment',
  },
  {
    id: 'RC4',
    name: 'Summary_Task',
    command: '看看我最近在班级群发了什么，润色成工作总结，然后设置每周五下午5点的工作汇报提醒',
    expectedKeywords: ['工作总结', '提醒'],
    description: 'get_my_messages + polish_text + create_task',
  },
  {
    id: 'RC5',
    name: 'Memory_Moment',
    command: '读一下我的记忆，根据我的喜好生成一条空间动态文案并发布',
    expectedKeywords: ['记忆', '空间', '发布'],
    description: 'read_memory + suggest_moment + publish_moment',
  },
  {
    id: 'RC6',
    name: 'Info_Rename_Memory',
    command: '告诉我我的信息，然后把你名字改成小助手，记住我喜欢跑步',
    expectedKeywords: ['小助手', '跑步'],
    description: 'get_user_info + write_identity + write_memory',
  },
  {
    id: 'RC7',
    name: 'Polish_Group_Image',
    command: '把"周末去爬山"润色得文艺一点发到班级群，再生成一张山景图片也发群里',
    expectedKeywords: ['爬山', '班级群', '图片'],
    description: 'polish_text + send_message + generate_image',
  },
  {
    id: 'RC8',
    name: 'Search_Moment_Task',
    command: '搜一下上周关于会议的消息，总结成通知文案发到空间，再设一个明天早上9点的会议提醒',
    expectedKeywords: ['会议', '空间', '提醒'],
    description: 'search_messages + publish_moment + create_task',
  },
  {
    id: 'RC9',
    name: 'Identity_Verify',
    command: '你叫什么名字？以后叫我老板，然后确认一下你的新名字',
    expectedKeywords: ['老板', '名字'],
    description: 'read_identity + write_identity + read_identity',
  },
  {
    id: 'RC10',
    name: 'Image_Moment_Memory',
    command: '生成一张美食图片发到空间，记住我今天想吃日料',
    expectedKeywords: ['美食', '空间', '日料'],
    description: 'generate_image + publish_moment + write_memory',
  },
];

// ============================================
// Test: Single page continuous conversation
// ============================================

test.describe.configure({ mode: 'serial', timeout: 600000 });

test('AI Butler - Single page continuous complex command chain', async ({ page }) => {
  const results: Array<{
    id: string;
    command: string;
    response: string;
    matchedKeywords: string[];
    hasPreview: boolean;
    durationMs: number;
  }> = [];

  // Step 0: Open app and enter bot chat
  await page.goto('/app');
  await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 15000 });
  await takeScreenshot(page, '00_initial_page');

  await openBotChat(page);
  await takeScreenshot(page, '01_enter_bot_chat');

  // Execute 10 commands continuously
  for (let i = 0; i < COMMANDS.length; i++) {
    const cmd = COMMANDS[i];
    const stepNum = String(i + 1).padStart(2, '0');
    const startTime = Date.now();

    console.log(`\n========== ${cmd.id}: ${cmd.name} ==========`);
    console.log(`Command: ${cmd.command}`);

    // Screenshot before sending (should show previous conversation)
    await scrollToBottom(page);
    await takeScreenshot(page, `${stepNum}_${cmd.id}_before_send`);

    // Send command (returns bot count before sending)
    const botCountBefore = await sendMessage(page, cmd.command);
    await scrollToBottom(page);
    await takeScreenshot(page, `${stepNum}_${cmd.id}_after_send`);

    // Wait for NEW bot reply (must be > botCountBefore)
    const response = await waitForBotReply(page, botCountBefore, 60000);
    const durationMs = Date.now() - startTime;

    await scrollToBottom(page);
    await takeScreenshot(page, `${stepNum}_${cmd.id}_received_reply`);

    // Check preview card
    const previewCard = await checkPreviewCard(page, 5000);
    const hasPreview = !!previewCard;
    if (hasPreview) {
      await takeScreenshot(page, `${stepNum}_${cmd.id}_preview_card`);
      const previewText = await previewCard.textContent({ timeout: 3000 }) || '';
      expect(previewText).toContain('确认执行');
      expect(previewText).toContain('取消');
      await previewCard.locator('text=取消').click();
      await expect(previewCard).toBeHidden({ timeout: 10000 });
      await takeScreenshot(page, `${stepNum}_${cmd.id}_after_cancel`);
    }

    const matchedKeywords = cmd.expectedKeywords.filter(kw => response.includes(kw));
    console.log(`Response: ${response.substring(0, 150)}...`);
    console.log(`Matched keywords: ${matchedKeywords.join(', ') || '(none)'}`);
    console.log(`Duration: ${durationMs}ms`);

    // 指令间间隔：确保前一个请求的 SSE 流完全关闭，减少并发压力
    if (i < COMMANDS.length - 1) {
      await page.waitForTimeout(3000);
    }

    results.push({
      id: cmd.id,
      command: cmd.command,
      response,
      matchedKeywords,
      hasPreview,
      durationMs,
    });
  }

  // Step 11: Context verification
  console.log('\n========== Context Verification ==========');
  const ctxBotCount = await sendMessage(page, '你还记得我叫什么吗？我喜欢吃什么？');
  const contextResponse = await waitForBotReply(page, ctxBotCount, 60000);
  await takeScreenshot(page, '11_context_verification');
  console.log(`Context response: ${contextResponse.substring(0, 150)}...`);

  const hasContext = ['老大', '火锅', '日料', '老板'].some(kw => contextResponse.includes(kw));

  // Step 12: Persistence verification
  console.log('\n========== Persistence Verification ==========');
  await page.reload();
  await page.waitForURL(/\/app\/chat\//, { timeout: 15000 });
  await expect(page.locator('textarea[placeholder*="输入消息"]')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);
  await scrollToBottom(page);
  await takeScreenshot(page, '12_after_refresh_persistence');

  const pageContent = await page.content();
  const hasHistory = COMMANDS.some(cmd => pageContent.includes(cmd.command.substring(0, 10)));
  console.log(`History exists after refresh: ${hasHistory}`);

  // Generate report
  const report = {
    generatedAt: new Date().toISOString(),
    totalCommands: COMMANDS.length,
    results,
    contextVerification: {
      question: '你还记得我叫什么吗？我喜欢吃什么？',
      response: contextResponse,
      hasContext,
    },
    persistenceVerification: { hasHistory },
    screenshots: fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort(),
  };

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  // Summary
  console.log('\n========== Test Summary ==========');
  console.log(`Total commands: ${report.totalCommands}`);
  console.log(`Context preserved: ${hasContext ? 'YES' : 'NO'}`);
  console.log(`Messages persisted: ${hasHistory ? 'YES' : 'NO'}`);
  console.log('');

  for (const r of results) {
    const status = r.matchedKeywords.length > 0 ? 'PASS' : 'WARN';
    const kw = r.matchedKeywords.join(', ') || 'none';
    console.log(`${status} ${r.id}: keywords=[${kw}] preview=${r.hasPreview} duration=${r.durationMs}ms`);
  }
  console.log('==================================\n');

  const passCount = results.filter(r => r.matchedKeywords.length > 0).length;
  expect(passCount).toBeGreaterThanOrEqual(Math.ceil(COMMANDS.length * 0.6));
});

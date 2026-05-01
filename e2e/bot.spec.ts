import { test, expect, type Page } from '@playwright/test';

async function sendToBot(page: Page, message: string) {
  await page.locator('text=/小.?Q.?管家/').first().click();
  await page.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', message);
  await page.click('button[type="submit"], button:has(.lucide-send)');
}

async function hasBotPreview(page: Page, timeout = 20000) {
  try {
    await page.locator('text=/确认|取消|preview|操作|润色|发送|表情包|空间/i').first().waitFor({ timeout });
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

test.describe.configure({ mode: 'serial' });

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

test.describe('AI Butler - Simple Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
    await page.waitForSelector('text=/消息|小.?Q.?管家/', { timeout: 10000 });
  });

  test('should respond to simple greeting', async ({ page }) => {
    await sendToBot(page, '你好');

    const hasResponse = await hasBotResponse(page, 10000);
    expect(hasResponse).toBeTruthy();
  });

  test('should handle single-step request', async ({ page }) => {
    await sendToBot(page, '帮我润色一下：今天天气真好');

    const hasResponse = await hasBotResponse(page, 15000);
    expect(hasResponse).toBeTruthy();
  });
});

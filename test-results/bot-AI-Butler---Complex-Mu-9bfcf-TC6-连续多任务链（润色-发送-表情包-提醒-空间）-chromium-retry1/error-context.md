# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bot.spec.ts >> AI Butler - Complex Multi-Step Instructions >> TC6: 连续多任务链（润色+发送+表情包+提醒+空间）
- Location: e2e\bot.spec.ts:99:7

# Error details

```
Test timeout of 90000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 90000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e6]: Q
      - heading "仿 QQ" [level=1] [ref=e7]
      - paragraph [ref=e8]: 即时通讯，轻松连接
    - generic [ref=e10]:
      - tablist [ref=e11]:
        - tab "登录" [selected] [ref=e12]
        - tab "注册" [ref=e13]
      - tabpanel "登录" [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]:
            - generic [ref=e17]: 欢迎回来
            - generic [ref=e18]: 输入您的账号信息登录
          - generic [ref=e19]:
            - generic [ref=e20]: 请求过于频繁，请稍后再试
            - generic [ref=e21]:
              - generic [ref=e22]: QQ号
              - textbox "QQ号" [ref=e23]:
                - /placeholder: 请输入QQ号
                - text: "10001"
            - generic [ref=e24]:
              - generic [ref=e25]: 密码
              - textbox "密码" [ref=e26]:
                - /placeholder: 请输入密码
                - text: "123456"
            - button "登录" [ref=e27]
            - paragraph [ref=e29]: 测试账号：QQ号 10001，密码 123456
  - button "Open Next.js Dev Tools" [ref=e35] [cursor=pointer]:
    - img [ref=e36]
  - alert [ref=e39]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const TEST_USER = {
  4   |   qq_number: '10001',
  5   |   password: '123456',
  6   | };
  7   | 
  8   | async function login(page: any) {
  9   |   await page.goto('/login');
  10  |   await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
  11  |   await page.fill('input[type="password"]', TEST_USER.password);
  12  |   await page.click('button[type="submit"]');
> 13  |   await page.waitForURL(/\/app/);
      |              ^ Error: page.waitForURL: Test timeout of 90000ms exceeded.
  14  | }
  15  | 
  16  | async function sendToBot(page: any, message: string) {
  17  |   await page.locator('text=/小.?Q.?管家/').first().click();
  18  |   await page.fill('input[placeholder*="输入消息"], textarea[placeholder*="输入消息"]', message);
  19  |   await page.click('button[type="submit"], button:has(.lucide-send)');
  20  | }
  21  | 
  22  | async function hasBotPreview(page: any, timeout = 20000) {
  23  |   try {
  24  |     await page.locator('text=/确认|取消|preview|操作|润色|发送|表情包|空间/i').first().waitFor({ timeout });
  25  |     return true;
  26  |   } catch {
  27  |     return false;
  28  |   }
  29  | }
  30  | 
  31  | async function hasBotResponse(page: any, timeout = 20000) {
  32  |   try {
  33  |     await page.locator('.message-bubble, [data-testid="message"]').nth(1).waitFor({ timeout });
  34  |     return true;
  35  |   } catch {
  36  |     return false;
  37  |   }
  38  | }
  39  | 
  40  | test.describe.configure({ mode: 'serial' });
  41  | 
  42  | test.describe('AI Butler - Complex Multi-Step Instructions', () => {
  43  |   test.beforeEach(async ({ page }) => {
  44  |     await login(page);
  45  |   });
  46  | 
  47  |   test.describe.configure({ timeout: 90000 });
  48  | 
  49  |   test('TC1: 润色 + 发给小王 + 表情包 + 发空间', async ({ page }) => {
  50  |     const cmd = '帮我把今天疯狂星期四v我50这句话润色一下，发给小王再带个表情包，再发个空间';
  51  |     await sendToBot(page, cmd);
  52  | 
  53  |     const hasPreview = await hasBotPreview(page, 25000);
  54  |     const hasResponse = await hasBotResponse(page, 25000);
  55  | 
  56  |     expect(hasPreview || hasResponse).toBeTruthy();
  57  |   });
  58  | 
  59  |   test('TC2: 定时提醒 + 润色群消息 + 夕阳表情包 + 空间周末计划', async ({ page }) => {
  60  |     const cmd = '设置一个每周五下午5点的提醒"准备下班"，然后把"周末愉快"这句话润色得文艺一点发到班级群里，顺便配一张夕阳表情包，最后把我的周末计划发到QQ空间';
  61  |     await sendToBot(page, cmd);
  62  | 
  63  |     const hasPreview = await hasBotPreview(page, 30000);
  64  |     const hasResponse = await hasBotResponse(page, 30000);
  65  | 
  66  |     expect(hasPreview || hasResponse).toBeTruthy();
  67  |   });
  68  | 
  69  |   test('TC3: 搜索历史记录 + 总结润色 + 转发 + 空间发布', async ({ page }) => {
  70  |     const cmd = '帮我搜一下上周我和小李聊过"项目进度"的记录，把相关内容总结成一段话润色一下，然后转发给王经理，最后把总结内容发到空间并配上👍的表情';
  71  |     await sendToBot(page, cmd);
  72  | 
  73  |     const hasPreview = await hasBotPreview(page, 25000);
  74  |     const hasResponse = await hasBotResponse(page, 25000);
  75  | 
  76  |     expect(hasPreview || hasResponse).toBeTruthy();
  77  |   });
  78  | 
  79  |   test('TC4: 图片生成 + 发送 + 空间动态文案', async ({ page }) => {
  80  |     const cmd = '生成一张"打工人周五状态"的搞笑图片，把这张图发给张小明，然后再配一句搞笑文案发到我的空间动态';
  81  |     await sendToBot(page, cmd);
  82  | 
  83  |     const hasPreview = await hasBotPreview(page, 40000);
  84  |     const hasResponse = await hasBotResponse(page, 40000);
  85  | 
  86  |     expect(hasPreview || hasResponse).toBeTruthy();
  87  |   });
  88  | 
  89  |   test('TC5: 群聊@所有人 + 通知表情包 + 空间置顶', async ({ page }) => {
  90  |     const cmd = '在班级群里@所有人发一条通知："明天下午3点开会"，然后配一个"通知"主题的表情包，最后把会议通知润色一下发到QQ空间置顶';
  91  |     await sendToBot(page, cmd);
  92  | 
  93  |     const hasPreview = await hasBotPreview(page, 25000);
  94  |     const hasResponse = await hasBotResponse(page, 25000);
  95  | 
  96  |     expect(hasPreview || hasResponse).toBeTruthy();
  97  |   });
  98  | 
  99  |   test('TC6: 连续多任务链（润色+发送+表情包+提醒+空间）', async ({ page }) => {
  100 |     const cmd = '帮我润色这条消息"今天加班好累"，然后发给小李；再生成一张"累瘫"的表情包一起发过去；最后设置一个明天早上9点的提醒"记得打卡"；并且把今天的加班感悟发到空间';
  101 |     await sendToBot(page, cmd);
  102 | 
  103 |     const hasPreview = await hasBotPreview(page, 35000);
  104 |     const hasResponse = await hasBotResponse(page, 35000);
  105 | 
  106 |     expect(hasPreview || hasResponse).toBeTruthy();
  107 |   });
  108 | });
  109 | 
  110 | test.describe('AI Butler - Simple Interactions', () => {
  111 |   test.beforeEach(async ({ page }) => {
  112 |     await login(page);
  113 |   });
```
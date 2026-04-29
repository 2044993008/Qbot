# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> should show error with non-existent user
- Location: e2e\auth.spec.ts:31:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=/用户不存在|登录失败/')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=/用户不存在|登录失败/')

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
                - text: "99999"
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
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const TEST_USER = {
  4  |   qq_number: '10001',
  5  |   password: '123456',
  6  |   nickname: 'DemoUser',
  7  | };
  8  | 
  9  | test.describe('Authentication', () => {
  10 |   test.beforeEach(async ({ page }) => {
  11 |     await page.goto('/login');
  12 |   });
  13 | 
  14 |   test('should login with valid credentials', async ({ page }) => {
  15 |     await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
  16 |     await page.fill('input[type="password"]', TEST_USER.password);
  17 |     await page.click('button[type="submit"]');
  18 | 
  19 |     await expect(page).toHaveURL(/\/app/);
  20 |     await expect(page.getByRole('link', { name: '消息' })).toBeVisible();
  21 |   });
  22 | 
  23 |   test('should show error with invalid password', async ({ page }) => {
  24 |     await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
  25 |     await page.fill('input[type="password"]', 'wrongpassword');
  26 |     await page.click('button[type="submit"]');
  27 | 
  28 |     await expect(page.locator('text=/密码错误|登录失败/')).toBeVisible();
  29 |   });
  30 | 
  31 |   test('should show error with non-existent user', async ({ page }) => {
  32 |     await page.fill('input[placeholder*="QQ"]', '99999');
  33 |     await page.fill('input[type="password"]', '123456');
  34 |     await page.click('button[type="submit"]');
  35 | 
> 36 |     await expect(page.locator('text=/用户不存在|登录失败/')).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
  37 |   });
  38 | 
  39 |   test('should logout successfully', async ({ page }) => {
  40 |     // 先登录
  41 |     await page.fill('input[placeholder*="QQ"]', TEST_USER.qq_number);
  42 |     await page.fill('input[type="password"]', TEST_USER.password);
  43 |     await page.click('button[type="submit"]');
  44 |     await page.waitForURL(/\/app/);
  45 | 
  46 |     // 打开设置菜单
  47 |     await page.click('button:has(.lucide-settings)');
  48 |     await page.getByRole('button', { name: '退出登录' }).click();
  49 | 
  50 |     await expect(page).toHaveURL(/\/login/);
  51 |   });
  52 | });
  53 | 
```
/**
 * E2E Test: Complex Multi-Step Command via Non-Streaming API
 * Command: "帮我写一条关于疯狂星期四的搞笑文案，润色后发给张小明，再配一张疯狂星期四的表情包，最后发到我的QQ空间"
 */
const { chromium } = require("playwright");
const path = require("path");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name) {
  const screenshotPath = path.join(
    __dirname,
    "..",
    "test-results",
    `complex-api-${name}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

async function runTest() {
  console.log("🚀 Testing complex command via non-streaming API...\n");

  const browser = await chromium.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // Login
    console.log("🔑 Logging in...");
    await page.goto("http://localhost:5000/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[placeholder*="QQ"]', "10001");
    await page.fill('input[type="password"]', "123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app**", { timeout: 10000 });
    console.log("✅ Login successful\n");

    // Get auth token
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    const token = authCookie ? authCookie.value : '';

    // Complex command test
    const complexCommand = "帮我写一条关于疯狂星期四的搞笑文案，润色后发给张小明，再配一张疯狂星期四的表情包，最后发到我的QQ空间";
    console.log(`📨 Sending complex command: "${complexCommand}"`);
    console.log("⏳ Waiting for Agent编排器处理 (up to 40s)...\n");

    const startTime = Date.now();
    const apiResponse = await page.evaluate(async (args) => {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: args.command,
          conversation_id: 5
        })
      });
      return res.json();
    }, { command: complexCommand });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ API responded in ${elapsed}s\n`);
    console.log("=== API Response ===");
    console.log(JSON.stringify(apiResponse, null, 2));
    console.log("====================\n");

    // Analyze response
    console.log("📊 Analysis:");
    console.log(`  Type: ${apiResponse.type || 'text'}`);
    console.log(`  Has preview: ${!!apiResponse.preview}`);
    console.log(`  Has tool calls: ${!!(apiResponse.toolCalls?.length)}`);
    
    if (apiResponse.preview) {
      console.log(`  Preview action: ${apiResponse.preview.action}`);
      console.log(`  Preview target: ${apiResponse.preview.target}`);
    }
    
    // Check if complex request was detected and planned
    const responseText = apiResponse.response || '';
    const checks = [
      { name: "计划/步骤", pattern: /步骤|计划|第一步|第二步|先.*再/i },
      { name: "润色文案", pattern: /文案|润色|疯狂星期四/i },
      { name: "发送消息", pattern: /发送|发给|消息/i },
      { name: "生成图片", pattern: /表情包|图片|生成/i },
      { name: "QQ空间", pattern: /空间|动态|moment/i },
      { name: "预览/确认", pattern: /确认|preview|预览|是否/i },
    ];
    
    console.log("\n📋 Content Checks:");
    checks.forEach((check) => {
      const found = check.pattern.test(responseText);
      console.log(`  ${found ? "✅" : "❌"} ${check.name}`);
    });

    // Refresh and screenshot
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=/小.?Q.?管家/", { timeout: 10000 });
    await page.locator("text=/小.?Q.?管家/").first().click();
    await delay(2000);
    await captureScreenshot(page, "final-state");

    console.log("\n✅ Complex command API test completed!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    await captureScreenshot(page, "error");
    throw error;
  } finally {
    await browser.close();
  }
}

const fs = require("fs");
const resultsDir = path.join(__dirname, "..", "test-results");
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});

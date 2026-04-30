/**
 * E2E Test: Complex command via frontend streaming
 */
const { chromium } = require("playwright");
const path = require("path");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, "..", "test-results", `stream-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

async function runTest() {
  console.log("🚀 Testing complex command via frontend streaming...\n");

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

    // Open bot chat
    console.log("🤖 Opening bot chat...");
    await page.waitForSelector("text=/小.?Q.?管家/", { timeout: 10000 });
    await page.locator("text=/小.?Q.?管家/").first().click();
    await delay(2000);

    // Send complex command
    const complexCommand = "帮我写一条关于疯狂星期四的搞笑文案，润色后发给张小明，再配一张疯狂星期四的表情包，最后发到我的QQ空间";
    console.log(`📨 Sending: "${complexCommand}"`);
    const messageInput = page.locator('input[placeholder*="消息"], textarea[placeholder*="消息"], [data-testid="message-input"]').first();
    await messageInput.fill(complexCommand);
    await messageInput.press("Enter");

    console.log("⏳ Waiting for Agent response (up to 40s)...\n");

    // Wait for response to complete
    await delay(25000);
    await captureScreenshot(page, "01-response");

    // Check for preview cards
    const previewCards = await page.locator("text=/AI管家 请求确认|共 .* 项操作|确认执行/").all();
    console.log(`🔍 Found ${previewCards.length} preview-related elements`);

    // Extract conversation text
    const allMessages = await page.locator("[class*='message']").allTextContents();
    console.log("\n=== Conversation Log ===");
    allMessages.slice(-6).forEach((msg, i) => {
      if (msg.trim()) {
        console.log(`[${i}] ${msg.trim().substring(0, 200)}${msg.length > 200 ? "..." : ""}`);
      }
    });
    console.log("========================\n");

    console.log("✅ Streaming test completed!");

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

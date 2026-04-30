/**
 * E2E Test: Simple Tool Call Verification
 * Tests if basic tool calls work correctly
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
    `tool-test-${name}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

async function runTest() {
  console.log("🚀 Starting simple tool call E2E test...\n");

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
    const botChatItem = page.locator("text=/小.?Q.?管家/").first();
    await botChatItem.click();
    await delay(2000);

    // Test using direct API call to /api/bot (non-streaming, with agent)
    console.log("🧪 Testing non-streaming /api/bot endpoint with agent...");
    
    // Get auth token from cookie
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name === 'auth-token');
    const token = authCookie ? authCookie.value : '';
    
    // Test 1: Simple tool call via API
    console.log("📡 Test 1: Direct API - Polish text...");
    const apiResponse1 = await page.evaluate(async (token) => {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: '帮我润色一下：今天天气真好，我想去公园玩。要求文艺一点。',
          conversation_id: 5
        })
      });
      return res.json();
    }, token);
    console.log("API Response 1:", JSON.stringify(apiResponse1, null, 2));
    
    await delay(2000);
    await captureScreenshot(page, "01-api-polish");

    // Test 2: Send message preview
    console.log("📡 Test 2: Direct API - Send message preview...");
    const apiResponse2 = await page.evaluate(async (token) => {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: '帮我给张小明发条消息，说晚上一起吃饭',
          conversation_id: 5
        })
      });
      return res.json();
    }, token);
    console.log("API Response 2:", JSON.stringify(apiResponse2, null, 2));
    
    await delay(2000);
    await captureScreenshot(page, "02-api-send-message");

    // Refresh page to see new messages
    console.log("🔄 Refreshing page to see API responses...");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=/小.?Q.?管家/", { timeout: 10000 });
    await page.locator("text=/小.?Q.?管家/").first().click();
    await delay(3000);

    // Extract all messages
    console.log("\n📋 Extracting conversation text...");
    const allMessages = await page.locator("[class*='message']").allTextContents();
    console.log("\n=== Conversation Log ===");
    allMessages.forEach((msg, i) => {
      if (msg.trim()) {
        console.log(`[${i}] ${msg.trim().substring(0, 150)}${msg.length > 150 ? "..." : ""}`);
      }
    });
    console.log("========================\n");

    console.log("✅ Tool call test completed!");

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

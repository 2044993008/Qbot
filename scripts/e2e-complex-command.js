/**
 * E2E Test: Complex Multi-Step Bot Command
 * Command: "先把v我50吃疯狂星期四润色一下，再发给某个好友，顺便配张表情包，然后再发qq空间"
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
    `complex-command-${name}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

async function runTest() {
  console.log("🚀 Starting complex command E2E test...");
  console.log("⏳ This test may take 2-3 minutes due to LLM API calls...\n");

  const browser = await chromium.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    // Step 1: Login
    console.log("🔑 Step 1: Logging in...");
    await page.goto("http://localhost:5000/login");
    await page.waitForLoadState("networkidle");

    await page.fill('input[placeholder*="QQ"]', "10001");
    await page.fill('input[type="password"]', "123456");
    await page.click('button[type="submit"]');

    // Wait for navigation to app
    await page.waitForURL("**/app**", { timeout: 10000 });
    console.log("✅ Login successful\n");

    // Step 2: Find and open bot chat
    console.log("🤖 Step 2: Opening bot chat...");
    await page.waitForSelector("text=/小.?Q.?管家/", { timeout: 10000 });

    // Find bot chat (小 Q 管家) in chat list - note the spaces
    const botChatItem = page.locator("text=/小.?Q.?管家/").first();
    await botChatItem.click();
    console.log("✅ Opened bot chat\n");
    await delay(2000);
    await captureScreenshot(page, "01-bot-chat-open");

    // Step 3: Send complex command
    console.log("📨 Step 3: Sending complex command...");
    const complexCommand = "帮我写一条关于疯狂星期四的搞笑文案，润色后发给张小明，再配一张疯狂星期四的表情包，最后发到我的QQ空间";

    // Find message input
    const messageInput = page.locator('input[placeholder*="消息"], textarea[placeholder*="消息"], [data-testid="message-input"]').first();
    await messageInput.fill(complexCommand);
    await messageInput.press("Enter");

    console.log(`✅ Sent: "${complexCommand}"`);
    console.log("⏳ Waiting for bot response (this may take 30-60s)...\n");

    // Step 4: Wait for and observe bot response
    // Bot should start with a plan/acknowledgment
    await delay(5000);
    await captureScreenshot(page, "02-after-send");

    // Wait for streaming response to appear
    console.log("⏳ Waiting for streaming response...");
    let previousMessageCount = 0;
    let stableCount = 0;
    const maxWaitTime = 120000; // 2 minutes max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      await delay(3000);

      // Count bot messages
      const botMessages = await page.locator("[data-testid='bot-message'], .bot-message, [class*='bot']").all();
      const currentCount = botMessages.length;

      if (currentCount > previousMessageCount) {
        console.log(`📝 New bot message detected! Total: ${currentCount}`);
        previousMessageCount = currentCount;
        stableCount = 0;
        await captureScreenshot(page, `03-response-progress-${currentCount}`);
      } else {
        stableCount++;
        if (stableCount >= 5) {
          console.log("✅ Response seems complete (no new messages for 15s)\n");
          break;
        }
      }

      // Check for preview/confirmation UI
      const previewElements = await page.locator("text=/确认|preview|执行|润色|表情包|空间/i").all();
      if (previewElements.length > 0) {
        console.log(`🔍 Found ${previewElements.length} preview/confirmation elements`);
        await captureScreenshot(page, "04-preview-found");
      }
    }

    // Final screenshot
    await delay(2000);
    await captureScreenshot(page, "05-final-state");

    // Step 5: Extract conversation text for analysis
    console.log("\n📋 Extracting conversation text...");
    const allMessages = await page.locator("[data-testid='message-content'], .message-content, [class*='message']").allTextContents();

    console.log("\n=== Conversation Log ===");
    allMessages.forEach((msg, i) => {
      if (msg.trim()) {
        console.log(`[${i}] ${msg.trim().substring(0, 200)}${msg.length > 200 ? "..." : ""}`);
      }
    });
    console.log("========================\n");

    // Check for expected behaviors
    const fullText = allMessages.join(" ");
    const checks = [
      { name: "Plan/步骤", pattern: /步骤|计划|plan|第一步|第二步/i },
      { name: "润色文案", pattern: /疯狂星期四|50|文案|润色/i },
      { name: "表情包", pattern: /表情包|图片|image|生成/i },
      { name: "QQ空间", pattern: /空间|moment|动态/i },
      { name: "确认/预览", pattern: /确认|preview|请确认|是否执行/i },
    ];

    console.log("📊 Behavior Analysis:");
    checks.forEach((check) => {
      const found = check.pattern.test(fullText);
      console.log(`  ${found ? "✅" : "❌"} ${check.name}`);
    });

    console.log("\n✅ Complex command test completed!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    await captureScreenshot(page, "error-state");
    throw error;
  } finally {
    await browser.close();
  }
}

// Create test-results directory
const fs = require("fs");
const resultsDir = path.join(__dirname, "..", "test-results");
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});

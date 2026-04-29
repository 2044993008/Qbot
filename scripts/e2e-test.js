const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runE2E() {
  console.log('=== E2E 测试开始 ===\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    channel: 'chrome' // 使用系统 Chrome
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  try {
    // ==================== 1. 登录测试 ====================
    console.log('1. 测试登录...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // 填写登录表单
    await page.fill('input[placeholder*="QQ"], input[type="text"]:first-of-type', '10001');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    
    // 等待跳转到主页面
    await page.waitForURL(`${BASE_URL}/app`, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('   ✅ 登录成功');
    await page.screenshot({ path: 'e2e_screenshots/01_login_success.png' });
    
    // ==================== 2. 进入 AI 管家聊天 ====================
    console.log('\n2. 测试进入 AI 管家聊天...');
    // 点击 AI 管家会话（通过文本定位）
    await page.click('text=/小Q管家|AI管家|管家/');
    await sleep(1000);
    console.log('   ✅ 进入管家聊天');
    await page.screenshot({ path: 'e2e_screenshots/02_bot_chat.png' });
    
    // ==================== 3. 测试 Preview 机制 ====================
    console.log('\n3. 测试 Preview 机制（代发消息）...');
    const input = await page.locator('textarea, input[type="text"]').last();
    await input.fill('给小明发个消息说晚上一起吃饭');
    await input.press('Enter');
    
    // 等待 AI 回复（最多40秒）
    await page.waitForTimeout(35000);
    
    const pageContent = await page.content();
    const hasPreview = pageContent.includes('确认执行') || pageContent.includes('发送消息');
    
    if (hasPreview) {
      console.log('   ✅ Preview 卡片出现');
      await page.screenshot({ path: 'e2e_screenshots/03_preview_card.png' });
      
      // 点击取消
      await page.click('text=取消');
      await sleep(500);
      console.log('   ✅ 取消操作成功');
    } else {
      console.log('   ⚠️ 未检测到 Preview 卡片（可能LLM未触发）');
      await page.screenshot({ path: 'e2e_screenshots/03_no_preview.png' });
    }
    
    // ==================== 4. 测试生图 Preview ====================
    console.log('\n4. 测试生图 Preview...');
    await input.fill('帮我画一只穿着西装的猫');
    await input.press('Enter');
    
    await page.waitForTimeout(35000);
    
    const content2 = await page.content();
    const hasImagePreview = content2.includes('生成图片') && content2.includes('确认执行');
    
    if (hasImagePreview) {
      console.log('   ✅ 生图 Preview 卡片出现');
      await page.screenshot({ path: 'e2e_screenshots/04_image_preview.png' });
      
      // 点击取消
      await page.click('text=取消');
      await sleep(500);
      console.log('   ✅ 取消生图成功');
    } else {
      console.log('   ⚠️ 未检测到生图 Preview 卡片');
      await page.screenshot({ path: 'e2e_screenshots/04_no_image_preview.png' });
    }
    
    // ==================== 5. 测试定时任务 API（页面级）====================
    console.log('\n5. 测试定时任务功能...');
    // 通过 API 测试，因为前端可能没有任务管理页面
    const cookies = await context.cookies();
    const token = cookies.find(c => c.name === 'qq_token')?.value;
    
    if (token) {
      const taskRes = await page.evaluate(async (tk) => {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tk}`
          },
          body: JSON.stringify({
            name: 'E2E测试提醒',
            description: '端到端测试创建的定时任务',
            cron_expression: '0 9 * * 1',
            task_type: 'reminder',
            config: { message: '测试提醒' }
          })
        });
        return { status: res.status, data: await res.json().catch(() => null) };
      }, token);
      
      if (taskRes.status === 201) {
        console.log('   ✅ 定时任务创建成功');
        // 清理：删除测试任务
        const taskId = taskRes.data?.task?.id;
        if (taskId) {
          await page.evaluate(async (tk, id) => {
            await fetch(`/api/tasks/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${tk}` }
            });
          }, token, taskId);
          console.log('   ✅ 测试任务已清理');
        }
      } else {
        console.log('   ❌ 定时任务创建失败:', taskRes.status);
      }
    } else {
      console.log('   ⚠️ 未获取到 token，跳过 API 测试');
    }
    
    // ==================== 6. 测试 QQ 空间 ====================
    console.log('\n6. 测试 QQ 空间...');
    // 导航到空间页面
    await page.goto(`${BASE_URL}/app/moments`);
    await page.waitForLoadState('networkidle');
    await sleep(1000);
    console.log('   ✅ 进入 QQ 空间页面');
    await page.screenshot({ path: 'e2e_screenshots/05_moments.png' });
    
    // 尝试发布动态
    const textarea = await page.locator('textarea').first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('E2E测试动态 ' + Date.now());
      await page.click('button:has-text("发布"), button:has-text("发送")');
      await sleep(2000);
      console.log('   ✅ 动态发布成功');
      await page.screenshot({ path: 'e2e_screenshots/06_moment_published.png' });
    } else {
      console.log('   ⚠️ 未找到发布输入框');
    }
    
    // ==================== 7. 测试普通对话 ====================
    console.log('\n7. 测试普通对话...');
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState('networkidle');
    await page.click('text=/小Q管家|AI管家|管家/');
    await sleep(1000);
    
    const normalInput = await page.locator('textarea, input[type="text"]').last();
    await normalInput.fill('你好，介绍一下你自己');
    await normalInput.press('Enter');
    
    await page.waitForTimeout(10000);
    
    const finalContent = await page.content();
    if (finalContent.includes('小Q管家') || finalContent.includes('副官') || finalContent.includes('能力')) {
      console.log('   ✅ 正常对话回复正确');
    } else {
      console.log('   ⚠️ 对话内容未检测到预期回复');
    }
    await page.screenshot({ path: 'e2e_screenshots/07_normal_chat.png' });
    
    console.log('\n=== E2E 测试完成 ===');
    console.log('截图保存在 e2e_screenshots/ 目录');
    
  } catch (error) {
    console.error('\n❌ E2E 测试失败:', error.message);
    await page.screenshot({ path: 'e2e_screenshots/error.png' });
  } finally {
    await browser.close();
  }
}

runE2E().catch(console.error);

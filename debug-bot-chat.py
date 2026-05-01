from playwright.sync_api import sync_playwright
import json
import time

console_logs = []
console_errors = []
ws_events = []
network_requests = []

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_size={"width": 1280, "height": 720},
            record_video_dir="E:\\tmp\\videos" if False else None
        )
        page = context.new_page()

        # Listen to console messages
        page.on("console", lambda msg: console_logs.append({
            "type": msg.type,
            "text": msg.text,
            "location": msg.location
        }))
        
        page.on("pageerror", lambda err: console_errors.append({
            "message": str(err),
            "stack": getattr(err, 'stack', 'no stack')
        }))

        # Listen to WebSocket events
        page.on("websocket", lambda ws: handle_websocket(ws))

        # Listen to network requests
        page.on("request", lambda req: network_requests.append({
            "url": req.url,
            "method": req.method,
            "resource_type": req.resource_type,
            "headers": dict(req.headers)
        }))
        
        page.on("requestfailed", lambda req: network_requests.append({
            "url": req.url,
            "method": req.method,
            "resource_type": req.resource_type,
            "failed": True,
            "failure_error": req.failure.get("errorText") if req.failure else None
        }))
        
        page.on("response", lambda res: handle_response(res))

        print("=" * 60)
        print("STEP 1: Opening login page...")
        print("=" * 60)
        page.goto("http://localhost:5000/login")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="E:\\tmp\\bot-chat-debug-01-login.png")
        print("Login page loaded and screenshot saved")

        print("\n" + "=" * 60)
        print("STEP 2: Logging in with test account...")
        print("=" * 60)
        
        # Fill in credentials
        page.fill('input[name="qqNumber"], input[placeholder*="QQ"], input[type="text"]', "10001")
        page.fill('input[name="password"], input[placeholder*="密码"], input[type="password"]', "123456")
        
        page.screenshot(path="E:\\tmp\\bot-chat-debug-02-filled.png")
        
        # Click login button
        login_btn = page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login")').first
        login_btn.click()
        
        # Wait for navigation to /app
        print("Waiting for navigation to /app...")
        try:
            page.wait_for_url("**/app", timeout=15000)
        except Exception as e:
            print(f"Navigation wait error: {e}")
            page.screenshot(path="E:\\tmp\\bot-chat-debug-02b-post-click.png")
        
        page.wait_for_load_state("networkidle", timeout=15000)
        page.screenshot(path="E:\\tmp\\bot-chat-debug-03-app.png")
        print("App page loaded and screenshot saved")

        print("\n" + "=" * 60)
        print("STEP 3: Looking for '小 Q 管家' conversation...")
        print("=" * 60)
        
        # Try to find "小 Q 管家" by text
        bot_selector = 'text=小 Q 管家'
        bot_locator = page.locator(bot_selector).first
        
        # Also try alternative selectors
        if bot_locator.count() == 0:
            bot_locator = page.locator('text=管家').first
        if bot_locator.count() == 0:
            bot_locator = page.locator('[data-testid*="bot"]').first
        
        print(f"Bot element count: {bot_locator.count()}")
        
        if bot_locator.count() > 0:
            bot_locator.click()
            print("Clicked on 小 Q 管家")
            page.wait_for_timeout(2000)
            page.screenshot(path="E:\\tmp\\bot-chat-debug-04-bot-opened.png")
        else:
            print("Could not find 小 Q 管家 element")
            page.screenshot(path="E:\\tmp\\bot-chat-debug-04-bot-not-found.png")
            # Print all text on page to debug
            texts = page.locator('text=/./').all_text_contents()
            print("Available text elements:", [t.strip() for t in texts if t.strip()][:30])

        print("\n" + "=" * 60)
        print("STEP 4: Sending test message...")
        print("=" * 60)
        
        # Find message input
        input_selectors = [
            'input[placeholder*="消息"]',
            'input[placeholder*="发送"]',
            'textarea[placeholder*="消息"]',
            'textarea[placeholder*="发送"]',
            'div[contenteditable="true"]',
            '[data-testid="message-input"]',
            'input[type="text"]'
        ]
        
        msg_input = None
        for sel in input_selectors:
            loc = page.locator(sel).first
            if loc.count() > 0 and loc.is_visible():
                msg_input = loc
                print(f"Found input with selector: {sel}")
                break
        
        if msg_input:
            msg_input.fill("测试消息")
            page.wait_for_timeout(500)
            
            # Find send button or press Enter
            send_btn = page.locator('button:has-text("发送"), button[type="submit"], [data-testid="send-button"]').first
            if send_btn.count() > 0 and send_btn.is_visible():
                send_btn.click()
                print("Clicked send button")
            else:
                msg_input.press("Enter")
                print("Pressed Enter to send")
            
            page.wait_for_timeout(3000)
            page.screenshot(path="E:\\tmp\\bot-chat-debug-05-message-sent.png")
        else:
            print("Could not find message input")
            page.screenshot(path="E:\\tmp\\bot-chat-debug-05-no-input.png")

        print("\n" + "=" * 60)
        print("STEP 5: Final screenshot and data collection...")
        print("=" * 60)
        
        # Final screenshot
        page.screenshot(path="E:\\tmp\\bot-chat-debug.png", full_page=True)
        print("Final screenshot saved to E:\\tmp\\bot-chat-debug.png")
        
        # Print collected data
        print("\n--- CONSOLE LOGS ---")
        for log in console_logs[-20:]:
            print(f"[{log['type']}] {log['text']}")
        
        print("\n--- CONSOLE ERRORS ---")
        for err in console_errors:
            print(f"ERROR: {err['message']}")
        
        print("\n--- WEBSOCKET EVENTS ---")
        for ws in ws_events:
            print(json.dumps(ws, ensure_ascii=False))
        
        print("\n--- FAILED NETWORK REQUESTS ---")
        failed = [r for r in network_requests if r.get("failed")]
        for req in failed[-20:]:
            print(f"FAILED: {req['method']} {req['url']} - {req.get('failure_error')}")
        
        print("\n--- API REQUESTS (status >= 400) ---")
        api_errors = [r for r in network_requests if r.get("status") and r.get("status") >= 400]
        for req in api_errors[-20:]:
            print(f"API ERROR: {req['method']} {req['url']} -> {req['status']}")

        # Wait a bit before closing
        print("\nWaiting 5 seconds before closing...")
        page.wait_for_timeout(5000)
        
        # Don't close browser per instructions
        print("\nBrowser left open. Press Enter in this terminal to close...")
        input()
        
        browser.close()

def handle_websocket(ws):
    ws_events.append({
        "event": "created",
        "url": ws.url
    })
    
    def on_open():
        ws_events.append({"event": "open", "url": ws.url})
        print(f"WebSocket OPENED: {ws.url}")
    
    def on_close():
        ws_events.append({"event": "close", "url": ws.url})
        print(f"WebSocket CLOSED: {ws.url}")
    
    def on_error(err):
        ws_events.append({"event": "error", "url": ws.url, "error": str(err)})
        print(f"WebSocket ERROR: {ws.url} - {err}")
    
    def on_message(msg):
        ws_events.append({"event": "message", "url": ws.url, "data": msg[:200] if len(msg) > 200 else msg})
    
    ws.on("open", on_open)
    ws.on("close", on_close)
    ws.on("error", on_error)
    ws.on("framereceived", on_message)
    ws.on("framesent", lambda msg: ws_events.append({"event": "sent", "url": ws.url, "data": msg[:200] if len(msg) > 200 else msg}))

def handle_response(res):
    req_info = {
        "url": res.url,
        "method": res.request.method,
        "status": res.status,
        "status_text": res.status_text,
        "resource_type": res.request.resource_type
    }
    network_requests.append(req_info)
    
    if res.status >= 400 or "api" in res.url:
        print(f"API Response: {res.request.method} {res.url} -> {res.status} {res.status_text}")

if __name__ == "__main__":
    main()

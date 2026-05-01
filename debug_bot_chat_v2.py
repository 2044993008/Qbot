from playwright.sync_api import sync_playwright
import json
import sys

console_logs = []
console_errors = []
ws_events = []
network_requests = []

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        page.on("console", lambda msg: console_logs.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: console_errors.append({"message": str(err)}))
        page.on("websocket", lambda ws: handle_websocket(ws))
        page.on("request", lambda req: network_requests.append({"url": req.url, "method": req.method, "resource_type": req.resource_type}))
        page.on("requestfailed", lambda req: network_requests.append({"url": req.url, "method": req.method, "resource_type": req.resource_type, "failed": True, "failure_error": req.failure.get("errorText") if req.failure else None}))
        page.on("response", lambda res: handle_response(res))

        print("=" * 60)
        print("STEP 1: Opening login page...")
        print("=" * 60)
        page.goto("http://localhost:5000/login")
        page.wait_for_load_state("networkidle")
        page.screenshot(path="E:/tmp/bot-chat-debug-01-login.png")
        print("Login page loaded")

        print("\n" + "=" * 60)
        print("STEP 2: Logging in with test account...")
        print("=" * 60)
        
        page.fill("#login-qq", "10001")
        page.fill("#login-password", "123456")
        page.screenshot(path="E:/tmp/bot-chat-debug-02-filled.png")
        print("Filled in credentials")
        
        page.click("button[type='submit']")
        print("Clicked login button")
        
        try:
            page.wait_for_url("**/app", timeout=15000)
            print("Navigated to /app")
        except Exception as e:
            print(f"Navigation wait error: {e}")
        
        page.wait_for_load_state("networkidle", timeout=15000)
        page.screenshot(path="E:/tmp/bot-chat-debug-03-app.png")
        print("App page loaded")

        print("\n" + "=" * 60)
        print("STEP 3: Looking for bot conversation...")
        print("=" * 60)
        
        page.wait_for_timeout(2000)
        
        bot_locator = None
        selectors = ["text=小 Q 管家", "text=管家", "[data-testid*='bot']"]
        
        for sel in selectors:
            loc = page.locator(sel).first
            count = loc.count()
            print(f"Selector '{sel}' count: {count}")
            if count > 0:
                bot_locator = loc
                break
        
        if bot_locator:
            bot_locator.click()
            print("Clicked on bot")
            page.wait_for_timeout(2000)
            page.screenshot(path="E:/tmp/bot-chat-debug-04-bot-opened.png")
        else:
            print("Could not find bot element")
            page.screenshot(path="E:/tmp/bot-chat-debug-04-bot-not-found.png")
            texts = page.locator("text=/./").all_text_contents()
            print("Available text elements:", [t.strip() for t in texts if t.strip()][:30])

        print("\n" + "=" * 60)
        print("STEP 4: Sending test message...")
        print("=" * 60)
        
        input_selectors = [
            "input[placeholder*='消息']",
            "input[placeholder*='发送']",
            "textarea[placeholder*='消息']",
            "div[contenteditable='true']",
            "[data-testid='message-input']",
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
            
            send_btn = page.locator("button:has-text('发送'), [data-testid='send-button']").first
            if send_btn.count() > 0 and send_btn.is_visible():
                send_btn.click()
                print("Clicked send button")
            else:
                msg_input.press("Enter")
                print("Pressed Enter to send")
            
            page.wait_for_timeout(3000)
            page.screenshot(path="E:/tmp/bot-chat-debug-05-message-sent.png")
        else:
            print("Could not find message input")
            page.screenshot(path="E:/tmp/bot-chat-debug-05-no-input.png")

        print("\n" + "=" * 60)
        print("STEP 5: Final data collection...")
        print("=" * 60)
        
        page.screenshot(path="E:/tmp/bot-chat-debug.png", full_page=True)
        print("Final screenshot saved")
        
        print("\n--- CONSOLE LOGS (last 30) ---")
        for log in console_logs[-30:]:
            print(f"[{log['type']}] {log['text'][:200]}")
        
        print("\n--- CONSOLE ERRORS ---")
        for err in console_errors:
            print(f"ERROR: {err['message'][:200]}")
        
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

        page.wait_for_timeout(5000)
        
        print("Browser left open. Press Enter to close...")
        input()
        browser.close()

def handle_websocket(ws):
    ws_events.append({"event": "created", "url": ws.url})
    
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
    req_info = {"url": res.url, "method": res.request.method, "status": res.status, "status_text": res.status_text}
    network_requests.append(req_info)
    
    if res.status >= 400 or "api" in res.url:
        print(f"API Response: {res.request.method} {res.url} -> {res.status} {res.status_text}")

if __name__ == "__main__":
    main()

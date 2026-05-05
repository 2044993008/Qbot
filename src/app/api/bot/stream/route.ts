import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';
import { validateBody, botMessageSchema } from '@/lib/validation';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { POST as botPost } from '../route';

// SSE 编码辅助函数
function encodeSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// 模拟流式输出（将完整文本转为逐字 SSE）
function simulateTextStream(content: string) {
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'start' })));

        // 逐字符发送模拟打字机效果
        if (content && content.length > 0) {
          const chars = content.split('');
          const delayMs = chars.length > 500 ? 5 : 15; // 长文本加速
          for (const char of chars) {
            controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'delta', content: char })));
            if (delayMs > 0) {
              await new Promise(r => setTimeout(r, delayMs));
            }
          }
        } else {
          // 空内容发送一个提示
          controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'delta', content: '（暂无回复内容）' })));
        }

        controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'done', fullContent: content || '' })));
        controller.close();
      } catch {
        controller.enqueue(new TextEncoder().encode(encodeSSE({ error: '流式处理错误', done: true })));
        controller.close();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return new Response(encodeSSE({ error: '未登录', done: true }), {
        status: 401,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // Bot 流式请求限流：20次/分钟/用户
    const limit = await checkUserRateLimit(payload.userId, { maxRequests: 20, windowMs: 60 * 1000, keyPrefix: 'bot_stream' });
    if (!limit.allowed) {
      return new Response(encodeSSE({ error: '请求过于频繁，请稍后再试', done: true }), {
        status: 429,
        headers: { 'Content-Type': 'text/event-stream', 'Retry-After': String(limit.retryAfter) },
      });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return new Response(encodeSSE({ error: 'CSRF验证失败', done: true }), {
        status: 403,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const validated = await validateBody(request, botMessageSchema);
    if (!validated.success) {
      return new Response(encodeSSE({ error: validated.error, done: true }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    const { message, conversation_id } = validated.data;
    const userMessage = message.trim();

    if (!userMessage) {
      return new Response(encodeSSE({ error: '消息不能为空', done: true }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // 所有请求统一走 Agent（支持工具调用、消息持久化）
    // 标记 skip_websocket=true，避免流式模式下 WebSocket 和 SSE 双重推送导致前端重复显示
    const botRequest = new NextRequest(new URL('/api/bot', request.url), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ message: userMessage, conversation_id, skip_websocket: true }),
    });

    const botResponse = await botPost(botRequest);
    const result = await botResponse.json();

    // 检查 Agent 是否返回错误
    if (result.error) {
      console.error('[Bot Stream] Agent error:', result.error);
      const stream = simulateTextStream('抱歉，我这边出了点小问题，能再说一遍吗？');
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 将 Agent 结果转为 SSE 流（模拟打字机效果）
    // Agent 已经在 POST handler 中持久化了消息，这里只负责前端展示
    const stream = simulateTextStream(result.response || '');

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('SSE 端点错误:', error);
    return new Response(encodeSSE({ error: '服务器错误', done: true }), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}

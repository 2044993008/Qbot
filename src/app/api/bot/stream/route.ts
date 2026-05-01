import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';
import { validateBody, botMessageSchema } from '@/lib/validation';
import { POST as botPost } from '../route';

function getOpenAIConfig() {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model };
}

// SSE 编码辅助函数
function encodeSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// 检测是否为复杂请求（需要多步执行 / Agent 编排）
function detectComplexRequest(message: string): boolean {
  const complexPatterns = [
    /然后|接着|之后|再|随后|最后/, // 多步骤连接词
    /先.*再|先.*然后/, // 先后顺序
    /搜索.*发|查.*发|找.*发/, // 搜索后发消息
    /润色.*发|改.*发/, // 润色后发送
    /(?:帮|代|替).{0,5}(?:我|忙)?.{0,10}(?:然后|接着|再)/, // 复杂代办
  ];
  return complexPatterns.some(p => p.test(message)) || message.length > 50;
}

// 模拟流式输出（将完整文本转为逐字 SSE）
function simulateTextStream(content: string, preview?: Record<string, unknown>) {
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'start' })));

          // 如果有 preview，先发送 preview 事件
          if (preview) {
            controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'preview', preview })));
          }

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
        } else if (!preview) {
          // 空内容且无预览，发送一个提示
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

// 直接 LLM 流式输出（简单请求）
function directLLMStream(
  userMessage: string,
  conversationId: number | undefined,
  systemPrompt: string | undefined
) {
  const { baseUrl, apiKey, model } = getOpenAIConfig();

  const messages = [
    { role: 'system' as const, content: systemPrompt || '你是小Q管家，一个有帮助的AI助手。' },
    { role: 'user' as const, content: userMessage },
  ];

  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'start' })));

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.8,
            max_tokens: 2048,
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          controller.enqueue(new TextEncoder().encode(encodeSSE({ error: 'LLM API 连接失败', done: true })));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // 保留最后一个可能不完整的行到缓冲区
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'delta', content: delta })));
                }
              } catch {
                // 忽略解析错误的行
              }
            }
          }
        }

        // 持久化到数据库
        if (conversationId && fullContent) {
          try {
            const client = getSupabaseClient();
            const { data: botUser } = await client
              .from('users')
              .select('id')
              .eq('nickname', '小 Q 管家')
              .maybeSingle();

            if (botUser) {
              await client.from('messages').insert({
                conversation_id: conversationId,
                sender_id: botUser.id,
                content: fullContent,
                type: 'text',
              });
              await client
                .from('conversations')
                .update({ last_message_time: new Date().toISOString() })
                .eq('id', conversationId);
            }
          } catch (persistError) {
            console.error('Bot 流式回复持久化失败:', persistError);
          }
        }

        controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'done', fullContent })));
        controller.close();
      } catch (error) {
        console.error('SSE 流错误:', error);
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
    const { message, conversation_id, system_prompt } = validated.data;
    const userMessage = message.trim();

    if (!userMessage) {
      return new Response(encodeSSE({ error: '消息不能为空', done: true }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // 检测是否为复杂请求，需要走 Agent 编排器
    if (detectComplexRequest(userMessage)) {
      // 复用非流式 /api/bot 的 Agent 编排器
      const botRequest = new NextRequest(new URL('/api/bot', request.url), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ message: userMessage, conversation_id }),
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

      // 将 Agent 结果转为 SSE 流
      const stream = simulateTextStream(result.response || result.content || '', result.preview);

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 简单请求：直接走 LLM 流式输出
    const stream = directLLMStream(userMessage, conversation_id, system_prompt);

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

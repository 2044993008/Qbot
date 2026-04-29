import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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

export async function POST(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return new Response(encodeSSE({ error: '未登录', done: true }), {
        status: 401,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const { message, conversation_id, system_prompt } = await request.json();
    const userMessage = message?.trim();

    if (!userMessage) {
      return new Response(encodeSSE({ error: '消息不能为空', done: true }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const { baseUrl, apiKey, model } = getOpenAIConfig();

    // 构建消息
    const messages: OpenAIMessage[] = [
      { role: 'system', content: system_prompt || '你是小Q管家，一个有帮助的AI助手。' },
      { role: 'user', content: userMessage },
    ];

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始事件
          controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'start' })));

          // 调用 LLM 流式 API
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

          if (!response.ok) {
            const errorText = await response.text();
            controller.enqueue(new TextEncoder().encode(encodeSSE({ error: `LLM API error: ${response.status}`, done: true })));
            controller.close();
            return;
          }

          if (!response.body) {
            controller.enqueue(new TextEncoder().encode(encodeSSE({ error: 'Empty response body', done: true })));
            controller.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          // 读取流
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

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
          if (conversation_id && fullContent) {
            try {
              const client = getSupabaseClient();
              const { data: botUser } = await client
                .from('users')
                .select('id')
                .eq('nickname', '小 Q 管家')
                .maybeSingle();

              if (botUser) {
                await client.from('messages').insert({
                  conversation_id,
                  sender_id: botUser.id,
                  content: fullContent,
                  type: 'text',
                });

                await client
                  .from('conversations')
                  .update({ last_message_time: new Date().toISOString() })
                  .eq('id', conversation_id);
              }
            } catch (persistError) {
              console.error('Bot 流式回复持久化失败:', persistError);
            }
          }

          // 发送完成事件
          controller.enqueue(new TextEncoder().encode(encodeSSE({ type: 'done', fullContent })));
          controller.close();
        } catch (error) {
          console.error('SSE 流错误:', error);
          controller.enqueue(new TextEncoder().encode(encodeSSE({ error: '流式处理错误', done: true })));
          controller.close();
        }
      },
    });

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

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';

interface OpenAIMessage {
  role: 'system' | 'user';
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

async function callLLM(messages: OpenAIMessage[]): Promise<string> {
  const { baseUrl, apiKey, model } = getOpenAIConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 256,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`LLM API error: ${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || '';
}

// 解析自然语言时间为 cron 表达式
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { text } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: '缺少 text 参数' }, { status: 400 });
    }

    const systemPrompt = `你是一个定时任务时间解析助手。将用户的自然语言描述转换为标准的 cron 表达式。

只输出 JSON 格式，不要有任何其他文字：
{
  "cron": "cron表达式",
  "description": "人类可读的描述",
  "confidence": 0-1
}

Cron 格式：分 时 日 月 周
- 分: 0-59
- 时: 0-23
- 日: 1-31
- 月: 1-12
- 周: 0-7 (0和7都是周日)

常用示例：
- 每天上午9点 → 0 9 * * *
- 每周一上午9点 → 0 9 * * 1
- 每分钟 → * * * * *
- 每5分钟 → */5 * * * *
- 每月1号凌晨0点 → 0 0 1 * *
- 工作日每天下午6点 → 0 18 * * 1-5`;

    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text.trim() },
    ]);

    // 尝试解析 JSON
    let result: { cron?: string; description?: string; confidence?: number } = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // 解析失败，返回原始内容作为描述
      result = { description: content, confidence: 0.3 };
    }

    if (!result.cron) {
      return NextResponse.json({
        error: '无法解析时间描述',
        raw: content,
      }, { status: 422 });
    }

    return NextResponse.json({
      cron: result.cron,
      description: result.description || text.trim(),
      confidence: result.confidence || 0.8,
    });
  } catch (error) {
    console.error('解析自然语言时间失败:', error);
    return NextResponse.json({ error: '解析失败' }, { status: 500 });
  }
}

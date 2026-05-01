import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseToolCalls, cleanContent } from './route';

// ============================================
// Copied function definitions for non-exported helpers
// ============================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  error?: { message: string };
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

async function callOpenAICompatible(
  messages: OpenAIMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
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
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OpenAICompletionResponse;

  if (data.error) {
    throw new Error(`LLM API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[Bot] LLM returned empty content, choices:', JSON.stringify(data.choices));
  }
  return content?.trim() || '';
}

function encodeSSE(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function detectComplexRequest(message: string): boolean {
  const complexPatterns = [
    /然后|接着|之后|再|随后|最后/,
    /先.*再|先.*然后/,
    /搜索.*发|查.*发|找.*发/,
    /润色.*发|改.*发/,
    /(?:帮|代|替).{0,5}(?:我|忙)?.{0,10}(?:然后|接着|再)/,
  ];
  return complexPatterns.some(p => p.test(message)) || message.length > 50;
}

function detectHighRiskIntent(message: string): { isRisky: boolean; isExplicit: boolean } {
  const lower = message.toLowerCase();

  const explicitPatterns = [
    /(?:给|向|对).{0,5}(?:小明|张三|李四|王五|小红|小花|[\u4e00-\u9fa5]{2,4}).{0,5}(?:发|送)/,
    /(?:发|发布|写).{0,3}(?:空间|朋友圈|说说|动态)/,
    /(?:画|生成|做|出).{0,3}(?:图|图片|画)/,
    /(?:生成|做|出).{0,3}(?:视频|短片|动图)/,
  ];

  const vagueRiskPatterns = [
    /^\s*(?:帮|代|替).{0,2}(?:我|忙)?\s*(?:发|送)/,
    /^\s*发(?:给|到|往|出去)?\s*$/,
    /^\s*(?:publish|send)\s*$/i,
  ];

  const isExplicit = explicitPatterns.some(p => p.test(lower));
  const isVagueRisk = vagueRiskPatterns.some(p => p.test(lower));

  return {
    isRisky: isExplicit || isVagueRisk,
    isExplicit,
  };
}

// ============================================
// Tests
// ============================================

describe('callOpenAICompatible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_BASE_URL = 'https://test.openai.com/v1';
    process.env.OPENAI_MODEL = 'gpt-test';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch with correct URL, method, and Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Hello world' } }],
      }),
    });
    global.fetch = fetchMock;

    const result = await callOpenAICompatible([
      { role: 'user', content: 'test' },
    ]);

    expect(result).toBe('Hello world');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://test.openai.com/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-api-key');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('gpt-test');
    expect(body.messages).toEqual([{ role: 'user', content: 'test' }]);
    expect(body.temperature).toBe(0.8);
    expect(body.max_tokens).toBe(2048);
  });

  it('throws error when fetch returns non-2xx status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    global.fetch = fetchMock;

    await expect(
      callOpenAICompatible([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('LLM API error: 500 Internal Server Error');
  });

  it('returns empty string when choices array is empty', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    global.fetch = fetchMock;

    const result = await callOpenAICompatible([{ role: 'user', content: 'test' }]);

    expect(result).toBe('');
    warnSpy.mockRestore();
  });

  it('uses custom temperature and maxTokens when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'OK' } }],
      }),
    });
    global.fetch = fetchMock;

    await callOpenAICompatible([{ role: 'user', content: 'test' }], {
      temperature: 0.2,
      maxTokens: 512,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(512);
  });

  it('throws error when API returns error field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [],
        error: { message: 'Rate limit exceeded' },
      }),
    });
    global.fetch = fetchMock;

    await expect(
      callOpenAICompatible([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('LLM API error: Rate limit exceeded');
  });
});

describe('parseToolCalls', () => {
  it('parses tool call with nested JSON arguments', () => {
    const content = `[TOOL_CALL:{"name":"send_message","arguments":{"content":"hello","target":{"name":"小明","id":123},"metadata":{"priority":"high"}}}][TOOL_CALL_END]`;
    const calls = parseToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('send_message');
    expect(calls[0].arguments).toEqual({
      content: 'hello',
      target: { name: '小明', id: 123 },
      metadata: { priority: 'high' },
    });
  });

  it('parses tool call with special characters in arguments', () => {
    const content = `[TOOL_CALL:{"name":"polish_text","arguments":{"text":"你好~\\n换行\\t制表","style":"casual"}}][TOOL_CALL_END]`;
    const calls = parseToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].arguments.text).toBe('你好~\n换行\t制表');
  });

  it('returns empty array when no markers present', () => {
    const calls = parseToolCalls('今天天气不错，出去走走吧');
    expect(calls).toHaveLength(0);
  });

  it('handles multiple TOOL_CALL blocks in one response', () => {
    const content = `
      我帮你处理一下~
      [TOOL_CALL:{"name":"read_identity","arguments":{}}]
      [TOOL_CALL_END]
      然后再发消息
      [TOOL_CALL:{"name":"send_message","arguments":{"content":"hi","preview":true}}]
      [TOOL_CALL_END]
    `;
    const calls = parseToolCalls(content);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('read_identity');
    expect(calls[1].name).toBe('send_message');
  });

  it('ignores malformed JSON inside markers', () => {
    const content = `
      [TOOL_CALL:{"name":"bad","arguments":{broken]]
      [TOOL_CALL_END]
      [TOOL_CALL:{"name":"good","arguments":{"ok":true}}]
      [TOOL_CALL_END]
    `;
    const calls = parseToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('good');
  });

  it('ignores markers without name field', () => {
    const content = `[TOOL_CALL:{"arguments":{"foo":"bar"}}][TOOL_CALL_END]`;
    const calls = parseToolCalls(content);
    expect(calls).toHaveLength(0);
  });
});

describe('cleanContent', () => {
  it('strips multiple TOOL_CALL blocks', () => {
    const content = `你好~
[TOOL_CALL:{"name":"read_identity","arguments":{}}]
[TOOL_CALL_END]
然后
[TOOL_CALL:{"name":"send_message","arguments":{"content":"hi"}}]
[TOOL_CALL_END]
再见`;
    const cleaned = cleanContent(content);
    expect(cleaned).not.toContain('[TOOL_CALL');
    expect(cleaned).not.toContain('[TOOL_CALL_END]');
    expect(cleaned).toContain('你好~');
    expect(cleaned).toContain('然后');
    expect(cleaned).toContain('再见');
  });

  it('returns empty string for empty content', () => {
    expect(cleanContent('')).toBe('');
  });

  it('returns unchanged content when no markers', () => {
    const content = '纯文本内容，没有任何工具调用';
    expect(cleanContent(content)).toBe(content);
  });

  it('trims whitespace after removing markers', () => {
    const content = `  [TOOL_CALL:{"name":"test","arguments":{}}]  [TOOL_CALL_END]  `;
    expect(cleanContent(content)).toBe('');
  });
});

describe('detectComplexRequest', () => {
  it('returns true for messages containing 然后', () => {
    expect(detectComplexRequest('先搜索聊天记录然后发给小明')).toBe(true);
  });

  it('returns true for messages containing 接着', () => {
    expect(detectComplexRequest('查一下资料接着发给群里')).toBe(true);
  });

  it('returns true for messages with 先...再 pattern', () => {
    expect(detectComplexRequest('先润色一下再发出去')).toBe(true);
  });

  it('returns true for messages with 先...然后 pattern', () => {
    expect(detectComplexRequest('先搜索关键词然后发给班长')).toBe(true);
  });

  it('returns true for messages with 搜索...发 pattern', () => {
    expect(detectComplexRequest('搜索昨天的消息发给李华')).toBe(true);
  });

  it('returns true for messages with 润色...发 pattern', () => {
    expect(detectComplexRequest('帮我把这段话润色一下发给老师')).toBe(true);
  });

  it('returns true for messages with 改...发 pattern', () => {
    expect(detectComplexRequest('改一下文案发给客户')).toBe(true);
  });

  it('returns true for messages with complex代办 pattern', () => {
    expect(detectComplexRequest('帮我查一下然后发给小明')).toBe(true);
  });

  it('returns false for simple short messages', () => {
    expect(detectComplexRequest('你好')).toBe(false);
    expect(detectComplexRequest('在吗')).toBe(false);
    expect(detectComplexRequest('谢谢')).toBe(false);
  });

  it('returns true for messages longer than 50 characters', () => {
    expect(detectComplexRequest('a'.repeat(51))).toBe(true);
  });

  it('returns false for empty message', () => {
    expect(detectComplexRequest('')).toBe(false);
  });

  it('returns false for messages with exactly 50 characters', () => {
    expect(detectComplexRequest('a'.repeat(50))).toBe(false);
  });
});

describe('detectHighRiskIntent', () => {
  it('detects vague risky intent like 帮我发', () => {
    const result = detectHighRiskIntent('帮我发');
    expect(result.isRisky).toBe(true);
    expect(result.isExplicit).toBe(false);
  });

  it('detects vague risky intent like 代发', () => {
    const result = detectHighRiskIntent('代发');
    expect(result.isRisky).toBe(true);
    expect(result.isExplicit).toBe(false);
  });

  it('detects explicit intent for sending to specific person', () => {
    const result = detectHighRiskIntent('给小明发消息');
    expect(result.isRisky).toBe(true);
    expect(result.isExplicit).toBe(true);
  });

  it('detects explicit intent for posting moment', () => {
    const result = detectHighRiskIntent('发空间动态');
    expect(result.isRisky).toBe(true);
    expect(result.isExplicit).toBe(true);
  });

  it('does not flag normal greeting', () => {
    const result = detectHighRiskIntent('你好呀');
    expect(result.isRisky).toBe(false);
    expect(result.isExplicit).toBe(false);
  });

  it('does not flag informational query', () => {
    const result = detectHighRiskIntent('今天天气怎么样');
    expect(result.isRisky).toBe(false);
    expect(result.isExplicit).toBe(false);
  });

  it('detects explicit intent for generating image', () => {
    const result = detectHighRiskIntent('帮我画一张图');
    expect(result.isRisky).toBe(true);
    expect(result.isExplicit).toBe(true);
  });
});

describe('encodeSSE', () => {
  it('formats data as SSE with data: prefix and double newline', () => {
    const result = encodeSSE({ type: 'delta' });
    expect(result).toBe('data: {"type":"delta"}\n\n');
  });

  it('encodes nested objects correctly', () => {
    const result = encodeSSE({ type: 'preview', preview: { action: 'send' } });
    expect(result).toBe('data: {"type":"preview","preview":{"action":"send"}}\n\n');
  });

  it('encodes arrays correctly', () => {
    const result = encodeSSE({ items: [1, 2, 3] });
    expect(result).toBe('data: {"items":[1,2,3]}\n\n');
  });
});

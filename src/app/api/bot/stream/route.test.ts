import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@/lib/auth-utils';

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

function createRequest(method: string, url: string, body?: Record<string, unknown>, headers?: Record<string, string>) {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Bot Stream API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_BASE_URL = 'https://test.openai.com/v1';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: 'hello' });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when message is empty', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns SSE stream for simple request', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }),
    });
    global.fetch = fetchMock;

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
      })),
      _chainable: {},
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '你好' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns SSE stream for complex request via agent', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这是复杂请求的回复' } }],
      }),
    });
    global.fetch = fetchMock;

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })),
      _chainable: {},
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '先搜索然后发消息给小明' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns SSE stream with error event on fetch failure', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '你好' });
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // Read all chunks from the stream
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    let fullText = '';
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
    }
    // Should contain an error event somewhere in the stream
    expect(fullText).toContain('error');
  });
});

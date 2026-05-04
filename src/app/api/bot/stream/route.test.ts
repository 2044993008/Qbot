import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateCsrfToken } from '@/lib/csrf';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn(),
}));

import { getAuthUser } from '@/lib/auth-utils';
import { checkUserRateLimit } from '@/lib/rate-limit';

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);
const mockedCheckUserRateLimit = vi.mocked(checkUserRateLimit);

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
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetIn: 60, retryAfter: 0 });
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_BASE_URL = 'https://test.openai.com/v1';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetAuthUser.mockReturnValue(null);
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: 'hello' });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 30, retryAfter: 30 });
    const csrfToken = generateCsrfToken('1');
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: 'hello' }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns 403 without valid CSRF token', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: 'hello' }, { 'X-CSRF-Token': 'invalid' });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns 400 when message is empty', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '' }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns SSE stream for simple request', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
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

    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '你好' }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns SSE stream for complex request via agent', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
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

    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '先搜索然后发消息给小明' }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns SSE stream with error event on fetch failure', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const request = createRequest('POST', 'http://localhost/api/bot/stream', { message: '你好' }, { 'X-CSRF-Token': csrfToken });
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
    // Agent catches the error and returns a fallback message
    expect(fullText).toContain('走神');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateCsrfToken } from '@/lib/csrf';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from '@/lib/auth-utils';

const mockedGetAuthUser = vi.mocked(getAuthUser);
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

function createMockSupabase(dataMap: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    count: vi.fn().mockReturnThis(),
    head: vi.fn().mockReturnThis(),
  };

  const fromFn = vi.fn(() => chainable);

  return {
    ...chainable,
    from: fromFn,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/image.png' } }),
      })),
    },
    _chainable: chainable,
    _setData: (key: string, value: unknown) => {
      dataMap[key] = value;
    },
    _getData: (key: string) => dataMap[key],
  };
}

describe('Bot API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAYWRIGHT_SKIP_RATE_LIMIT = 'true';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_BASE_URL = 'https://test.openai.com/v1';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/bot', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('GET', 'http://localhost/api/bot');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns bot config successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockBotUser = { id: 99, qq_number: '99999', nickname: '小 Q 管家', avatar_color: '#ff0000', status: 'online', signature: '' };
      const mockSupabase = createMockSupabase();
      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // bot_identity
        .mockResolvedValueOnce({ data: null, error: null }) // bot_user
        .mockResolvedValueOnce({ data: mockBotUser, error: null }); // users query
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/bot');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.bot).toBeDefined();
      expect(json.name).toBe('小Q管家');
    });

    it('returns 500 when database errors', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = createMockSupabase();
      mockSupabase.from = vi.fn(() => {
        throw new Error('DB connection failed');
      });
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/bot');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/bot', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('POST', 'http://localhost/api/bot', { message: 'hello' });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid body', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const request = createRequest('POST', 'http://localhost/api/bot', { message: '' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('POST', 'http://localhost/api/bot', { message: 'hello' }, { 'X-CSRF-Token': 'invalid' });
      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('processes bot message successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = createMockSupabase();

      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // bot_identity
        .mockResolvedValueOnce({ data: null, error: null }) // bot_user
        .mockResolvedValueOnce({ data: { id: 99, nickname: '小 Q 管家', avatar_color: '#ff0000' }, error: null }); // botUser for persist

      mockSupabase._chainable.select = vi.fn().mockReturnThis();
      mockSupabase._chainable.eq = vi.fn().mockReturnThis();
      mockSupabase._chainable.order = vi.fn().mockReturnThis();
      mockSupabase._chainable.limit = vi.fn().mockReturnThis();

      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '你好！有什么可以帮你的吗？' } }],
          }),
        });
      global.fetch = fetchMock;

      const request = createRequest('POST', 'http://localhost/api/bot', { message: '你好' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.response).toBeDefined();
    });

    it('returns friendly response on LLM error', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = createMockSupabase();

      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const fetchMock = vi.fn().mockRejectedValueOnce(new Error('LLM API error'));
      global.fetch = fetchMock;

      const request = createRequest('POST', 'http://localhost/api/bot', { message: '你好' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.response).toBeDefined();
    });

    it('executes tool directly when execute_tool is true', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = createMockSupabase();
      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: { friend_id: 2 }, error: null })
        .mockResolvedValueOnce({ data: { nickname: '小明' }, error: null });

      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/bot', {
        execute_tool: true,
        tool: 'delete_friend',
        params: { friend_id: 2 },
        confirmation_id: 'confirm-123',
      }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('returns 403 for execute_tool without CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('POST', 'http://localhost/api/bot', {
        execute_tool: true,
        tool: 'delete_friend',
        params: { friend_id: 2 },
      });
      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('returns 400 for execute_tool with high-risk tool without confirmation_id', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const request = createRequest('POST', 'http://localhost/api/bot', {
        execute_tool: true,
        tool: 'delete_friend',
        params: { friend_id: 2 },
      }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('confirmation_id');
    });
  });
});

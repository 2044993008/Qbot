import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as messagesGET, POST as messagesPOST } from './route';
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

// Mock csrf
vi.mock('@/lib/csrf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/csrf')>('@/lib/csrf');
  return {
    ...actual,
    extractCsrfToken: vi.fn(),
    verifyCsrfToken: vi.fn(),
  };
});

import { getAuthUser } from '@/lib/auth-utils';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);
const mockedCheckUserRateLimit = vi.mocked(checkUserRateLimit);
const mockedExtractCsrfToken = vi.mocked(extractCsrfToken);
const mockedVerifyCsrfToken = vi.mocked(verifyCsrfToken);

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

function createMockSupabase() {
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
    lt: vi.fn().mockReturnThis(),
  };

  const fromFn = vi.fn(() => chainable);

  return {
    ...chainable,
    from: fromFn,
    _chainable: chainable,
  };
}

describe('GET /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetAuthUser.mockReturnValue(null);
    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=1');
    const response = await messagesGET(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toContain('未登录');
  });

  it('returns 400 for invalid conversation_id (NaN)', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=abc');
    const response = await messagesGET(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 400 for missing conversation_id', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('GET', 'http://localhost/api/messages');
    const response = await messagesGET(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 403 when user does not own the conversation', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = createMockSupabase();
    mockSupabase._chainable.single = vi.fn().mockResolvedValue({ data: null, error: null });
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=1');
    const response = await messagesGET(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain('无权访问');
  });

  it('returns 200 with paginated messages', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockMessages = [
      { id: 1, conversation_id: 1, sender_id: 1, type: 'text', content: 'Hello', metadata: {}, created_at: '2024-01-01T00:00:00Z' },
      { id: 2, conversation_id: 1, sender_id: 2, type: 'text', content: 'Hi', metadata: {}, created_at: '2024-01-01T00:01:00Z' },
    ];
    const mockSenders = [
      { id: 1, nickname: 'Me', avatar_color: '#3b82f6' },
      { id: 2, nickname: 'You', avatar_color: '#ef4444' },
    ];

    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 1, type: 'private', target_id: 2 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase._chainable.range = vi.fn().mockResolvedValue({ data: mockMessages, error: null });
    mockSupabase._chainable.in = vi.fn().mockResolvedValue({ data: mockSenders, error: null });
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=1&limit=10&offset=0');
    const response = await messagesGET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.messages)).toBe(true);
    expect(json.messages.length).toBe(2);
    expect(json.messages[0].sender_nickname).toBe('Me');
    expect(json.messages[0].is_mine).toBe(true);
    expect(json.messages[1].is_mine).toBe(false);
  });

  it('returns 200 with empty messages array', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 1, type: 'private', target_id: 2 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase._chainable.range = vi.fn().mockResolvedValue({ data: [], error: null });
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=1');
    const response = await messagesGET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.messages).toEqual([]);
  });

  it('returns 200 with messages for group chat membership', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockMessages = [
      { id: 1, conversation_id: 1, sender_id: 2, type: 'text', content: 'Group hello', metadata: {}, created_at: '2024-01-01T00:00:00Z' },
    ];
    const mockSenders = [
      { id: 2, nickname: 'GroupUser', avatar_color: '#3b82f6' },
    ];

    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 2, type: 'group', target_id: 10 }, error: null });
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { id: 100 }, error: null }); // group_members check
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase._chainable.range = vi.fn().mockResolvedValue({ data: mockMessages, error: null });
    mockSupabase._chainable.in = vi.fn().mockResolvedValue({ data: mockSenders, error: null });
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=1');
    const response = await messagesGET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.messages.length).toBe(1);
  });

  it('returns 500 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = createMockSupabase();
    mockSupabase._chainable.single = vi.fn().mockResolvedValue({ data: { id: 1, user_id: 1, type: 'private', target_id: 2 }, error: null });
    mockSupabase._chainable.range = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('GET', 'http://localhost/api/messages?conversation_id=1');
    const response = await messagesGET(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain('服务器错误');
  });
});

describe('POST /api/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
    mockedExtractCsrfToken.mockReset();
    mockedVerifyCsrfToken.mockReset();
    process.env.PLAYWRIGHT_SKIP_RATE_LIMIT = 'true';
    delete (globalThis as any).io;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).io;
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetAuthUser.mockReturnValue(null);
    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' });
    const response = await messagesPOST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toContain('未登录');
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 30, retryAfter: 30 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(429);
    const json = await response.json();
    expect(json.error).toContain('过于频繁');
  });

  it('returns 403 when CSRF token is missing', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    mockedExtractCsrfToken.mockReturnValue(null);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' });
    const response = await messagesPOST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain('CSRF');
  });

  it('returns 403 when CSRF token is invalid', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    mockedExtractCsrfToken.mockReturnValue('invalid-token');
    mockedVerifyCsrfToken.mockReturnValue(false);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' }, { 'X-CSRF-Token': 'invalid-token' });
    const response = await messagesPOST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain('CSRF');
  });

  it('returns 400 for invalid body', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: -1, content: '' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
  });

  it('returns 403 when user cannot send to conversation', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const mockSupabase = createMockSupabase();
    mockSupabase._chainable.single = vi.fn().mockResolvedValue({ data: null, error: null });
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain('无权向该会话发送消息');
  });

  it('returns 200 and sends message successfully', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const mockMessage = { id: 1, conversation_id: 1, sender_id: 1, type: 'text', content: 'hello', metadata: {}, created_at: '2024-01-01T00:00:00Z' };
    const mockSender = { id: 1, nickname: 'Me', avatar_color: '#3b82f6' };

    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 1, type: 'private', target_id: 2 }, error: null });
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { id: 1, type: 'private' }, error: null });
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: mockMessage, error: null });
      }
      if (singleCallCount === 4) {
        return Promise.resolve({ data: mockSender, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase._chainable.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockMessage, error: null }),
      }),
    });

    mockSupabase._chainable.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toBeDefined();
    expect(json.message.content).toBe('hello');
    expect(json.message.is_mine).toBe(true);
  });

  it('broadcasts new message via socket when io is available', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const mockMessage = { id: 1, conversation_id: 1, sender_id: 1, type: 'text', content: 'hello', metadata: {}, created_at: '2024-01-01T00:00:00Z' };
    const mockSender = { id: 1, nickname: 'Me', avatar_color: '#3b82f6' };
    const emitMock = vi.fn();

    (globalThis as any).io = {
      to: vi.fn(() => ({
        emit: emitMock,
      })),
    };

    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 1, type: 'private', target_id: 2 }, error: null });
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { id: 1, type: 'private' }, error: null });
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: mockMessage, error: null });
      }
      if (singleCallCount === 4) {
        return Promise.resolve({ data: mockSender, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase._chainable.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockMessage, error: null }),
      }),
    });

    mockSupabase._chainable.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(200);
    expect((globalThis as any).io.to).toHaveBeenCalledWith('conversation_1');
    expect(emitMock).toHaveBeenCalledWith('new_message', expect.objectContaining({ content: 'hello', is_mine: false }));
  });

  it('triggers bot reply on @小Q管家 in group chat', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const mockMessage = { id: 1, conversation_id: 1, sender_id: 1, type: 'text', content: '@小Q管家 你好', metadata: {}, created_at: '2024-01-01T00:00:00Z' };
    const mockSender = { id: 1, nickname: 'Me', avatar_color: '#3b82f6' };

    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 1, type: 'group', target_id: 10 }, error: null });
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { id: 1, type: 'group' }, error: null });
      }
      if (singleCallCount === 3) {
        return Promise.resolve({ data: mockMessage, error: null });
      }
      if (singleCallCount === 4) {
        return Promise.resolve({ data: mockSender, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase._chainable.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockMessage, error: null }),
      }),
    });

    mockSupabase._chainable.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: '@小Q管家 你好' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message.content).toBe('@小Q管家 你好');

    // The bot trigger is an unawaited async microtask; give it time to run
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify no errors were logged from the bot trigger path
    const botErrorCalls = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('Bot') || String(call[0]).includes('bot')
    );
    expect(botErrorCalls.length).toBe(0);

    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 on database error during send', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedCheckUserRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60, retryAfter: 0 });
    const csrfToken = generateCsrfToken('1');
    mockedExtractCsrfToken.mockReturnValue(csrfToken);
    mockedVerifyCsrfToken.mockReturnValue(true);

    const mockSupabase = createMockSupabase();
    let singleCallCount = 0;
    mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: { id: 1, user_id: 1, type: 'private', target_id: 2 }, error: null });
      }
      if (singleCallCount === 2) {
        return Promise.resolve({ data: { id: 1, type: 'private' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase._chainable.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      }),
    });

    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/messages', { conversation_id: 1, content: 'hello' }, { 'X-CSRF-Token': csrfToken });
    const response = await messagesPOST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain('服务器错误');
  });
});

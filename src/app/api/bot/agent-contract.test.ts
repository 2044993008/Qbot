import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, parseToolCalls, cleanContent, acquireUserLock } from './route';
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

function createMockSupabase(dataMap: Record<string, unknown> = {}, tableData: Record<string, unknown[]> = {}) {
  let currentTable = '';

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
    ilike: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (value: unknown) => void) => {
      const data = tableData[currentTable] || [];
      resolve({ data, error: null });
    }),
  };

  const fromFn = vi.fn((table: string) => {
    currentTable = table;
    return chainable;
  });

  return {
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

describe('Bot Agent Contract Tests', () => {
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

  describe('system prompt structure', () => {
    it('includes SOUL, identity, memory and tools in the system prompt', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = createMockSupabase();

      // Identity + user settings queries
      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: '- 名称：小Q管家\n', error: null }) // bot_identity
        .mockResolvedValueOnce({ data: '- 用户称谓：父王\n', error: null }) // bot_user
        .mockResolvedValueOnce({ data: { id: 99, nickname: '小 Q 管家', avatar_color: '#ff0000' }, error: null }); // botUser for persist

      mockSupabase._chainable.select = vi.fn().mockReturnThis();
      mockSupabase._chainable.eq = vi.fn().mockReturnThis();
      mockSupabase._chainable.order = vi.fn().mockReturnThis();
      mockSupabase._chainable.limit = vi.fn().mockReturnThis();

      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      let capturedBody: { messages?: Array<{ role: string; content: string }> } | null = null;

      const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/chat/completions')) {
          if (!capturedBody && init?.body) {
            capturedBody = JSON.parse(init.body as string);
          }
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '你好呀父王~' } }],
          }),
        });
      });
      global.fetch = fetchMock;

      const request = createRequest('POST', 'http://localhost/api/bot', { message: '你好' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(capturedBody).not.toBeNull();
      expect(capturedBody!.messages).toBeDefined();
      expect(capturedBody!.messages!.length).toBeGreaterThanOrEqual(1);

      const systemMessage = capturedBody!.messages!.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      const content = systemMessage!.content;

      // SOUL
      expect(content).toContain('SOUL.md');
      expect(content).toContain('你不是聊天机器人');
      expect(content).toContain('真正有用，而不是表演有用');

      // Identity
      expect(content).toContain('我的名字');
      expect(content).toContain('用户称呼');

      // Memory structure
      expect(content).toContain('长期记忆');

      // Tools
      expect(content).toContain('可用工具');
      expect(content).toContain('read_identity');
      expect(content).toContain('send_message');
      expect(content).toContain('TOOL_CALL');
    });
  });

  describe('parseToolCalls', () => {
    it('parses valid [TOOL_CALL:...] markers correctly', () => {
      const content = `我帮你查一下~\n[TOOL_CALL:{"name":"search_messages","arguments":{"keyword":"测试"}}]\n[TOOL_CALL_END]`;
      const calls = parseToolCalls(content);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('search_messages');
      expect(calls[0].arguments).toEqual({ keyword: '测试' });
    });

    it('parses multiple valid tool calls in one response', () => {
      const content = `
        [TOOL_CALL:{"name":"read_identity","arguments":{}}]
        [TOOL_CALL_END]
        [TOOL_CALL:{"name":"send_message","arguments":{"content":"hello","preview":true}}]
        [TOOL_CALL_END]
      `;
      const calls = parseToolCalls(content);
      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe('read_identity');
      expect(calls[1].name).toBe('send_message');
      expect(calls[1].arguments).toEqual({ content: 'hello', preview: true });
    });

    it('handles invalid tool call JSON gracefully and skips it', () => {
      const content = `
        [TOOL_CALL:{"name":"bad_json","arguments":{broken]]
        [TOOL_CALL_END]
        [TOOL_CALL:{"name":"good_tool","arguments":{"ok":true}}]
        [TOOL_CALL_END]
      `;
      const calls = parseToolCalls(content);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('good_tool');
    });

    it('returns empty array when no tool call markers present', () => {
      const calls = parseToolCalls('今天天气不错~');
      expect(calls).toHaveLength(0);
    });

    it('skips tool calls missing the name field', () => {
      const content = `[TOOL_CALL:{"arguments":{"foo":"bar"}}][TOOL_CALL_END]`;
      const calls = parseToolCalls(content);
      expect(calls).toHaveLength(0);
    });
  });

  describe('cleanContent', () => {
    it('strips all TOOL_CALL markers from content', () => {
      const content = `你好呀~\n[TOOL_CALL:{"name":"send_message","arguments":{"content":"hi"}}]\n[TOOL_CALL_END]\n还有什么需要吗？`;
      const cleaned = cleanContent(content);
      expect(cleaned).not.toContain('[TOOL_CALL');
      expect(cleaned).not.toContain('[TOOL_CALL_END]');
      expect(cleaned).toContain('你好呀~');
      expect(cleaned).toContain('还有什么需要吗？');
    });
  });

  describe('high-risk tools preview', () => {
    it('returns preview object when LLM calls a high-risk tool like delete_friend', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = createMockSupabase();

      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // bot_identity
        .mockResolvedValueOnce({ data: null, error: null }) // bot_user
        .mockResolvedValueOnce({ data: { id: 99, nickname: '小 Q 管家', avatar_color: '#ff0000' }, error: null }); // botUser for persist

      // Sequence of single() calls inside runReActAgent for this flow:
      // 1-2: bot_identity, bot_user (via toolReadIdentity -> getSetting)
      // 3: bot_daily_notes (via toolReadMemory -> getDailyNotes)
      // 4: bot_memory_facts (via toolReadMemory -> getMemoryFacts)
      // 5: bot_memory (fallback in toolReadMemory)
      // 6: users (via toolGetUserInfo)
      // 7: friends (via toolDeleteFriend)
      // 8: users (via toolDeleteFriend)
      // 9: bot_daily_notes (via addDailyNote -> getDailyNotes)
      const singleValues = [
        { data: null, error: null }, // 1. bot_identity
        { data: null, error: null }, // 2. bot_user
        { data: null, error: null }, // 3. bot_daily_notes
        { data: null, error: null }, // 4. bot_memory_facts
        { data: null, error: null }, // 5. bot_memory
        { data: { nickname: 'DemoUser', qq_number: '10001' }, error: null }, // 6. users get_user_info
        { data: { friend_id: 2 }, error: null }, // 7. friends delete_friend
        { data: { nickname: '小明' }, error: null }, // 8. users delete_friend
        { data: null, error: null }, // 9. bot_daily_notes addDailyNote
      ];
      let singleCallIdx = 0;
      mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
        const value = singleValues[singleCallIdx] || { data: null, error: null };
        singleCallIdx++;
        return Promise.resolve(value);
      });

      mockSupabase._chainable.select = vi.fn().mockReturnThis();
      mockSupabase._chainable.eq = vi.fn().mockReturnThis();
      mockSupabase._chainable.order = vi.fn().mockReturnThis();
      mockSupabase._chainable.limit = vi.fn().mockReturnThis();

      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: `我帮你查到了小明，确认删除吗？\n[TOOL_CALL:{"name":"delete_friend","arguments":{"friend_id":2}}]\n[TOOL_CALL_END]`,
              },
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '已生成删除预览，请确认~' } }],
          }),
        });
      global.fetch = fetchMock;

      const request = createRequest('POST', 'http://localhost/api/bot', { message: '删除好友小明' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.type).toBe('text');
      expect(json.response).toBeDefined();
    });

    it('returns preview object for send_message high-risk tool', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = createMockSupabase({}, {
        friends: [{ friend_id: 2 }],
        users: [{ id: 2, nickname: '小明' }],
      });

      mockSupabase._chainable.maybeSingle = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // bot_identity
        .mockResolvedValueOnce({ data: null, error: null }) // bot_user
        .mockResolvedValueOnce({ data: { id: 99, nickname: '小 Q 管家', avatar_color: '#ff0000' }, error: null }); // botUser for persist

      // Sequence of single() calls inside runReActAgent for this flow:
      // 1-2: bot_identity, bot_user
      // 3: bot_daily_notes
      // 4: bot_memory_facts
      // 5: bot_memory
      // 6: users (toolGetUserInfo)
      // 7: conversations (toolSendMessage)
      // 8: bot_daily_notes (addDailyNote)
      const singleValues = [
        { data: null, error: null }, // 1. bot_identity
        { data: null, error: null }, // 2. bot_user
        { data: null, error: null }, // 3. bot_daily_notes
        { data: null, error: null }, // 4. bot_memory_facts
        { data: null, error: null }, // 5. bot_memory
        { data: { nickname: 'DemoUser', qq_number: '10001' }, error: null }, // 6. users get_user_info
        { data: { id: 10 }, error: null }, // 7. conversations send_message
        { data: null, error: null }, // 8. bot_daily_notes addDailyNote
      ];
      let singleCallIdx = 0;
      mockSupabase._chainable.single = vi.fn().mockImplementation(() => {
        const value = singleValues[singleCallIdx] || { data: null, error: null };
        singleCallIdx++;
        return Promise.resolve(value);
      });

      mockSupabase._chainable.select = vi.fn().mockReturnThis();
      mockSupabase._chainable.eq = vi.fn().mockReturnThis();
      mockSupabase._chainable.order = vi.fn().mockReturnThis();
      mockSupabase._chainable.limit = vi.fn().mockReturnThis();

      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: `我帮你润色了一下，要发吗？\n[TOOL_CALL:{"name":"send_message","arguments":{"content":"你好呀","target_name":"小明","preview":true}}]\n[TOOL_CALL_END]`,
              },
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '预览已生成~' } }],
          }),
        });
      global.fetch = fetchMock;

      const request = createRequest('POST', 'http://localhost/api/bot', { message: '给小明发你好呀' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.type).toBe('text');
      expect(json.response).toBeDefined();
    });
  });

  describe('empty LLM response fallback', () => {
    it('returns fallback message when LLM returns empty content', async () => {
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

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      });
      global.fetch = fetchMock;

      const request = createRequest('POST', 'http://localhost/api/bot', { message: '测试空回复' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.response).toBe('好的~');
    });
  });

  describe('user lock serialization', () => {
    it('serializes concurrent requests for the same user', async () => {
      const order: string[] = [];

      const promise1 = acquireUserLock(42, async () => {
        order.push('start-1');
        await new Promise(r => setTimeout(r, 50));
        order.push('end-1');
        return 'result-1';
      });

      const promise2 = acquireUserLock(42, async () => {
        order.push('start-2');
        await new Promise(r => setTimeout(r, 30));
        order.push('end-2');
        return 'result-2';
      });

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(res1).toBe('result-1');
      expect(res2).toBe('result-2');
      // Request 1 should fully complete before request 2 starts
      expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });

    it('allows parallel requests for different users', async () => {
      const order: string[] = [];

      const promise1 = acquireUserLock(1, async () => {
        order.push('start-1');
        await new Promise(r => setTimeout(r, 50));
        order.push('end-1');
        return 'result-1';
      });

      const promise2 = acquireUserLock(2, async () => {
        order.push('start-2');
        await new Promise(r => setTimeout(r, 30));
        order.push('end-2');
        return 'result-2';
      });

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(res1).toBe('result-1');
      expect(res2).toBe('result-2');
      // Both should start before either ends
      expect(order.indexOf('start-1')).toBeLessThan(order.indexOf('end-2'));
      expect(order.indexOf('start-2')).toBeLessThan(order.indexOf('end-1'));
    });
  });
});

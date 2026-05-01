import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { botApi } from './api';

describe('botApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document.cookie for CSRF token
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'qq_csrf=test-csrf-token',
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('send', () => {
    it('makes POST request with correct URL, method, body, and CSRF header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'hello', type: 'text' }),
      });
      global.fetch = fetchMock;

      await botApi.send('你好', 1, { extra: 'data' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bot',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: '你好', conversation_id: 1, context: { extra: 'data' } }),
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'test-csrf-token',
          }),
        })
      );
    });

    it('works without optional conversationId and context', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'hi', type: 'text' }),
      });
      global.fetch = fetchMock;

      await botApi.send('test');

      const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(callArgs.body as string)).toEqual({
        message: 'test',
        conversation_id: undefined,
        context: undefined,
      });
    });
  });

  describe('executeTool', () => {
    it('includes execute_tool=true, tool name, and params in body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = fetchMock;

      await botApi.executeTool('send_message', { target: '李华', content: 'hello' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bot',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            execute_tool: true,
            tool: 'send_message',
            params: { target: '李华', content: 'hello' },
          }),
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'test-csrf-token',
          }),
        })
      );
    });
  });

  describe('getConfig', () => {
    it('makes GET request without body and without CSRF header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bot: null, name: '小Q管家' }),
      });
      global.fetch = fetchMock;

      await botApi.getConfig();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bot',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['X-CSRF-Token']).toBeUndefined();
      expect(callArgs.method).toBeUndefined();
    });
  });

  describe('getAuditLogs', () => {
    it('includes default pagination params', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ logs: [], total: 0, page: 1, limit: 20 }),
      });
      global.fetch = fetchMock;

      await botApi.getAuditLogs();

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bot/audit-logs?page=1&limit=20',
        expect.any(Object)
      );
    });

    it('includes custom pagination params', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ logs: [], total: 0, page: 3, limit: 50 }),
      });
      global.fetch = fetchMock;

      await botApi.getAuditLogs(3, 50);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bot/audit-logs?page=3&limit=50',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('throws error with response error message on non-2xx', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: '服务器内部错误' }),
      });
      global.fetch = fetchMock;

      await expect(botApi.send('test')).rejects.toThrow('服务器内部错误');
    });

    it('throws generic error when response json parsing fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => {
          throw new Error('parse error');
        },
      });
      global.fetch = fetchMock;

      await expect(botApi.send('test')).rejects.toThrow('请求失败');
    });

    it('throws error with default message when error field is missing', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      });
      global.fetch = fetchMock;

      await expect(botApi.executeTool('test', {})).rejects.toThrow('请求失败');
    });
  });
});

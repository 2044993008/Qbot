import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@/lib/auth-utils';

const mockedVerifyToken = vi.mocked(verifyToken);

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

describe('Tasks Parse API Route', () => {
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
    const request = createRequest('POST', 'http://localhost/api/tasks/parse', { text: '每天上午9点' });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when text is missing', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/tasks/parse', {});
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when text is empty', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/tasks/parse', { text: '' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('parses natural language to cron successfully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"cron": "0 9 * * *", "description": "每天上午9点", "confidence": 0.95}' } }],
      }),
    });
    global.fetch = fetchMock;

    const request = createRequest('POST', 'http://localhost/api/tasks/parse', { text: '每天上午9点' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.cron).toBe('0 9 * * *');
    expect(json.confidence).toBe(0.95);
  });

  it('returns 422 when LLM returns no cron', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"description": "无法解析"}' } }],
      }),
    });
    global.fetch = fetchMock;

    const request = createRequest('POST', 'http://localhost/api/tasks/parse', { text: '某个时间' });
    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it('returns 500 when LLM API fails', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    global.fetch = fetchMock;

    const request = createRequest('POST', 'http://localhost/api/tasks/parse', { text: '每天上午9点' });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('handles non-JSON LLM response gracefully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这里有一些文字但没有JSON' } }],
      }),
    });
    global.fetch = fetchMock;

    const request = createRequest('POST', 'http://localhost/api/tasks/parse', { text: '随便说点什么' });
    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});

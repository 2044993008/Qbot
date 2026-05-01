import { describe, it, expect, vi, beforeEach } from 'vitest';
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

function createChain(finalValue: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<{ data: unknown; error: null | { message: string } }> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => Promise.resolve(finalValue)),
    maybeSingle: vi.fn(() => Promise.resolve(finalValue)),
    single: vi.fn(() => Promise.resolve(finalValue)),
    then: vi.fn((onFulfilled, onRejected) => Promise.resolve(finalValue).then(onFulfilled, onRejected)),
  };
  return chain;
}

describe('Moments API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAYWRIGHT_SKIP_RATE_LIMIT = 'true';
  });

  describe('GET /api/moments', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('GET', 'http://localhost/api/moments');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns moments list successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockMoments = [
        { id: 1, user_id: 1, content: 'Hello', images: [], like_count: 2, comment_count: 1, created_at: '2025-01-01T00:00:00Z' },
        { id: 2, user_id: 2, content: 'World', images: [], like_count: 0, comment_count: 0, created_at: '2025-01-02T00:00:00Z' },
      ];
      const mockUsers = [
        { id: 1, nickname: 'User1', avatar_color: '#ff0000' },
        { id: 2, nickname: 'User2', avatar_color: '#00ff00' },
      ];
      const mockComments = [
        { id: 1, moment_id: 1, user_id: 2, content: 'Nice', created_at: '2025-01-01T01:00:00Z' },
      ];
      const mockLikes = [{ moment_id: 1 }];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'friends') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moments') {
            return createChain({ data: mockMoments, error: null });
          }
          if (table === 'users') {
            const chain = createChain({ data: mockUsers, error: null });
            // Override single for publisher query
            chain.single = vi.fn().mockResolvedValue({ data: mockUsers[0], error: null });
            return chain;
          }
          if (table === 'moment_comments') {
            return createChain({ data: mockComments, error: null });
          }
          if (table === 'moment_likes') {
            return createChain({ data: mockLikes, error: null });
          }
          return createChain({ data: [], error: null });
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/moments');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moments).toBeDefined();
      expect(json.moments).toHaveLength(2);
    });

    it('returns empty array when no moments', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'friends') {
            return createChain({ data: [], error: null });
          }
          return createChain({ data: [], error: null });
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/moments');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moments).toEqual([]);
    });

    it('returns 500 on database error', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockRejectedValue(new Error('DB error')),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/moments');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/moments', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'test' });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'test' }, { 'X-CSRF-Token': 'invalid' });
      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid body', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const request = createRequest('POST', 'http://localhost/api/moments', { content: '' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('creates moment successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockMoment = { id: 1, user_id: 1, content: 'Hello world', images: [], like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' };
      const mockUser = { id: 1, nickname: 'User1', avatar_color: '#ff0000' };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = createChain({ data: null, error: null });
          if (table === 'moments') {
            return {
              ...chain,
              insert: vi.fn(() => ({
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockMoment, error: null }),
              })),
            };
          }
          if (table === 'users') {
            chain.single = vi.fn().mockResolvedValue({ data: mockUser, error: null });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'Hello world' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moment).toBeDefined();
      expect(json.moment.content).toBe('Hello world');
    });

    it('returns 500 when insert fails', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'Hello world' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });
});

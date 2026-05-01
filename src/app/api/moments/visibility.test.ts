import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { PUT } from './[id]/route';
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

describe('Moments Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAYWRIGHT_SKIP_RATE_LIMIT = 'true';
  });

  describe('GET /api/moments visibility filtering', () => {
    it('shows public moments from anyone', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockMoments = [
        { id: 1, user_id: 2, content: 'Public moment', images: [], visibility: 'public', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' },
      ];
      const mockUsers = [{ id: 2, nickname: 'User2', avatar_color: '#00ff00' }];

      let capturedOrFilter: string | undefined;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'friends') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moments') {
            const chain = createChain({ data: mockMoments, error: null });
            chain.or = vi.fn((filter: string) => {
              capturedOrFilter = filter;
              return chain;
            });
            return chain;
          }
          if (table === 'users') {
            const chain = createChain({ data: mockUsers, error: null });
            chain.single = vi.fn().mockResolvedValue({ data: mockUsers[0], error: null });
            return chain;
          }
          if (table === 'moment_comments') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moment_likes') {
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
      expect(json.moments).toHaveLength(1);
      expect(json.moments[0].visibility).toBe('public');
      expect(capturedOrFilter).toContain('visibility.eq.public');
    });

    it('shows friends-visible moments from friends', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockMoments = [
        { id: 1, user_id: 2, content: 'Friends moment', images: [], visibility: 'friends', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' },
      ];
      const mockUsers = [{ id: 2, nickname: 'User2', avatar_color: '#00ff00' }];

      let capturedOrFilter: string | undefined;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'friends') {
            return createChain({ data: [{ friend_id: 2 }], error: null });
          }
          if (table === 'moments') {
            const chain = createChain({ data: mockMoments, error: null });
            chain.or = vi.fn((filter: string) => {
              capturedOrFilter = filter;
              return chain;
            });
            return chain;
          }
          if (table === 'users') {
            const chain = createChain({ data: mockUsers, error: null });
            chain.single = vi.fn().mockResolvedValue({ data: mockUsers[0], error: null });
            return chain;
          }
          if (table === 'moment_comments') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moment_likes') {
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
      expect(json.moments).toHaveLength(1);
      expect(capturedOrFilter).toContain('visibility.eq.friends');
    });

    it('shows private moments only from self', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockMoments = [
        { id: 1, user_id: 1, content: 'Private moment', images: [], visibility: 'private', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' },
      ];
      const mockUsers = [{ id: 1, nickname: 'User1', avatar_color: '#ff0000' }];

      let capturedOrFilter: string | undefined;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'friends') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moments') {
            const chain = createChain({ data: mockMoments, error: null });
            chain.or = vi.fn((filter: string) => {
              capturedOrFilter = filter;
              return chain;
            });
            return chain;
          }
          if (table === 'users') {
            const chain = createChain({ data: mockUsers, error: null });
            chain.single = vi.fn().mockResolvedValue({ data: mockUsers[0], error: null });
            return chain;
          }
          if (table === 'moment_comments') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moment_likes') {
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
      expect(json.moments).toHaveLength(1);
      expect(json.moments[0].visibility).toBe('private');
      expect(capturedOrFilter).toContain('visibility.eq.private');
    });

    it('filters by user_id with visibility constraints', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockMoments = [
        { id: 1, user_id: 2, content: 'Public', images: [], visibility: 'public', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' },
      ];
      const mockUsers = [{ id: 2, nickname: 'User2', avatar_color: '#00ff00' }];

      let capturedOrFilter: string | undefined;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'friends') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moments') {
            const chain = createChain({ data: mockMoments, error: null });
            chain.or = vi.fn((filter: string) => {
              capturedOrFilter = filter;
              return chain;
            });
            return chain;
          }
          if (table === 'users') {
            const chain = createChain({ data: mockUsers, error: null });
            chain.single = vi.fn().mockResolvedValue({ data: mockUsers[0], error: null });
            return chain;
          }
          if (table === 'moment_comments') {
            return createChain({ data: [], error: null });
          }
          if (table === 'moment_likes') {
            return createChain({ data: [], error: null });
          }
          return createChain({ data: [], error: null });
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/moments?user_id=2');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moments).toHaveLength(1);
      expect(capturedOrFilter).toContain('visibility.eq.public');
      expect(capturedOrFilter).not.toContain('visibility.eq.private');
    });
  });

  describe('POST /api/moments with visibility', () => {
    it('creates moment with friends visibility', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockMoment = { id: 1, user_id: 1, content: 'Hello friends', images: [], visibility: 'friends', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' };
      const mockUser = { id: 1, nickname: 'User1', avatar_color: '#ff0000' };
      let insertedData: Record<string, unknown> | undefined;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = createChain({ data: null, error: null });
          if (table === 'moments') {
            return {
              ...chain,
              insert: vi.fn((data: Record<string, unknown>) => {
                insertedData = data;
                return {
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: mockMoment, error: null }),
                };
              }),
            };
          }
          if (table === 'users') {
            chain.single = vi.fn().mockResolvedValue({ data: mockUser, error: null });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'Hello friends', visibility: 'friends' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moment.visibility).toBe('friends');
      expect(insertedData?.visibility).toBe('friends');
    });

    it('creates moment with private visibility', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockMoment = { id: 1, user_id: 1, content: 'Secret', images: [], visibility: 'private', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' };
      const mockUser = { id: 1, nickname: 'User1', avatar_color: '#ff0000' };
      let insertedData: Record<string, unknown> | undefined;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = createChain({ data: null, error: null });
          if (table === 'moments') {
            return {
              ...chain,
              insert: vi.fn((data: Record<string, unknown>) => {
                insertedData = data;
                return {
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: mockMoment, error: null }),
                };
              }),
            };
          }
          if (table === 'users') {
            chain.single = vi.fn().mockResolvedValue({ data: mockUser, error: null });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'Secret', visibility: 'private' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moment.visibility).toBe('private');
      expect(insertedData?.visibility).toBe('private');
    });

    it('defaults to public visibility when not specified', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockMoment = { id: 1, user_id: 1, content: 'Hello', images: [], visibility: 'public', like_count: 0, comment_count: 0, created_at: '2025-01-01T00:00:00Z' };
      const mockUser = { id: 1, nickname: 'User1', avatar_color: '#ff0000' };
      let insertedData: Record<string, unknown> | undefined;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = createChain({ data: null, error: null });
          if (table === 'moments') {
            return {
              ...chain,
              insert: vi.fn((data: Record<string, unknown>) => {
                insertedData = data;
                return {
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: mockMoment, error: null }),
                };
              }),
            };
          }
          if (table === 'users') {
            chain.single = vi.fn().mockResolvedValue({ data: mockUser, error: null });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/moments', { content: 'Hello' }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(insertedData?.visibility).toBe('public');
    });
  });

  describe('PUT /api/moments/[id] with visibility', () => {
    it('updates moment visibility successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockMoment = { id: 1, user_id: 1, content: 'Updated', images: [], visibility: 'private', like_count: 2, comment_count: 1, created_at: '2025-01-01T00:00:00Z' };
      const mockUser = { id: 1, nickname: 'User1', avatar_color: '#ff0000' };
      let updatedData: Record<string, unknown> | undefined;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn((data: Record<string, unknown>) => {
              updatedData = data;
              return {
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockMoment, error: null }),
              };
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 1 }, error: null }),
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
          };
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/moments/1', { visibility: 'private' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moment.visibility).toBe('private');
      expect(updatedData?.visibility).toBe('private');
    });
  });
});

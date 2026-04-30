import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as friendDetailGET, PUT as friendDetailPUT } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  extractCsrfToken: () => 'valid-csrf-token',
  verifyCsrfToken: () => true,
}));

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('GET /api/friends/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReset();
  });

  it('returns 200 with friend details', async () => {
    const mockFriend = {
      id: 2,
      qq_number: '10002',
      nickname: 'UserA',
      avatar_color: '#3b82f6',
      signature: 'Hi',
      status: 'online',
      last_seen: '2024-01-01',
      created_at: '2024-01-01',
    };

    const mockRelation = { remark: '好友A', created_at: '2024-01-01' };
    const mockConversation = { id: 10 };
    const mockMessages = [
      { id: 1, content: 'Hello', type: 'text', created_at: '2024-01-01' },
    ];

    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1 && table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: mockFriend, error: null })),
              })),
            })),
          };
        }
        if (callCount === 2 && table === 'friends') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: mockRelation, error: null })),
                })),
              })),
            })),
          };
        }
        if (callCount === 3 && table === 'conversations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({ data: mockConversation, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (callCount === 4 && table === 'messages') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({ data: mockMessages, error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends/2', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailGET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.friend).toBeDefined();
    expect(data.friend.id).toBe(2);
  });

  it('returns 400 on invalid friend id', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/friends/invalid');
    const params = Promise.resolve({ id: 'invalid' });

    const response = await friendDetailGET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('缺少好友ID');
  });

  it('returns 401 without token', async () => {
    mockedVerifyToken.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/friends/2');
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailGET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 404 when friend not found', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends/999', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const params = Promise.resolve({ id: '999' });

    const response = await friendDetailGET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('好友不存在');
  });

  it('returns 500 on database error', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends/2', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailGET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

describe('PUT /api/friends/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReset();
  });

  it('returns 200 on successful remark update', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends/2', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ remark: '新备注' }),
    });
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailPUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 400 on invalid friend id', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/friends/invalid', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ remark: '新备注' }),
    });
    const params = Promise.resolve({ id: 'invalid' });

    const response = await friendDetailPUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('缺少好友ID');
  });

  it('returns 401 without token', async () => {
    mockedVerifyToken.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/friends/2', {
      method: 'PUT',
      body: JSON.stringify({ remark: '新备注' }),
    });
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailPUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 400 on invalid input', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/friends/2', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ remark: 'a'.repeat(100) }),
    });
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailPUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 500 on database error', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Update failed' } })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends/2', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ remark: '新备注' }),
    });
    const params = Promise.resolve({ id: '2' });

    const response = await friendDetailPUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

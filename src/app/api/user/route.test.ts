import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as userGET, PUT as userPUT } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  extractCsrfToken: () => 'valid-csrf-token',
  verifyCsrfToken: () => true,
}));

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('GET /api/user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
  });

  it('returns 200 with current user info', async () => {
    const mockUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      avatar_color: '#3b82f6',
      signature: 'Hello',
      status: 'online',
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: mockUser, error: null })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await userGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.qq_number).toBe('10001');
  });

  it('returns 401 without token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/user');

    const response = await userGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 401 with invalid token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const response = await userGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 404 when user not found', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

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

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await userGET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('用户不存在');
  });

  it('returns 500 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

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

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await userGET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

describe('PUT /api/user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
  });

  it('returns 200 on successful update', async () => {
    const updatedUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'NewNickname',
      avatar_color: '#ef4444',
      signature: 'New signature',
      status: 'online',
    };

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: updatedUser, error: null })),
            })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/user', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ nickname: 'NewNickname', avatar_color: '#ef4444', signature: 'New signature' }),
    });

    const response = await userPUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.nickname).toBe('NewNickname');
  });

  it('returns 401 without token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/user', {
      method: 'PUT',
      body: JSON.stringify({ nickname: 'NewNickname' }),
    });

    const response = await userPUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 400 on invalid input', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/user', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ nickname: '' }),
    });

    const response = await userPUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when no fields to update', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/user', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ status: 'online' }),
    });

    const response = await userPUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('没有可更新的字段');
  });

  it('returns 500 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Update failed' } })),
            })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/user', {
      method: 'PUT',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ nickname: 'NewNickname' }),
    });

    const response = await userPUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

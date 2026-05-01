import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as friendsGET } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('GET /api/friends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
  });

  it('returns 200 with friends list', async () => {
    const mockFriends = [
      { friend_id: 2, remark: '好友A', created_at: '2024-01-01' },
      { friend_id: 3, remark: null, created_at: '2024-01-02' },
    ];

    const mockUsers = [
      { id: 2, qq_number: '10002', nickname: 'UserA', avatar_color: '#3b82f6', signature: 'Hi', status: 'online', last_seen: '2024-01-01' },
      { id: 3, qq_number: '10003', nickname: 'UserB', avatar_color: '#ef4444', signature: 'Hey', status: 'offline', last_seen: '2024-01-02' },
    ];

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1 && table === 'friends') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: mockFriends, error: null })),
            })),
          };
        }
        if (callCount === 2 && table === 'users') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: mockUsers, error: null })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await friendsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.friends)).toBe(true);
  });

  it('returns 200 with empty friends list', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await friendsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.friends).toEqual([]);
  });

  it('returns 401 without token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/friends');

    const response = await friendsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 401 with invalid token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/friends', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const response = await friendsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 500 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/friends', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await friendsGET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
  isGroupMember: vi.fn(),
}));

import { verifyToken, isGroupMember } from '@/lib/auth-utils';

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedIsGroupMember = vi.mocked(isGroupMember);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

function createRequest(url: string) {
  return new NextRequest(url);
}

describe('Group Members API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = createRequest('http://localhost/api/groups/members?group_id=1');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when group_id is missing', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('http://localhost/api/groups/members');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when group_id is invalid', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('http://localhost/api/groups/members?group_id=invalid');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns 403 when user is not a group member', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedIsGroupMember.mockResolvedValue(false);
    const request = createRequest('http://localhost/api/groups/members?group_id=1');
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it('returns members list successfully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedIsGroupMember.mockResolvedValue(true);
    const mockMembers = [
      { id: 1, user_id: 1, role: 'admin', joined_at: '2025-01-01T00:00:00Z' },
      { id: 2, user_id: 2, role: 'member', joined_at: '2025-01-02T00:00:00Z' },
    ];
    const mockUsers = [
      { id: 1, qq_number: '10001', nickname: 'User1', avatar_color: '#ff0000', status: 'online', signature: '' },
      { id: 2, qq_number: '10002', nickname: 'User2', avatar_color: '#00ff00', status: 'offline', signature: '' },
    ];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };
        if (table === 'group_members') {
          chain.eq.mockResolvedValue({ data: mockMembers, error: null });
        }
        if (table === 'users') {
          chain.in.mockResolvedValue({ data: mockUsers, error: null });
        }
        return chain;
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/groups/members?group_id=1');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.members).toBeDefined();
    expect(json.members).toHaveLength(2);
    expect(json.members[0].nickname).toBe('User1');
  });

  it('returns empty array when no members found', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedIsGroupMember.mockResolvedValue(true);
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/groups/members?group_id=1');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.members).toEqual([]);
  });

  it('returns 500 when database query fails', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedIsGroupMember.mockResolvedValue(true);
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/groups/members?group_id=1');
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

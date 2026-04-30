import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@/lib/auth-utils';

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

function createRequest(url: string) {
  return new NextRequest(url);
}

describe('Groups API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = createRequest('http://localhost/api/groups');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns groups list successfully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const mockMemberships = [{ group_id: 1 }, { group_id: 2 }];
    const mockGroups = [
      { id: 1, name: 'Group A', avatar_color: '#ff0000', description: 'Desc A' },
      { id: 2, name: 'Group B', avatar_color: '#00ff00', description: 'Desc B' },
    ];
    const mockAllMembers = [{ group_id: 1 }, { group_id: 1 }, { group_id: 2 }];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        };
        if (table === 'group_members') {
          chain.eq.mockResolvedValue({ data: mockMemberships, error: null });
          // Second call for allMembers
          chain.in.mockResolvedValue({ data: mockAllMembers, error: null });
        }
        if (table === 'groups') {
          chain.in.mockResolvedValue({ data: mockGroups, error: null });
        }
        return chain;
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/groups');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.groups).toBeDefined();
    expect(json.groups).toHaveLength(2);
    expect(json.groups[0].member_count).toBe(2);
    expect(json.groups[1].member_count).toBe(1);
  });

  it('returns empty array when user has no groups', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/groups');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.groups).toEqual([]);
  });

  it('returns 500 when database query fails', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/groups');
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

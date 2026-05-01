import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as conversationsGET, POST as conversationsPOST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser, isFriend, isGroupMember } from '@/lib/auth-utils';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
  isFriend: vi.fn().mockResolvedValue(true),
  isGroupMember: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/csrf', () => ({
  extractCsrfToken: () => 'valid-csrf-token',
  verifyCsrfToken: () => true,
}));

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedIsFriend = vi.mocked(isFriend);
const mockedIsGroupMember = vi.mocked(isGroupMember);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
  });

  it('returns 200 with conversations list', async () => {
    const mockConversations = [
      { id: 1, user_id: 1, type: 'private', target_id: 2, last_message: 'Hi', last_message_time: '2024-01-01', unread_count: 0 },
      { id: 2, user_id: 1, type: 'group', target_id: 10, last_message: 'Hello', last_message_time: '2024-01-02', unread_count: 1 },
    ];

    const mockUsers = [
      { id: 2, nickname: 'UserA', avatar_color: '#3b82f6', status: 'online' },
    ];

    const mockGroups = [
      { id: 10, name: 'GroupA', avatar_color: '#ef4444' },
    ];

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1 && table === 'conversations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: mockConversations, error: null })),
              })),
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
        if (callCount === 3 && table === 'groups') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: mockGroups, error: null })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await conversationsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.conversations)).toBe(true);
    expect(data.conversations.length).toBe(2);
  });

  it('returns 200 with empty conversations list', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await conversationsGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toEqual([]);
  });

  it('returns 401 without token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/conversations');

    const response = await conversationsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 401 with invalid token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/conversations', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const response = await conversationsGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 500 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await conversationsGET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

describe('POST /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
    mockedIsFriend.mockResolvedValue(true);
    mockedIsGroupMember.mockResolvedValue(true);
  });

  it('returns 200 with existing conversation', async () => {
    const existingConv = { id: 1, user_id: 1, type: 'private', target_id: 2, last_message: '', unread_count: 0 };

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: existingConv, error: null })),
              })),
            })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ type: 'private', target_id: 2 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversation).toBeDefined();
    expect(data.conversation.id).toBe(1);
  });

  it('returns 200 when creating new conversation', async () => {
    const newConv = { id: 2, user_id: 1, type: 'private', target_id: 3, last_message: '', unread_count: 0 };

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (callCount === 2) {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: newConv, error: null })),
              })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ type: 'private', target_id: 3 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversation).toBeDefined();
    expect(data.conversation.id).toBe(2);
  });

  it('returns 401 without token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'private', target_id: 2 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 400 on invalid input', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ type: 'invalid', target_id: -1 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 500 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (callCount === 2) {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Insert failed' } })),
              })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ type: 'private', target_id: 3 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });

  it('returns 403 when target is not a friend', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedIsFriend.mockResolvedValue(false);

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ type: 'private', target_id: 999 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('对方不是您的好友');
  });

  it('returns 403 when target group is not joined', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedIsGroupMember.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'X-CSRF-Token': 'valid-csrf-token' },
      body: JSON.stringify({ type: 'group', target_id: 99 }),
    });

    const response = await conversationsPOST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('您不是该群成员');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as verifyGET } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('GET /api/auth/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockReset();
  });

  it('returns 200 with authenticated user', async () => {
    const mockUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      avatar_color: '#3b82f6',
      status: 'online',
      signature: 'Hello',
    };

    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockUser, error: null })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/verify', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await verifyGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.qq_number).toBe('10001');
  });

  it('returns 401 without token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/auth/verify');

    const response = await verifyGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });

  it('returns 401 with invalid token', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/auth/verify', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const response = await verifyGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });

  it('returns 401 when user not found in database', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Not found' } })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/verify', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await verifyGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });

  it('returns 401 on database error', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/verify', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await verifyGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });

  it('returns 401 when token is expired', async () => {
    mockedGetAuthUser.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/auth/verify', {
      headers: { Authorization: 'Bearer expired-token' },
    });

    const response = await verifyGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });
});

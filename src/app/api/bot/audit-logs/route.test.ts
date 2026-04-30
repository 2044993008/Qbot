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

describe('Bot Audit Logs API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = createRequest('http://localhost/api/bot/audit-logs');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns audit logs successfully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const mockLogs = [
      { id: 1, user_id: 1, request: 'hello', response: 'hi', created_at: '2025-01-01T00:00:00Z' },
      { id: 2, user_id: 1, request: 'help', response: 'sure', created_at: '2025-01-02T00:00:00Z' },
    ];
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockLogs, error: null, count: 2 }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/bot/audit-logs?page=1&limit=20');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.logs).toHaveLength(2);
    expect(json.total).toBe(2);
    expect(json.page).toBe(1);
    expect(json.limit).toBe(20);
  });

  it('returns 500 when database query fails', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' }, count: 0 }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/bot/audit-logs');
    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  it('returns empty array when no logs exist', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('http://localhost/api/bot/audit-logs');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.logs).toEqual([]);
    expect(json.total).toBe(0);
  });
});

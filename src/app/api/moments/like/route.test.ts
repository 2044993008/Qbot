import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateCsrfToken } from '@/lib/csrf';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@/lib/auth-utils';

const mockedVerifyToken = vi.mocked(verifyToken);
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
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    count: vi.fn().mockReturnThis(),
    head: vi.fn(() => Promise.resolve({ count: 0, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(finalValue)),
    single: vi.fn(() => Promise.resolve(finalValue)),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    update: vi.fn(() => chain),
  };
  return chain;
}

describe('Moment Like API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = createRequest('POST', 'http://localhost/api/moments/like', { moment_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 403 for invalid CSRF token', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/moments/like', { moment_id: 1 }, { 'X-CSRF-Token': 'invalid' });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns 400 when moment_id is missing', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const request = createRequest('POST', 'http://localhost/api/moments/like', {}, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when moment not found', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const mockSupabase = {
      from: vi.fn(() => createChain({ data: null, error: null })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/moments/like', { moment_id: 1 }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('likes a moment successfully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');

    const mockSupabase = {
      from: vi.fn((table: string) => {
        const chain = createChain({ data: null, error: null });
        if (table === 'moments') {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
          chain.update = vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }));
        }
        if (table === 'moment_likes') {
          chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
          chain.insert = vi.fn().mockResolvedValue({ error: null });
          chain.head = vi.fn().mockResolvedValue({ count: 1, error: null });
        }
        return chain;
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/moments/like', { moment_id: 1 }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.liked).toBe(true);
  });

  it('unlikes a moment successfully', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');

    const mockSupabase = {
      from: vi.fn((table: string) => {
        const chain = createChain({ data: null, error: null });
        if (table === 'moments') {
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 1 }, error: null });
          chain.update = vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }));
        }
        if (table === 'moment_likes') {
          chain.order = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
          chain.delete = vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          });
          chain.head = vi.fn().mockResolvedValue({ count: 0, error: null });
        }
        return chain;
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/moments/like', { moment_id: 1 }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.liked).toBe(false);
  });

  it('returns 500 when database error occurs', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/moments/like', { moment_id: 1 }, { 'X-CSRF-Token': csrfToken });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});

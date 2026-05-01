import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerPOST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(() => Promise.resolve('$2a$12$hashed')) },
}));

vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
  generateToken: vi.fn(() => Promise.resolve('mock-jwt-token')),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: () => () => Promise.resolve({ allowed: true, remaining: 5, resetIn: 60, retryAfter: 0 }),
}));

vi.mock('@/lib/csrf', () => ({
  generateCsrfToken: () => 'test-csrf-token',
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with token and user on valid registration', async () => {
    const mockUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      avatar_color: '#3b82f6',
      signature: '这个人很懒，什么都没写',
      status: 'online',
    };

    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1 && table === 'users') {
          // Check existing user
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          };
        }
        if (callCount === 2 && table === 'users') {
          // Insert user
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockUser, error: null })),
              })),
            })),
          };
        }
        if (callCount === 3 && table === 'users') {
          // Bot user lookup
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 99 }, error: null })),
              })),
            })),
          };
        }
        if (callCount >= 4 && table === 'friends') {
          return {
            insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', nickname: 'TestUser', password: '123456' }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data).not.toHaveProperty('token');
    expect(data).not.toHaveProperty('csrf_token');
    expect(data.user).toBeDefined();
  });

  it('returns 400 on invalid input', async () => {
    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '1', nickname: '', password: '123' }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when qq_number already exists', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 1 }, error: null })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', nickname: 'TestUser', password: '123456' }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('该QQ号已被注册');
  });

  it('returns 500 on database error during user creation', async () => {
    let callCount = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (callCount === 1 && table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          };
        }
        if (callCount === 2 && table === 'users') {
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

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', nickname: 'TestUser', password: '123456' }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });

  it('returns 500 on unexpected error', async () => {
    mockedGetSupabaseClient.mockImplementation(() => {
      throw new Error('Unexpected');
    });

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', nickname: 'TestUser', password: '123456' }),
    });

    const response = await registerPOST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

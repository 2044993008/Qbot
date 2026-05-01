import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginPOST, GET as loginGET } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';

// Mutable rate limit state for edge case testing
let rateLimitAllowed = true;
let rateLimitRetryAfter = 0;

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
  generateToken: vi.fn(() => Promise.resolve('mock-jwt-token')),
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(() => Promise.resolve(true)) },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: () => () => Promise.resolve({
    allowed: rateLimitAllowed,
    remaining: rateLimitAllowed ? 5 : 0,
    resetIn: 60,
    retryAfter: rateLimitRetryAfter,
  }),
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

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReset();
    rateLimitAllowed = true;
    rateLimitRetryAfter = 0;
  });

  it('returns 200 with token and user on valid credentials', async () => {
    const mockUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      password: '$2a$12$testhash',
      avatar_color: '#3b82f6',
      signature: 'Hello',
      status: 'offline',
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: mockUser, error: null })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          };
        }
        return {};
      }),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', password: '123456' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data).not.toHaveProperty('token');
    expect(data).not.toHaveProperty('csrf_token');
    expect(data.user).toBeDefined();
    expect(data.user.qq_number).toBe('10001');
  });

  it('returns 400 on invalid input', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '1', password: '123' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 401 when user does not exist', async () => {
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

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '99999', password: '123456' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('用户不存在');
  });

  it('returns 401 on wrong password', async () => {
    const mockUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      password: '$2a$12$testhash',
      avatar_color: '#3b82f6',
      signature: 'Hello',
      status: 'offline',
    };

    const bcrypt = await import('bcryptjs');
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false as unknown as never);

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

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', password: 'wrongpassword' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('密码错误');
  });

  it('returns 500 on database error', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB connection failed' } })),
          })),
        })),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', password: '123456' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });

  it('returns 429 when rate limit exceeded', async () => {
    rateLimitAllowed = false;
    rateLimitRetryAfter = 60;

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001', password: '123456' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('请求过于频繁');
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('returns 400 on empty request body', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: '',
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('无效的请求格式');
  });

  it('returns 400 when required fields are missing', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number: '10001' }),
    });

    const response = await loginPOST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe('GET /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyToken.mockReset();
  });

  it('returns 200 with authenticated user', async () => {
    const mockUser = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      avatar_color: '#3b82f6',
      signature: 'Hello',
      status: 'online',
      last_seen: new Date().toISOString(),
    };

    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

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

    const request = new NextRequest('http://localhost/api/auth/login', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await loginGET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(data.user).toBeDefined();
  });

  it('returns 401 with invalid token', async () => {
    mockedVerifyToken.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/auth/login', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    const response = await loginGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });

  it('returns 401 when user not found', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });

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

    const request = new NextRequest('http://localhost/api/auth/login', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await loginGET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.authenticated).toBe(false);
  });

  it('returns 500 on unexpected error', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedGetSupabaseClient.mockImplementation(() => {
      throw new Error('Unexpected');
    });

    const request = new NextRequest('http://localhost/api/auth/login', {
      headers: { Authorization: 'Bearer valid-token' },
    });

    const response = await loginGET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

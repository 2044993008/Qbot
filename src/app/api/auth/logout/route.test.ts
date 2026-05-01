import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as logoutPOST } from './route';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth-utils';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  extractCsrfToken: vi.fn(),
  verifyCsrfToken: vi.fn(),
}));

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with success on logout', async () => {
    vi.mocked(getAuthUser).mockReturnValue({ userId: 1, qqNumber: '10001' });
    vi.mocked(extractCsrfToken).mockReturnValue('valid-csrf');
    vi.mocked(verifyCsrfToken).mockReturnValue(true);

    const mockDelete = vi.fn();
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: mockDelete,
    } as unknown as ReturnType<typeof cookies>);

    const request = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('qq_token');
  });

  it('returns 500 on cookie error', async () => {
    vi.mocked(getAuthUser).mockReturnValue({ userId: 1, qqNumber: '10001' });
    vi.mocked(extractCsrfToken).mockReturnValue('valid-csrf');
    vi.mocked(verifyCsrfToken).mockReturnValue(true);

    vi.mocked(cookies).mockImplementation(() => {
      throw new Error('Cookie error');
    });

    const request = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });

  it('returns 401 without valid auth token', async () => {
    vi.mocked(getAuthUser).mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('returns 403 without valid CSRF token', async () => {
    vi.mocked(getAuthUser).mockReturnValue({ userId: 1, qqNumber: '10001' });
    vi.mocked(extractCsrfToken).mockReturnValue(null);
    vi.mocked(verifyCsrfToken).mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await logoutPOST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('CSRF验证失败');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';
import { verifyTokenString } from '@/lib/auth-utils';

vi.mock('@/lib/auth-utils', () => ({
  verifyTokenString: vi.fn(),
}));

const mockedVerifyTokenString = vi.mocked(verifyTokenString);
const mockedNext = vi.spyOn(NextResponse, 'next');

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedVerifyTokenString.mockReset();
    mockedNext.mockClear();
  });

  it('returns 401 when no token is provided', async () => {
    const request = new NextRequest('http://localhost/api/user');

    const response = await middleware(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('未登录');
    expect(data.code).toBe('UNAUTHORIZED');
    expect(mockedVerifyTokenString).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', async () => {
    mockedVerifyTokenString.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Cookie: 'qq_token=expired-token' },
    });

    const response = await middleware(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('未登录');
    expect(data.code).toBe('UNAUTHORIZED');
    expect(mockedVerifyTokenString).toHaveBeenCalledWith('expired-token');
  });

  it('returns 401 when token is malformed', async () => {
    mockedVerifyTokenString.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Authorization: 'Bearer malformed-token' },
    });

    const response = await middleware(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('未登录');
    expect(data.code).toBe('UNAUTHORIZED');
    expect(mockedVerifyTokenString).toHaveBeenCalledWith('malformed-token');
  });

  it('calls NextResponse.next with user headers when token is valid', async () => {
    mockedVerifyTokenString.mockResolvedValue({ userId: 1, qqNumber: '10001' });

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Cookie: 'qq_token=valid-token' },
    });

    await middleware(request);

    expect(mockedVerifyTokenString).toHaveBeenCalledWith('valid-token');
    expect(mockedNext).toHaveBeenCalledTimes(1);

    const callArg = mockedNext.mock.calls[0][0];
    const injectedHeaders = callArg?.request?.headers as Headers;
    expect(injectedHeaders?.get('x-user-id')).toBe('1');
    expect(injectedHeaders?.get('x-qq-number')).toBe('10001');
  });

  it('also works with Authorization header', async () => {
    mockedVerifyTokenString.mockResolvedValue({ userId: 2, qqNumber: '10002' });

    const request = new NextRequest('http://localhost/api/user', {
      headers: { Authorization: 'Bearer valid-bearer-token' },
    });

    await middleware(request);

    expect(mockedVerifyTokenString).toHaveBeenCalledWith('valid-bearer-token');
    expect(mockedNext).toHaveBeenCalledTimes(1);

    const callArg = mockedNext.mock.calls[0][0];
    const injectedHeaders = callArg?.request?.headers as Headers;
    expect(injectedHeaders?.get('x-user-id')).toBe('2');
    expect(injectedHeaders?.get('x-qq-number')).toBe('10002');
  });
});

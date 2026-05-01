import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from './route';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  extractCsrfToken: vi.fn(),
  verifyCsrfToken: vi.fn(),
}));

// Mock seed module
vi.mock('@/server/db/seed', () => ({
  POST: vi.fn(),
}));

import { getAuthUser } from '@/lib/auth-utils';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';
import { POST as seedPost } from '@/server/db/seed';

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedSeedPost = vi.mocked(seedPost);
const mockedExtractCsrfToken = vi.mocked(extractCsrfToken);
const mockedVerifyCsrfToken = vi.mocked(verifyCsrfToken);

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

describe('Seed API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExtractCsrfToken.mockReturnValue('valid-csrf');
    mockedVerifyCsrfToken.mockReturnValue(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetAuthUser.mockReturnValue(null);
    const request = createRequest('POST', 'http://localhost/api/seed');
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns success when seed completes', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedSeedPost.mockResolvedValue(NextResponse.json({ success: true as boolean, message: 'Seed completed' }, { status: 200 }) as any);

    const request = createRequest('POST', 'http://localhost/api/seed');
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 when seed fails', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    mockedSeedPost.mockResolvedValue(NextResponse.json({ success: false as boolean, error: 'Seed failed' }, { status: 500 }) as any);

    const request = createRequest('POST', 'http://localhost/api/seed');
    const response = await POST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
  });
});

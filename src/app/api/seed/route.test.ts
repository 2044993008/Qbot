import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  verifyToken: vi.fn(),
}));

// Mock seed module
vi.mock('@/server/db/seed', () => ({
  POST: vi.fn(),
}));

import { verifyToken } from '@/lib/auth-utils';
import { POST as seedPost } from '@/server/db/seed';

const mockedVerifyToken = vi.mocked(verifyToken);
const mockedSeedPost = vi.mocked(seedPost);

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
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = createRequest('POST', 'http://localhost/api/seed');
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns success when seed completes', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedSeedPost.mockResolvedValue(new Response(JSON.stringify({ success: true, message: 'Seed completed' }), { status: 200 }));

    const request = createRequest('POST', 'http://localhost/api/seed');
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('returns 500 when seed fails', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    mockedSeedPost.mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Seed failed' }), { status: 500 }));

    const request = createRequest('POST', 'http://localhost/api/seed');
    const response = await POST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.success).toBe(false);
  });
});

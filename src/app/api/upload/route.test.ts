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

describe('Upload API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAYWRIGHT_SKIP_RATE_LIMIT = 'true';
  });

  it('returns 401 when not authenticated', async () => {
    mockedVerifyToken.mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: new FormData(),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 403 for invalid CSRF token', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const formData = new FormData();
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'invalid' },
      body: formData,
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns 400 when no file is provided', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const formData = new FormData();
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    // Override formData to return empty form
    Object.defineProperty(request, 'formData', {
      value: vi.fn().mockResolvedValue(formData),
      writable: true,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for unsupported file type', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const formData = new FormData();
    formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }));
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    Object.defineProperty(request, 'formData', {
      value: vi.fn().mockResolvedValue(formData),
      writable: true,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when file is too large', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const formData = new FormData();
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    formData.append('file', largeFile);
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    Object.defineProperty(request, 'formData', {
      value: vi.fn().mockResolvedValue(formData),
      writable: true,
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('uploads file successfully to Supabase Storage', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const mockSupabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: { path: 'test.jpg' }, error: null }),
          getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/image.jpg' } }),
        })),
      },
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const formData = new FormData();
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    formData.append('file', file);
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    Object.defineProperty(request, 'formData', {
      value: vi.fn().mockResolvedValue(formData),
      writable: true,
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.url).toBe('https://test.com/image.jpg');
    expect(json.filename).toBeDefined();
  });

  it('returns fake URL when Supabase upload fails', async () => {
    mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
    const csrfToken = generateCsrfToken('1');
    const mockSupabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Upload failed' } }),
        })),
      },
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const formData = new FormData();
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    formData.append('file', file);
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    Object.defineProperty(request, 'formData', {
      value: vi.fn().mockResolvedValue(formData),
      writable: true,
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.url).toContain('picsum.photos');
    expect(json.message).toContain('演示模式');
  });
});

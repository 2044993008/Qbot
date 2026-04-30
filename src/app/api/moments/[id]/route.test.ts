import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from './route';
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

describe('Moment Detail API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT /api/moments/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockedVerifyToken.mockResolvedValue(null);
      const request = createRequest('PUT', 'http://localhost/api/moments/1', { content: 'updated' });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid moment ID', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('PUT', 'http://localhost/api/moments/invalid', { content: 'updated' });
      const response = await PUT(request, { params: Promise.resolve({ id: 'invalid' }) });
      expect(response.status).toBe(400);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('PUT', 'http://localhost/api/moments/1', { content: 'updated' }, { 'X-CSRF-Token': 'invalid' });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(403);
    });

    it('returns 404 when moment not found', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/moments/1', { content: 'updated' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(404);
    });

    it('returns 403 when user does not own the moment', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 2 }, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/moments/1', { content: 'updated' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(403);
    });

    it('updates moment successfully', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockMoment = { id: 1, user_id: 1, content: 'updated', images: [], like_count: 2, comment_count: 1, created_at: '2025-01-01T00:00:00Z' };
      const mockUser = { id: 1, nickname: 'User1', avatar_color: '#ff0000' };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 1 }, error: null }),
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
          };
          if (table === 'moments') {
            chain.update.mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockMoment, error: null }),
            });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/moments/1', { content: 'updated' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.moment.content).toBe('updated');
    });
  });

  describe('DELETE /api/moments/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockedVerifyToken.mockResolvedValue(null);
      const request = createRequest('DELETE', 'http://localhost/api/moments/1');
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid moment ID', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('DELETE', 'http://localhost/api/moments/invalid');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid' }) });
      expect(response.status).toBe(400);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('DELETE', 'http://localhost/api/moments/1', undefined, { 'X-CSRF-Token': 'invalid' });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(403);
    });

    it('returns 404 when moment not found', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('DELETE', 'http://localhost/api/moments/1', undefined, { 'X-CSRF-Token': csrfToken });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(404);
    });

    it('deletes moment successfully', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 1 }, error: null }),
          };
          if (table === 'moment_comments' || table === 'moment_likes' || table === 'moments') {
            chain.delete.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('DELETE', 'http://localhost/api/moments/1', undefined, { 'X-CSRF-Token': csrfToken });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('returns 500 when delete fails', async () => {
      mockedVerifyToken.mockResolvedValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 1 }, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('DELETE', 'http://localhost/api/moments/1', undefined, { 'X-CSRF-Token': csrfToken });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(500);
    });
  });
});

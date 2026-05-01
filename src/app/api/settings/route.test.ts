import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { generateCsrfToken } from '@/lib/csrf';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from '@/lib/auth-utils';

const mockedGetAuthUser = vi.mocked(getAuthUser);
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

describe('Settings API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settings', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('GET', 'http://localhost/api/settings');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns single setting by key', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { value: 'dark' }, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/settings?key=theme');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.key).toBe('theme');
      expect(json.value).toBe('dark');
    });

    it('returns all settings when no key provided', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSettings = [
        { key: 'theme', value: 'dark' },
        { key: 'language', value: 'zh' },
      ];
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/settings');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.settings).toHaveLength(2);
    });

    it('returns empty value when setting not found', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/settings?key=nonexistent');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.value).toBe('');
    });

    it('returns 500 on database error', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockRejectedValue(new Error('DB error')),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/settings?key=theme');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/settings', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('PUT', 'http://localhost/api/settings', { key: 'theme', value: 'dark' });
      const response = await PUT(request);
      expect(response.status).toBe(401);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('PUT', 'http://localhost/api/settings', { key: 'theme', value: 'dark' }, { 'X-CSRF-Token': 'invalid' });
      const response = await PUT(request);
      expect(response.status).toBe(403);
    });

    it('returns 400 when key is missing', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const request = createRequest('PUT', 'http://localhost/api/settings', { value: 'dark' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request);
      expect(response.status).toBe(400);
    });

    it('updates existing setting successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSetting = { id: 1, user_id: 1, key: 'theme', value: 'dark', updated_at: '2025-01-01T00:00:00Z' };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
          if (table === 'user_settings') {
            chain.limit.mockReturnValue({
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
            });
            chain.update.mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockSetting, error: null }),
            });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/settings', { key: 'theme', value: 'dark' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.setting).toBeDefined();
    });

    it('creates new setting when not exists', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSetting = { id: 2, user_id: 1, key: 'language', value: 'zh', updated_at: '2025-01-01T00:00:00Z' };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
          if (table === 'user_settings') {
            chain.limit.mockReturnValue({
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            });
            chain.insert.mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockSetting, error: null }),
            });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/settings', { key: 'language', value: 'zh' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('returns 500 when database operation fails', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockRejectedValue(new Error('DB error')),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/settings', { key: 'theme', value: 'dark' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request);
      expect(response.status).toBe(500);
    });
  });
});

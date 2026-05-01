import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from './route';
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

describe('Task Detail API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tasks/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('GET', 'http://localhost/api/tasks/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid task ID', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('GET', 'http://localhost/api/tasks/invalid');
      const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) });
      expect(response.status).toBe(400);
    });

    it('returns 404 when task not found', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/tasks/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(404);
    });

    it('returns 403 when user does not own the task', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 2, name: 'Task' }, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/tasks/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(403);
    });

    it('returns task successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockTask = { id: 1, user_id: 1, name: 'My Task', cron_expression: '0 9 * * *', task_type: 'reminder', enabled: true };
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/tasks/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.task).toBeDefined();
      expect(json.task.name).toBe('My Task');
    });
  });

  describe('PUT /api/tasks/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('PUT', 'http://localhost/api/tasks/1', { name: 'Updated' });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid task ID', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('PUT', 'http://localhost/api/tasks/invalid', { name: 'Updated' });
      const response = await PUT(request, { params: Promise.resolve({ id: 'invalid' }) });
      expect(response.status).toBe(400);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('PUT', 'http://localhost/api/tasks/1', { name: 'Updated' }, { 'X-CSRF-Token': 'invalid' });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(403);
    });

    it('returns 404 when task not found', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/tasks/1', { name: 'Updated' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(404);
    });

    it('returns 400 for invalid cron expression', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { user_id: 1 }, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/tasks/1', { cron_expression: 'invalid' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(400);
    });

    it('updates task successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockTask = { id: 1, user_id: 1, name: 'Updated Task', cron_expression: '0 10 * * *', task_type: 'reminder', enabled: true };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { user_id: 1 }, error: null }),
          };
          if (table === 'scheduled_tasks') {
            chain.update.mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
            });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('PUT', 'http://localhost/api/tasks/1', { name: 'Updated Task' }, { 'X-CSRF-Token': csrfToken });
      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.task.name).toBe('Updated Task');
    });
  });

  describe('DELETE /api/tasks/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('DELETE', 'http://localhost/api/tasks/1');
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid task ID', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('DELETE', 'http://localhost/api/tasks/invalid');
      const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid' }) });
      expect(response.status).toBe(400);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('DELETE', 'http://localhost/api/tasks/1', undefined, { 'X-CSRF-Token': 'invalid' });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(403);
    });

    it('deletes task successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { user_id: 1 }, error: null }),
          };
          if (table === 'scheduled_tasks') {
            chain.delete.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            });
          }
          return chain;
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('DELETE', 'http://localhost/api/tasks/1', undefined, { 'X-CSRF-Token': csrfToken });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('returns 500 when delete fails', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
          }),
          single: vi.fn().mockResolvedValue({ data: { user_id: 1 }, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('DELETE', 'http://localhost/api/tasks/1', undefined, { 'X-CSRF-Token': csrfToken });
      const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
      expect(response.status).toBe(500);
    });
  });
});

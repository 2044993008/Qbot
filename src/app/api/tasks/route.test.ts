import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
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

describe('Tasks API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tasks', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('GET', 'http://localhost/api/tasks');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns tasks list successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockTasks = [
        { id: 1, user_id: 1, name: 'Task 1', cron_expression: '0 9 * * *', task_type: 'reminder', enabled: true },
        { id: 2, user_id: 1, name: 'Task 2', cron_expression: '0 10 * * *', task_type: 'send_message', enabled: false },
      ];
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/tasks');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.tasks).toHaveLength(2);
    });

    it('returns empty array when no tasks', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/tasks');
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.tasks).toEqual([]);
    });

    it('returns 500 on database error', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('GET', 'http://localhost/api/tasks');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/tasks', () => {
    it('returns 401 when not authenticated', async () => {
      mockedGetAuthUser.mockReturnValue(null);
      const request = createRequest('POST', 'http://localhost/api/tasks', {
        name: 'Test Task',
        cron_expression: '0 9 * * *',
        task_type: 'reminder',
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid body', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('POST', 'http://localhost/api/tasks', {
        name: '',
        cron_expression: 'invalid',
        task_type: 'invalid_type',
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns 403 for invalid CSRF token', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const request = createRequest('POST', 'http://localhost/api/tasks', {
        name: 'Test Task',
        cron_expression: '0 9 * * *',
        task_type: 'reminder',
      }, { 'X-CSRF-Token': 'invalid' });
      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid cron expression', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const request = createRequest('POST', 'http://localhost/api/tasks', {
        name: 'Test Task',
        cron_expression: 'invalid_cron',
        task_type: 'reminder',
      }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('creates task successfully', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockTask = {
        id: 1,
        user_id: 1,
        name: 'Morning Reminder',
        description: '',
        cron_expression: '0 9 * * *',
        task_type: 'reminder',
        config: {},
        enabled: true,
        next_run_at: '2025-01-02T09:00:00Z',
      };
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/tasks', {
        name: 'Morning Reminder',
        cron_expression: '0 9 * * *',
        task_type: 'reminder',
      }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.task).toBeDefined();
      expect(json.task.name).toBe('Morning Reminder');
    });

    it('returns 500 when insert fails', async () => {
      mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
      const csrfToken = generateCsrfToken('1');
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = createRequest('POST', 'http://localhost/api/tasks', {
        name: 'Morning Reminder',
        cron_expression: '0 9 * * *',
        task_type: 'reminder',
      }, { 'X-CSRF-Token': csrfToken });
      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getAuthUser: vi.fn(),
}));

// Mock scheduler service
vi.mock('@/services/scheduler', () => ({
  executeTask: vi.fn(),
}));

import { getAuthUser } from '@/lib/auth-utils';
import { executeTask } from '@/services/scheduler';

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);
const mockedExecuteTask = vi.mocked(executeTask);

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

describe('Tasks Run API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetAuthUser.mockReturnValue(null);
    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when task_id is missing', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/tasks/run', {});
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when task_id is not a number', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 'not-a-number' });
    const response = await POST(request);
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

    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('returns 403 when user does not own the task', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, user_id: 2 }, error: null }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('executes task successfully', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockTask = { id: 1, user_id: 1, name: 'Test Task', cron_expression: '0 9 * * *', task_type: 'reminder', config: {}, enabled: true };
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);
    mockedExecuteTask.mockResolvedValue({ success: true, output: 'Task executed' });

    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.result).toBeDefined();
  });

  it('returns 500 when executeTask fails', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockTask = { id: 1, user_id: 1, name: 'Test Task', cron_expression: '0 9 * * *', task_type: 'reminder', config: {}, enabled: true };
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTask, error: null }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);
    mockedExecuteTask.mockRejectedValue(new Error('Execution failed'));

    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Execution failed');
  });

  it('returns 500 when database query fails', async () => {
    mockedGetAuthUser.mockReturnValue({ userId: 1, qqNumber: '10001' });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      })),
    };
    mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

    const request = createRequest('POST', 'http://localhost/api/tasks/run', { task_id: 1 });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});

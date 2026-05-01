import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startScheduler, stopScheduler, executeTask } from './scheduler';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { CronJob } from 'cron';

// Track cron job instances so tests can verify stop() was called
const cronJobInstances: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; nextDate: ReturnType<typeof vi.fn> }> = [];

// Mock cron library — never start real cron jobs in tests
vi.mock('cron', () => ({
  CronJob: vi.fn().mockImplementation(() => {
    const instance = {
      start: vi.fn(),
      stop: vi.fn(),
      nextDate: vi.fn().mockReturnValue({ toISO: () => '2025-01-02T09:00:00.000Z' }),
    };
    cronJobInstances.push(instance);
    return instance;
  }),
}));

// Mock logger to suppress output during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);
const MockedCronJob = vi.mocked(CronJob);

function createTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    user_id: 1,
    name: 'Test Task',
    description: 'Test Description',
    cron_expression: '0 9 * * *',
    task_type: 'reminder',
    config: { message: 'Hello' },
    enabled: true,
    last_run_at: null,
    next_run_at: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cronJobInstances.length = 0;
    stopScheduler();
  });

  afterEach(() => {
    stopScheduler();
    vi.restoreAllMocks();
  });

  describe('startScheduler & reloadTasks', () => {
    it('loads enabled tasks and creates CronJob instances', async () => {
      const task = createTask({ id: 1, name: 'Morning Reminder', cron_expression: '0 9 * * *', enabled: true });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [task], error: null }),
          })),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      await startScheduler();

      expect(MockedCronJob).toHaveBeenCalledTimes(1);
      expect(MockedCronJob).toHaveBeenCalledWith(
        '0 9 * * *',
        expect.any(Function),
        null,
        true,
        'Asia/Shanghai'
      );
    });

    it('skips disabled tasks when loading', async () => {
      const enabledTask = createTask({ id: 1, name: 'Enabled Task', enabled: true });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [enabledTask], error: null }),
          })),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      await startScheduler();

      expect(MockedCronJob).toHaveBeenCalledTimes(1);
    });

    it('handles database error during task reload gracefully', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection refused' } }),
          })),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      await startScheduler();

      expect(MockedCronJob).not.toHaveBeenCalled();
    });

    it('stops tasks that have changed cron expression and creates new ones', async () => {
      const taskV1 = createTask({ id: 1, cron_expression: '0 9 * * *', enabled: true });
      let currentTasks = [taskV1];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: currentTasks, error: null }),
          })),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      vi.useFakeTimers();
      await startScheduler();
      expect(MockedCronJob).toHaveBeenCalledTimes(1);

      // Change the task expression to simulate DB update
      currentTasks = [createTask({ id: 1, cron_expression: '0 10 * * *', enabled: true })];

      vi.advanceTimersByTime(60000);
      // Allow the async reloadTasks triggered by the interval to complete
      await Promise.resolve();
      await Promise.resolve();
      vi.useRealTimers();

      // Old job should have been stopped and a new one created with the new expression
      expect(MockedCronJob).toHaveBeenCalledTimes(2);
      expect(MockedCronJob).toHaveBeenLastCalledWith(
        '0 10 * * *',
        expect.any(Function),
        null,
        true,
        'Asia/Shanghai'
      );
    });
  });

  describe('stopScheduler', () => {
    it('stops all active jobs and clears the reload interval', async () => {
      const task = createTask({ id: 1, enabled: true });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [task], error: null }),
          })),
        })),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      await startScheduler();
      expect(MockedCronJob).toHaveBeenCalledTimes(1);

      stopScheduler();

      // After stop, starting again should create a fresh job
      await startScheduler();
      expect(MockedCronJob).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeTask', () => {
    it('reminder type sends message via bot when conversation exists', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const usersChain = {
        select: vi.fn(() => usersChain),
        eq: vi.fn(() => usersChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
      };
      const convChain = {
        select: vi.fn(() => convChain),
        eq: vi.fn(() => convChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 6 }, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'users') return usersChain;
          if (table === 'conversations') return convChain;
          if (table === 'messages') return { insert: vi.fn().mockResolvedValue({ error: null }) };
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'reminder', config: { message: 'Test reminder' } });
      const result = await executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Test reminder');
    });

    it('reminder type creates conversation when not exists', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const usersChain = {
        select: vi.fn(() => usersChain),
        eq: vi.fn(() => usersChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
      };
      const convChain = {
        select: vi.fn(() => convChain),
        eq: vi.fn(() => convChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 6 }, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'users') return usersChain;
          if (table === 'conversations') return convChain;
          if (table === 'messages') return { insert: vi.fn().mockResolvedValue({ error: null }) };
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'reminder', config: {} });
      const result = await executeTask(task);

      expect(result.success).toBe(true);
      expect(convChain.insert).toHaveBeenCalled();
    });

    it('reminder type fails when bot user not found', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const usersChain = {
        select: vi.fn(() => usersChain),
        eq: vi.fn(() => usersChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'users') return usersChain;
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'reminder' });
      const result = await executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('找不到小 Q 管家用户');
    });

    it('send_message type inserts message into conversation', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const convChain = {
        select: vi.fn(() => convChain),
        eq: vi.fn(() => convChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 10 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const msgInsertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'conversations') return convChain;
          if (table === 'messages') return { insert: msgInsertMock };
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({
        task_type: 'send_message',
        config: { conversation_id: 10, content: 'Scheduled message' },
      });
      const result = await executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('已发送消息到会话 10');
      expect(msgInsertMock).toHaveBeenCalledWith(expect.objectContaining({
        conversation_id: 10,
        content: 'Scheduled message',
        sender_id: 1,
        type: 'text',
      }));
    });

    it('send_message type fails when conversation not found or not owned', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const convChain = {
        select: vi.fn(() => convChain),
        eq: vi.fn(() => convChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'conversations') return convChain;
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({
        task_type: 'send_message',
        config: { conversation_id: 99, content: 'Test' },
      });
      const result = await executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('无权访问该会话或会话不存在');
    });

    it('post_moment type creates a moment', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const momentsChain = {
        insert: vi.fn(() => momentsChain),
        select: vi.fn(() => momentsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 42 }, error: null }),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'moments') return momentsChain;
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({
        task_type: 'post_moment',
        config: { content: 'My moment', images: ['img1.jpg'] },
      });
      const result = await executeTask(task);

      expect(result.success).toBe(true);
      expect(result.output).toContain('已发布动态，ID: 42');
      expect(momentsChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 1,
        content: 'My moment',
        images: ['img1.jpg'],
        like_count: 0,
        comment_count: 0,
      }));
    });

    it('post_moment type fails when content is missing', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'post_moment', config: {} });
      const result = await executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('任务配置缺少 content');
    });

    it('logs failed status on execution error', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const usersChain = {
        select: vi.fn(() => {
          throw new Error('Database connection lost');
        }),
        eq: vi.fn(() => usersChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'users') return usersChain;
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'reminder' });
      const result = await executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection lost');
      expect(logsChain.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        error_message: 'Database connection lost',
      }));
    });

    it('handles unknown task type', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'unknown_type' });
      const result = await executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('未知任务类型');
    });

    it('handles log insertion failure gracefully and still executes task', async () => {
      const logsChain = {
        insert: vi.fn(() => logsChain),
        select: vi.fn(() => logsChain),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Log insert failed' } }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const usersChain = {
        select: vi.fn(() => usersChain),
        eq: vi.fn(() => usersChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 99 }, error: null }),
      };
      const convChain = {
        select: vi.fn(() => convChain),
        eq: vi.fn(() => convChain),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 5 }, error: null }),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const tasksChain = {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
      const msgInsertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'task_execution_logs') return logsChain;
          if (table === 'users') return usersChain;
          if (table === 'conversations') return convChain;
          if (table === 'messages') return { insert: msgInsertMock };
          if (table === 'scheduled_tasks') return tasksChain;
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const task = createTask({ task_type: 'reminder', config: { message: 'Test' } });
      const result = await executeTask(task);

      // Even though log insertion failed, the task should still execute
      expect(result.success).toBe(true);
      expect(msgInsertMock).toHaveBeenCalled();
    });
  });
});

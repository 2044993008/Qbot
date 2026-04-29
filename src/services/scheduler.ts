import { CronJob } from 'cron';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface ScheduledTask {
  id: number;
  user_id: number;
  name: string;
  description: string;
  cron_expression: string;
  task_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

const activeJobs = new Map<number, { job: CronJob; expression: string }>();
let reloadInterval: NodeJS.Timeout | null = null;

export async function startScheduler() {
  console.log('[Scheduler] Starting scheduled task system...');
  await reloadTasks();

  if (!reloadInterval) {
    reloadInterval = setInterval(() => {
      reloadTasks().catch((err) => {
        console.error('[Scheduler] Periodic reload failed:', err);
      });
    }, 60000);
  }

  console.log('[Scheduler] Started successfully');
}

export function stopScheduler() {
  if (reloadInterval) {
    clearInterval(reloadInterval);
    reloadInterval = null;
  }
  for (const { job } of activeJobs.values()) {
    job.stop();
  }
  activeJobs.clear();
  console.log('[Scheduler] Stopped');
}

async function reloadTasks() {
  const client = getSupabaseClient();
  const { data: tasks, error } = await client
    .from('scheduled_tasks')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('[Scheduler] Failed to load tasks:', error.message);
    return;
  }

  const taskMap = new Map<number, ScheduledTask>();
  for (const task of (tasks || []) as ScheduledTask[]) {
    taskMap.set(task.id, task);
  }

  // 停止已不存在或表达式已改变的任务
  for (const [id, { job, expression }] of activeJobs) {
    const task = taskMap.get(id);
    if (!task || task.cron_expression !== expression) {
      job.stop();
      activeJobs.delete(id);
    }
  }

  // 启动新任务
  for (const task of taskMap.values()) {
    if (activeJobs.has(task.id)) continue;

    try {
      const job = new CronJob(
        task.cron_expression,
        async () => {
          await executeTask(task);
        },
        null,
        true,
        'Asia/Shanghai'
      );
      activeJobs.set(task.id, { job, expression: task.cron_expression });
    } catch (err) {
      console.error(`[Scheduler] Failed to create cron job for task ${task.id}:`, err);
    }
  }
}

export async function executeTask(task: ScheduledTask | Record<string, unknown>): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  const t = task as ScheduledTask;
  const client = getSupabaseClient();
  const startedAt = new Date().toISOString();

  // 插入执行日志（running 状态）
  const { data: logEntry, error: logError } = await client
    .from('task_execution_logs')
    .insert({
      task_id: t.id,
      status: 'running',
      started_at: startedAt,
    })
    .select('id')
    .single();

  if (logError) {
    console.error(`[Scheduler] Failed to create execution log for task ${t.id}:`, logError.message);
  }

  const logId = logEntry?.id;
  let result: { success: boolean; output?: string; error?: string } = { success: false };

  try {
    switch (t.task_type) {
      case 'reminder': {
        result = await executeReminder(client, t);
        break;
      }
      case 'send_message': {
        result = await executeSendMessage(client, t);
        break;
      }
      case 'post_moment': {
        result = await executePostMoment(client, t);
        break;
      }
      default: {
        throw new Error(`未知任务类型: ${t.task_type}`);
      }
    }

    // 更新日志为成功
    if (logId) {
      await client
        .from('task_execution_logs')
        .update({
          status: 'success',
          output: result.output || '',
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Scheduler] Task ${t.id} execution failed:`, errorMessage);
    result = { success: false, error: errorMessage };

    // 更新日志为失败
    if (logId) {
      await client
        .from('task_execution_logs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);
    }
  }

  // 更新任务的 last_run_at 和 next_run_at
  try {
    const tempJob = new CronJob(t.cron_expression, () => {}, null, false, 'Asia/Shanghai');
    const nextRun = tempJob.nextDate();
    tempJob.stop();
    await client
      .from('scheduled_tasks')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun ? nextRun.toISO() : null,
      })
      .eq('id', t.id);
  } catch (err) {
    console.error(`[Scheduler] Failed to update task ${t.id} timestamps:`, err);
  }

  return result;
}

async function executeReminder(
  client: ReturnType<typeof getSupabaseClient>,
  task: ScheduledTask
): Promise<{ success: boolean; output?: string; error?: string }> {
  // 查找小 Q 管家用户
  const { data: botUser } = await client
    .from('users')
    .select('id')
    .eq('nickname', '小 Q 管家')
    .maybeSingle();

  if (!botUser) {
    return { success: false, error: '找不到小 Q 管家用户' };
  }

  // 查找用户与管家的私聊会话
  const { data: conversation } = await client
    .from('conversations')
    .select('id')
    .eq('user_id', task.user_id)
    .eq('type', 'private')
    .eq('target_id', botUser.id)
    .maybeSingle();

  let conversationId = conversation?.id;

  // 如果没有会话，创建一个
  if (!conversationId) {
    const { data: newConv, error: convError } = await client
      .from('conversations')
      .insert({
        type: 'private',
        user_id: task.user_id,
        target_id: botUser.id,
        last_message: '',
        unread_count: 0,
      })
      .select('id')
      .single();

    if (convError || !newConv) {
      return { success: false, error: '创建会话失败' };
    }
    conversationId = newConv.id;
  }

  const reminderContent = (task.config as Record<string, unknown>)?.message as string
    || task.description
    || '⏰ 提醒时间到了！';

  const { error: msgError } = await client.from('messages').insert({
    conversation_id: conversationId,
    sender_id: botUser.id,
    content: `🔔 定时提醒：${reminderContent}`,
    type: 'text',
  });

  if (msgError) {
    return { success: false, error: `发送提醒失败: ${msgError.message}` };
  }

  // 更新会话时间
  await client
    .from('conversations')
    .update({ last_message_time: new Date().toISOString() })
    .eq('id', conversationId);

  return { success: true, output: `已发送提醒: ${reminderContent}` };
}

async function executeSendMessage(
  client: ReturnType<typeof getSupabaseClient>,
  task: ScheduledTask
): Promise<{ success: boolean; output?: string; error?: string }> {
  const config = task.config as Record<string, unknown>;
  const conversationId = config.conversation_id as number;
  const content = config.content as string;

  if (!conversationId || !content) {
    return { success: false, error: '任务配置缺少 conversation_id 或 content' };
  }

  // 验证会话所有权
  const { data: conv } = await client
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', task.user_id)
    .maybeSingle();

  if (!conv) {
    return { success: false, error: '无权访问该会话或会话不存在' };
  }

  const { error: msgError } = await client.from('messages').insert({
    conversation_id: conversationId,
    sender_id: task.user_id,
    content,
    type: 'text',
  });

  if (msgError) {
    return { success: false, error: `发送消息失败: ${msgError.message}` };
  }

  await client
    .from('conversations')
    .update({ last_message_time: new Date().toISOString() })
    .eq('id', conversationId);

  return { success: true, output: `已发送消息到会话 ${conversationId}` };
}

async function executePostMoment(
  client: ReturnType<typeof getSupabaseClient>,
  task: ScheduledTask
): Promise<{ success: boolean; output?: string; error?: string }> {
  const config = task.config as Record<string, unknown>;
  const content = config.content as string;
  const images = (config.images as string[]) || [];

  if (!content) {
    return { success: false, error: '任务配置缺少 content' };
  }

  const { data: moment, error } = await client
    .from('moments')
    .insert({
      user_id: task.user_id,
      content,
      images,
      like_count: 0,
      comment_count: 0,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: `发布动态失败: ${error.message}` };
  }

  return { success: true, output: `已发布动态，ID: ${moment.id}` };
}

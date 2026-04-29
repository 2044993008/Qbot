import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';
import { validateBody, createTaskSchema } from '@/lib/validation';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';
import { CronJob } from 'cron';

// GET - 获取当前用户的定时任务列表
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient();
    const { data: tasks, error } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', payload.userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询任务失败: ${error.message}`);

    return NextResponse.json({ tasks: tasks || [] });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST - 创建定时任务
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const validated = await validateBody(request, createTaskSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const { name, description, cron_expression, task_type, config, enabled } = validated.data;

    // 验证 cron 表达式是否有效，并计算下次执行时间
    let nextRunAt: string | null = null;
    try {
      const job = new CronJob(cron_expression, () => {});
      const nextRun = job.nextDate();
      nextRunAt = nextRun ? nextRun.toISO() : null;
      job.stop();
    } catch {
      return NextResponse.json({ error: '无效的 cron 表达式' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data: task, error } = await client
      .from('scheduled_tasks')
      .insert({
        user_id: payload.userId,
        name,
        description: description || '',
        cron_expression,
        task_type,
        config: config || {},
        enabled: enabled !== false,
        next_run_at: nextRunAt,
      })
      .select()
      .single();

    if (error) throw new Error(`创建任务失败: ${error.message}`);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('创建定时任务失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

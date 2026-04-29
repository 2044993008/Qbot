import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';
import { CronJob } from 'cron';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - 获取单个定时任务
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = parseInt(resolvedParams.id);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data: task, error } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) throw new Error(`查询任务失败: ${error.message}`);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 验证所有权
    if (task.user_id !== payload.userId) {
      return NextResponse.json({ error: '无权访问此任务' }, { status: 403 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT - 更新定时任务
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = parseInt(resolvedParams.id);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const client = getSupabaseClient();

    // 先查询并验证所有权
    const { data: existing, error: queryError } = await client
      .from('scheduled_tasks')
      .select('user_id')
      .eq('id', taskId)
      .single();

    if (queryError) throw new Error(`查询任务失败: ${queryError.message}`);
    if (!existing) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    if (existing.user_id !== payload.userId) {
      return NextResponse.json({ error: '无权修改此任务' }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.cron_expression !== undefined) {
      // 验证 cron 表达式，并重新计算下次执行时间
      try {
        const job = new CronJob(body.cron_expression, () => {});
        const nextRun = job.nextDate();
        updateData.next_run_at = nextRun ? nextRun.toISO() : null;
        job.stop();
      } catch {
        return NextResponse.json({ error: '无效的 cron 表达式' }, { status: 400 });
      }
      updateData.cron_expression = body.cron_expression;
    }
    if (body.task_type !== undefined) updateData.task_type = body.task_type;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    const { data: task, error } = await client
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw new Error(`更新任务失败: ${error.message}`);

    return NextResponse.json({ task });
  } catch (error) {
    console.error('更新定时任务失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE - 删除定时任务
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const taskId = parseInt(resolvedParams.id);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const client = getSupabaseClient();

    // 先查询并验证所有权
    const { data: existing, error: queryError } = await client
      .from('scheduled_tasks')
      .select('user_id')
      .eq('id', taskId)
      .single();

    if (queryError) throw new Error(`查询任务失败: ${queryError.message}`);
    if (!existing) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    if (existing.user_id !== payload.userId) {
      return NextResponse.json({ error: '无权删除此任务' }, { status: 403 });
    }

    const { error } = await client
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw new Error(`删除任务失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除定时任务失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

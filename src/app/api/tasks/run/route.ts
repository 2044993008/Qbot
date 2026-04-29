import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';
import { executeTask } from '@/services/scheduler';

// POST - 手动触发执行定时任务
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const taskId = body.task_id;

    if (!taskId || typeof taskId !== 'number') {
      return NextResponse.json({ error: '缺少 task_id 参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 查询任务并验证所有权
    const { data: task, error } = await client
      .from('scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) throw new Error(`查询任务失败: ${error.message}`);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    if (task.user_id !== payload.userId) {
      return NextResponse.json({ error: '无权执行此任务' }, { status: 403 });
    }

    // 执行任务
    const result = await executeTask(task);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('手动执行任务失败:', error);
    const message = error instanceof Error ? error.message : '执行失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

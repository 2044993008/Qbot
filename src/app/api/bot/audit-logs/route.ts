import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';

// GET - 获取当前用户的 Bot 审计日志列表（分页）
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const client = getSupabaseClient();
    const { data: logs, error, count } = await client
      .from('bot_audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', payload.userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`查询审计日志失败: ${error.message}`);

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

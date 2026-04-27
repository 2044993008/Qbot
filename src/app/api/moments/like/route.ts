import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';


// POST - 点赞/取消点赞
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { moment_id } = await request.json();
    
    if (!moment_id) {
      return NextResponse.json({ error: '缺少动态ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 检查是否已点赞
    const { data: existing } = await client
      .from('moment_likes')
      .select('id')
      .eq('moment_id', moment_id)
      .eq('user_id', payload.userId)
      .maybeSingle();

    if (existing) {
      // 取消点赞
      await client
        .from('moment_likes')
        .delete()
        .eq('id', existing.id);

      // 获取当前点赞数
      const { data: moment } = await client
        .from('moments')
        .select('like_count')
        .eq('id', moment_id)
        .single();
      
      const newCount = Math.max(0, (moment?.like_count || 1) - 1);
      await client
        .from('moments')
        .update({ like_count: newCount })
        .eq('id', moment_id);

      return NextResponse.json({ liked: false });
    } else {
      // 添加点赞
      await client
        .from('moment_likes')
        .insert({
          moment_id,
          user_id: payload.userId,
        });

      // 获取当前点赞数
      const { data: moment } = await client
        .from('moments')
        .select('like_count')
        .eq('id', moment_id)
        .single();
      
      const newCount = (moment?.like_count || 0) + 1;
      await client
        .from('moments')
        .update({ like_count: newCount })
        .eq('id', moment_id);

      return NextResponse.json({ liked: true });
    }
  } catch (err) {
    console.error('点赞操作错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

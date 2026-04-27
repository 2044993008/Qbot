import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';


// POST - 评论动态
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { moment_id, content } = await request.json();
    
    if (!moment_id || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 添加评论
    const { data: comment, error } = await client
      .from('moment_comments')
      .insert({
        moment_id,
        user_id: payload.userId,
        content,
      })
      .select('id, moment_id, user_id, content, created_at')
      .single();

    if (error) throw new Error(`添加评论失败: ${error.message}`);

    // 更新评论数
    const { data: moment } = await client
      .from('moments')
      .select('comment_count')
      .eq('id', moment_id)
      .single();
    
    const newCount = (moment?.comment_count || 0) + 1;
    await client
      .from('moments')
      .update({ comment_count: newCount })
      .eq('id', moment_id);

    // 获取评论者信息
    const { data: commenter } = await client
      .from('users')
      .select('id, nickname, avatar_color')
      .eq('id', payload.userId)
      .single();

    return NextResponse.json({
      comment: {
        ...comment,
        user_nickname: commenter?.nickname || '未知',
        user_avatar: commenter?.avatar_color || '#666',
      }
    });
  } catch (err) {
    console.error('评论动态错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

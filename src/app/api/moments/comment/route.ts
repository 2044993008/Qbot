import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';

async function getMomentCommentCount(client: ReturnType<typeof getSupabaseClient>, momentId: number): Promise<number> {
  const { count, error } = await client
    .from('moment_comments')
    .select('*', { count: 'exact', head: true })
    .eq('moment_id', momentId);

  if (error) {
    throw new Error(`统计评论数失败: ${error.message}`);
  }

  return count || 0;
}


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

    const { data: moment, error: momentError } = await client
      .from('moments')
      .select('id')
      .eq('id', moment_id)
      .maybeSingle();

    if (momentError) {
      throw new Error(`查询动态失败: ${momentError.message}`);
    }

    if (!moment) {
      return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    }

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

    const commentCount = await getMomentCommentCount(client, moment_id);
    const { error: updateError } = await client
      .from('moments')
      .update({ comment_count: commentCount })
      .eq('id', moment_id);

    if (updateError) {
      throw new Error(`更新评论数失败: ${updateError.message}`);
    }

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

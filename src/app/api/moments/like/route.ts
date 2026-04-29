import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';

async function getMomentLikeCount(client: ReturnType<typeof getSupabaseClient>, momentId: number): Promise<number> {
  const { count, error } = await client
    .from('moment_likes')
    .select('*', { count: 'exact', head: true })
    .eq('moment_id', momentId);

  if (error) {
    throw new Error(`统计点赞数失败: ${error.message}`);
  }

  return count || 0;
}


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

    // 检查是否已点赞
    const { data: existingLikes, error: likeQueryError } = await client
      .from('moment_likes')
      .select('id')
      .eq('moment_id', moment_id)
      .eq('user_id', payload.userId)
      .order('id', { ascending: true });

    if (likeQueryError) {
      throw new Error(`查询点赞记录失败: ${likeQueryError.message}`);
    }

    const existingLikeIds = (existingLikes || []).map((like) => like.id);

    if (existingLikeIds.length > 0) {
      // 取消点赞
      const { error: deleteError } = await client
        .from('moment_likes')
        .delete()
        .in('id', existingLikeIds);

      if (deleteError) {
        throw new Error(`取消点赞失败: ${deleteError.message}`);
      }

      const likeCount = await getMomentLikeCount(client, moment_id);
      const { error: updateError } = await client
        .from('moments')
        .update({ like_count: likeCount })
        .eq('id', moment_id);

      if (updateError) {
        throw new Error(`更新点赞数失败: ${updateError.message}`);
      }

      return NextResponse.json({ liked: false });
    } else {
      // 添加点赞
      const { error: insertError } = await client
        .from('moment_likes')
        .insert({
          moment_id,
          user_id: payload.userId,
        });

      if (insertError) {
        throw new Error(`添加点赞失败: ${insertError.message}`);
      }

      const likeCount = await getMomentLikeCount(client, moment_id);
      const { error: updateError } = await client
        .from('moments')
        .update({ like_count: likeCount })
        .eq('id', moment_id);

      if (updateError) {
        throw new Error(`更新点赞数失败: ${updateError.message}`);
      }

      return NextResponse.json({ liked: true });
    }
  } catch (err) {
    console.error('点赞操作错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

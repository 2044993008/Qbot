import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - 编辑动态
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const momentId = parseInt(resolvedParams.id);

    if (!momentId || isNaN(momentId)) {
      return NextResponse.json({ error: '缺少动态ID' }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const { content, images } = await request.json();

    const client = getSupabaseClient();

    // 查询动态
    const { data: moment, error: momentError } = await client
      .from('moments')
      .select('id, user_id')
      .eq('id', momentId)
      .maybeSingle();

    if (momentError) {
      throw new Error(`查询动态失败: ${momentError.message}`);
    }

    if (!moment) {
      return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    }

    // 验证所有权
    if (moment.user_id !== payload.userId) {
      return NextResponse.json({ error: '无权编辑此动态' }, { status: 403 });
    }

    // 更新动态
    // 注意: 如果数据库中还没有 updated_at 列，请先通过迁移添加该列
    const updateData: Record<string, unknown> = {};
    if (content !== undefined) updateData.content = content;
    if (images !== undefined) updateData.images = images;
    updateData.updated_at = new Date().toISOString();

    const { data: updatedMoment, error: updateError } = await client
      .from('moments')
      .update(updateData)
      .eq('id', momentId)
      .select('id, user_id, content, images, like_count, comment_count, created_at')
      .single();

    if (updateError) {
      throw new Error(`更新动态失败: ${updateError.message}`);
    }

    // 获取发布者信息
    const { data: publisher } = await client
      .from('users')
      .select('id, nickname, avatar_color')
      .eq('id', payload.userId)
      .single();

    return NextResponse.json({
      moment: {
        ...updatedMoment,
        publisher_nickname: publisher?.nickname || '未知',
        publisher_avatar: publisher?.avatar_color || '#666',
        comments: [],
        is_liked: false,
      }
    });
  } catch (err) {
    console.error('编辑动态错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE - 删除动态
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const momentId = parseInt(resolvedParams.id);

    if (!momentId || isNaN(momentId)) {
      return NextResponse.json({ error: '缺少动态ID' }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const client = getSupabaseClient();

    // 查询动态
    const { data: moment, error: momentError } = await client
      .from('moments')
      .select('id, user_id')
      .eq('id', momentId)
      .maybeSingle();

    if (momentError) {
      throw new Error(`查询动态失败: ${momentError.message}`);
    }

    if (!moment) {
      return NextResponse.json({ error: '动态不存在' }, { status: 404 });
    }

    // 验证所有权
    if (moment.user_id !== payload.userId) {
      return NextResponse.json({ error: '无权删除此动态' }, { status: 403 });
    }

    // 级联删除评论
    const { error: deleteCommentsError } = await client
      .from('moment_comments')
      .delete()
      .eq('moment_id', momentId);

    if (deleteCommentsError) {
      throw new Error(`删除评论失败: ${deleteCommentsError.message}`);
    }

    // 级联删除点赞
    const { error: deleteLikesError } = await client
      .from('moment_likes')
      .delete()
      .eq('moment_id', momentId);

    if (deleteLikesError) {
      throw new Error(`删除点赞失败: ${deleteLikesError.message}`);
    }

    // 删除动态
    const { error: deleteMomentError } = await client
      .from('moments')
      .delete()
      .eq('id', momentId);

    if (deleteMomentError) {
      throw new Error(`删除动态失败: ${deleteMomentError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('删除动态错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

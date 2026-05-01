import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { validateBody, publishMomentSchema } from '@/lib/validation';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';


// GET - 获取动态列表
export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const client = getSupabaseClient();
    
    // 构建查询
    let query = client
      .from('moments')
      .select('id, user_id, content, images, like_count, comment_count, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user_id) {
      query = query.eq('user_id', parseInt(user_id));
    }

    const { data: moments, error } = await query;

    if (error) throw new Error(`查询动态失败: ${error.message}`);

    if (!moments || moments.length === 0) {
      return NextResponse.json({ moments: [] });
    }

    // 获取发布者信息
    const publisherIds = [...new Set(moments.map(m => m.user_id))];
    const { data: publishers } = await client
      .from('users')
      .select('id, nickname, avatar_color')
      .in('id', publisherIds);

    // 获取评论
    const momentIds = moments.map(m => m.id);
    const { data: comments } = await client
      .from('moment_comments')
      .select('id, moment_id, user_id, content, created_at')
      .in('moment_id', momentIds)
      .order('created_at', { ascending: true });

    // 获取评论者信息
    const commenterIds = [...new Set((comments || []).map(c => c.user_id))];
    const { data: commenters } = await client
      .from('users')
      .select('id, nickname, avatar_color')
      .in('id', commenterIds);

    // 检查当前用户是否点赞
    const { data: likes } = await client
      .from('moment_likes')
      .select('moment_id')
      .eq('user_id', payload.userId)
      .in('moment_id', momentIds);

    const likedSet = new Set(likes?.map(l => l.moment_id) || []);

    // 合并数据
    const momentsWithDetails = moments.map(moment => {
      const publisher = publishers?.find(p => p.id === moment.user_id);
      const momentComments = (comments || []).filter(c => c.moment_id === moment.id);
      const commentsWithUsers = momentComments.map(c => {
        const commenter = commenters?.find(u => u.id === c.user_id);
        return { ...c, user_nickname: commenter?.nickname, user_avatar: commenter?.avatar_color };
      });

      return {
        ...moment,
        publisher_nickname: publisher?.nickname || '未知',
        publisher_avatar: publisher?.avatar_color || '#666',
        comments: commentsWithUsers,
        is_liked: likedSet.has(moment.id),
      };
    });

    return NextResponse.json({ moments: momentsWithDetails });
  } catch (err) {
    console.error('获取动态列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST - 发布动态
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 发布动态限流：10条/小时/用户
    const limit = await checkUserRateLimit(payload.userId, { maxRequests: 10, windowMs: 60 * 60 * 1000, keyPrefix: 'moment_post' });
    if (!limit.allowed) {
      return NextResponse.json({ error: '发布动态过于频繁，请稍后再试' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const validated = await validateBody(request, publishMomentSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { content, images } = validated.data;

    const client = getSupabaseClient();

    // 创建动态
    const { data: moment, error } = await client
      .from('moments')
      .insert({
        user_id: payload.userId,
        content: content || '',
        images: images || [],
      })
      .select('id, user_id, content, images, like_count, comment_count, created_at')
      .single();

    if (error) throw new Error(`发布动态失败: ${error.message}`);

    // 获取发布者信息
    const { data: publisher } = await client
      .from('users')
      .select('id, nickname, avatar_color')
      .eq('id', payload.userId)
      .single();

    return NextResponse.json({
      moment: {
        ...moment,
        publisher_nickname: publisher?.nickname || '未知',
        publisher_avatar: publisher?.avatar_color || '#666',
        comments: [],
        is_liked: false,
      }
    });
  } catch (err) {
    console.error('发布动态错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

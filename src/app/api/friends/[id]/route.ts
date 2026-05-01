import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';
import { validateBody, updateFriendRemarkSchema } from '@/lib/validation';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - 获取好友详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const friendId = parseInt(resolvedParams.id);

    if (!friendId || isNaN(friendId)) {
      return NextResponse.json({ error: '缺少好友ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取好友信息
    const { data: friend, error: friendError } = await client
      .from('users')
      .select('id, qq_number, nickname, avatar_color, signature, status, last_seen, created_at')
      .eq('id', friendId)
      .maybeSingle();

    if (friendError) throw new Error(`查询好友失败: ${friendError.message}`);
    if (!friend) {
      return NextResponse.json({ error: '好友不存在' }, { status: 404 });
    }

    // 获取好友关系中的备注
    const { data: relation } = await client
      .from('friends')
      .select('remark, created_at')
      .eq('user_id', payload.userId)
      .eq('friend_id', friendId)
      .maybeSingle();

    // 获取与该好友的最近聊天记录
    const { data: conversations } = await client
      .from('conversations')
      .select('id')
      .eq('user_id', payload.userId)
      .eq('type', 'private')
      .eq('target_id', friendId)
      .maybeSingle();

    let recentMessages: unknown[] = [];
    if (conversations) {
      const { data: messages } = await client
        .from('messages')
        .select('id, content, type, created_at')
        .eq('conversation_id', conversations.id)
        .order('created_at', { ascending: false })
        .limit(5);

      recentMessages = messages || [];
    }

    return NextResponse.json({
      friend: {
        ...friend,
        remark: relation?.remark || null,
        conversation_id: conversations?.id || null,
        friendship_created_at: relation?.created_at || null,
      },
      recentMessages,
    });
  } catch (error) {
    console.error('获取好友详情失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT - 更新好友备注
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const friendId = parseInt(resolvedParams.id);

    if (!friendId || isNaN(friendId)) {
      return NextResponse.json({ error: '缺少好友ID' }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const validated = await validateBody(request, updateFriendRemarkSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { remark } = validated.data;
    const client = getSupabaseClient();

    const { error } = await client
      .from('friends')
      .update({ remark })
      .eq('user_id', payload.userId)
      .eq('friend_id', friendId);

    if (error) throw new Error(`更新备注失败: ${error.message}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新好友备注失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser, isGroupMember } from '@/lib/auth-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - 获取会话详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const resolvedParams = await params;
    const conversationId = parseInt(resolvedParams.id);

    if (!conversationId || isNaN(conversationId)) {
      return NextResponse.json({ error: '缺少会话ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取会话详情
    const { data: conversation, error } = await client
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', payload.userId)
      .single();

    if (error) throw new Error(`查询会话失败: ${error.message}`);
    if (!conversation) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 群聊需额外验证成员身份（防止用户退群后仍访问旧会话）
    if (conversation.type === 'group') {
      const isMember = await isGroupMember(conversation.target_id, payload.userId);
      if (!isMember) {
        return NextResponse.json({ error: '无权访问该会话' }, { status: 403 });
      }
    }

    // 如果是群聊，获取群信息
    if (conversation.type === 'group') {
      // 获取群信息
      const { data: group } = await client
        .from('groups')
        .select('id, name, description, avatar_color')
        .eq('id', conversation.target_id)
        .single();

      // 获取实际成员数量
      const { count: memberCount } = await client
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', conversation.target_id);

      return NextResponse.json({
        conversation: {
          ...conversation,
          group: group ? { ...group, member_count: memberCount || 0 } : null,
        },
      });
    }

    // 如果是私聊，获取对方用户信息
    if (conversation.type === 'private') {
      const { data: targetUser } = await client
        .from('users')
        .select('id, nickname, avatar_color, signature, status')
        .eq('id', conversation.target_id)
        .single();

      return NextResponse.json({
        conversation: {
          ...conversation,
          target_user: targetUser,
        },
      });
    }

    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('获取会话详情失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

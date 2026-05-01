import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isGroupMember, isFriend } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { validateBody, createConversationSchema } from '@/lib/validation';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';


// GET - 获取会话列表
export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient();
    
    // 获取会话列表
    const { data: conversations, error: convError } = await client
      .from('conversations')
      .select('*')
      .eq('user_id', payload.userId)
      .order('last_message_time', { ascending: false });

    if (convError) throw new Error(`查询会话失败: ${convError.message}`);
    
    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // 获取会话对应的目标信息
    const privateConv = conversations.filter(c => c.type === 'private');
    const groupConv = conversations.filter(c => c.type === 'group');

    let privateTargets: { id: number; nickname?: string; avatar_color?: string; status?: string }[] = [];
    let groupTargets: { id: number; name?: string; avatar_color?: string }[] = [];

    if (privateConv.length > 0) {
      const userIds = privateConv.map(c => c.target_id);
      const { data: users } = await client
        .from('users')
        .select('id, nickname, avatar_color, status')
        .in('id', userIds);
      privateTargets = users || [];
    }

    if (groupConv.length > 0) {
      const groupIds = groupConv.map(c => c.target_id);
      const { data: groups } = await client
        .from('groups')
        .select('id, name, avatar_color')
        .in('id', groupIds);
      groupTargets = groups || [];
    }

    // 合并数据
    const conversationsWithTargets = conversations.map(conv => {
      if (conv.type === 'private') {
        const target = privateTargets.find(t => t.id === conv.target_id);
        return {
          ...conv,
          target_name: target?.nickname || '未知',
          target_avatar: target?.avatar_color || '#666',
          target_status: target?.status,
        };
      }

      const target = groupTargets.find(t => t.id === conv.target_id);
      return {
        ...conv,
        target_name: target?.name || '未知',
        target_avatar: target?.avatar_color || '#666',
        target_status: undefined,
      };
    });

    return NextResponse.json({ conversations: conversationsWithTargets });
  } catch (err) {
    console.error('获取会话列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST - 创建或获取会话
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const validated = await validateBody(request, createConversationSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const { type, target_id } = validated.data;

    // 验证目标是否为用户的好友、群成员或机器人
    if (type === 'private') {
      const friendOk = await isFriend(payload.userId, target_id);
      if (!friendOk) {
        // 允许与机器人创建会话（机器人昵称固定为"小 Q 管家"）
        const client = getSupabaseClient();
        const { data: botUser } = await client
          .from('users')
          .select('id')
          .eq('nickname', '小 Q 管家')
          .eq('id', target_id)
          .maybeSingle();
        if (!botUser) {
          return NextResponse.json({ error: '对方不是您的好友' }, { status: 403 });
        }
      }
    } else if (type === 'group') {
      const memberOk = await isGroupMember(target_id, payload.userId);
      if (!memberOk) {
        return NextResponse.json({ error: '您不是该群成员' }, { status: 403 });
      }
    }

    const client = getSupabaseClient();

    // 检查会话是否已存在
    const { data: existing } = await client
      .from('conversations')
      .select('*')
      .eq('user_id', payload.userId)
      .eq('type', type)
      .eq('target_id', target_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ conversation: existing });
    }

    // 创建新会话
    const { data, error } = await client
      .from('conversations')
      .insert({
        type,
        user_id: payload.userId,
        target_id,
        last_message: '',
        unread_count: 0,
      })
      .select()
      .single();

    if (error) throw new Error(`创建会话失败: ${error.message}`);

    return NextResponse.json({ conversation: data });
  } catch (err) {
    console.error('创建会话错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

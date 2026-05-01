import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkUserRateLimit } from '@/lib/rate-limit';
import { validateBody, validateQuery, sendMessageSchema, getMessagesSchema } from '@/lib/validation';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';
import type { Message } from '@/lib/types';

interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// 验证会话是否属于当前用户（防止越权）
async function verifyConversationOwnership(client: ReturnType<typeof getSupabaseClient>, conversationId: number, userId: number): Promise<boolean> {
  const { data: conversation } = await client
    .from('conversations')
    .select('id, user_id, type, target_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) return false;

  // 如果是私聊，仅允许拥有该会话记录的用户访问
  if (conversation.type === 'private') {
    return conversation.user_id === userId;
  }

  // 如果是群聊，检查用户是否是群成员
  if (conversation.type === 'group') {
    const { data: member } = await client
      .from('group_members')
      .select('id')
      .eq('group_id', conversation.target_id)
      .eq('user_id', userId)
      .single();
    return !!member;
  }

  return false;
}

// GET - 获取消息列表
export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const validated = validateQuery(request.url, getMessagesSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { conversation_id, limit, offset, before } = validated.data;

    const client = getSupabaseClient();

    // 校验会话归属（防止越权读取）
    const isOwner = await verifyConversationOwnership(client, conversation_id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ error: '无权访问该会话' }, { status: 403 });
    }
    
    // 构建查询
    let query = client
      .from('messages')
      .select('id, conversation_id, sender_id, type, content, metadata, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    // 如果有 before 参数，加载该消息之前的消息
    if (before) {
      const { data: beforeMsg } = await client
        .from('messages')
        .select('created_at')
        .eq('id', before)
        .single();
      
      if (beforeMsg) {
        query = query.lt('created_at', beforeMsg.created_at);
      }
      // 按最新在前排序，返回后反转
      query = query.order('created_at', { ascending: false });
    }
    
    // 应用分页
    const { data: messages, error } = await query.range(offset, offset + limit - 1);

    if (error) throw new Error(`查询消息失败: ${error.message}`);

    // 如果是加载历史消息，需要反转顺序
    const sortedMessages: MessageRow[] = before ? (messages || []).reverse() : messages || [];

    // 获取发送者信息
    if (sortedMessages.length > 0) {
      const senderIds = [...new Set(sortedMessages.map((m: MessageRow) => m.sender_id))];
      const { data: senders } = await client
        .from('users')
        .select('id, nickname, avatar_color')
        .in('id', senderIds);

      const messagesWithSenders = sortedMessages.map((msg: MessageRow) => {
        const sender = senders?.find((s) => s.id === msg.sender_id);
        return {
          ...msg,
          sender_nickname: sender?.nickname || '未知',
          sender_avatar: sender?.avatar_color || '#666',
          is_mine: msg.sender_id === payload.userId, // 添加消息归属标记
        };
      });

      return NextResponse.json({ messages: messagesWithSenders });
    }

    return NextResponse.json({ messages: [] });
  } catch (err) {
    console.error('获取消息列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST - 发送消息
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 消息发送限流：30条/分钟/用户
    const limit = await checkUserRateLimit(payload.userId, { maxRequests: 30, windowMs: 60 * 1000, keyPrefix: 'msg_send' });
    if (!limit.allowed) {
      return NextResponse.json({ error: '发送消息过于频繁，请稍后再试' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    }

    // CSRF 验证
    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
      return NextResponse.json({ error: 'CSRF 验证失败' }, { status: 403 });
    }

    const validated = await validateBody(request, sendMessageSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { conversation_id, type, content, metadata } = validated.data;

    const client = getSupabaseClient();

    // 校验会话归属（防止越权发送）
    const isOwner = await verifyConversationOwnership(client, conversation_id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ error: '无权向该会话发送消息' }, { status: 403 });
    }

    // 获取会话信息（用于判断是否为群聊）
    const { data: conversation } = await client
      .from('conversations')
      .select('id, type')
      .eq('id', conversation_id)
      .single();

    // 插入消息
    const { data: message, error } = await client
      .from('messages')
      .insert({
        conversation_id,
        sender_id: payload.userId,
        type: type || 'text',
        content,
        metadata: metadata || {},
      })
      .select('id, conversation_id, sender_id, type, content, metadata, created_at')
      .single();

    if (error) throw new Error(`发送消息失败: ${error.message}`);

    // 更新会话的最后消息
    await client
      .from('conversations')
      .update({
        last_message: type === 'image' ? '[图片]' : content.substring(0, 50),
        last_message_time: message.created_at,
      })
      .eq('id', conversation_id);

    // 【群聊 @管家 触发 AI 回复】
    // 检测群聊消息中是否 @了小Q管家，如果是，异步触发 Bot 回复
    const isGroupChat = conversation && conversation.type === 'group';
    const hasAtBot = content.includes('@小Q管家') || content.includes('@管家');
    if (isGroupChat && hasAtBot) {
      const query = content
        .replace(/@小Q管家/g, '')
        .replace(/@管家/g, '')
        .trim();
      if (query) {
        // 异步触发，不阻塞当前请求
        Promise.resolve().then(async () => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 5000}`;
            const botRes = await fetch(`${baseUrl}/api/bot`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
                'Authorization': request.headers.get('authorization') || '',
              },
              body: JSON.stringify({ message: query, conversation_id }),
            });
            if (!botRes.ok) {
              console.error('Bot API error:', await botRes.text());
            }
          } catch (botErr) {
            console.error('群聊 Bot 回复失败:', botErr);
          }
        });
      }
    }

    // 获取发送者信息
    const { data: sender } = await client
      .from('users')
      .select('id, nickname, avatar_color')
      .eq('id', payload.userId)
      .single();

    const enrichedMessage = {
      ...message,
      sender_nickname: sender?.nickname || '未知',
      sender_avatar: sender?.avatar_color || '#666',
      is_mine: true,
    };

    // 通过 Socket.IO 向会话内用户推送新消息
    const io = (globalThis as typeof globalThis & { io?: unknown }).io;
    if (io) {
      (io as { to: (room: string) => { emit: (event: string, data: unknown) => void } })
        .to(`conversation_${conversation_id}`)
        .emit('new_message', {
          ...message,
          sender_nickname: sender?.nickname || '未知',
          sender_avatar: sender?.avatar_color || '#666',
          is_mine: false,
        });
    }

    return NextResponse.json({
      message: enrichedMessage,
    });
  } catch (err) {
    console.error('发送消息错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

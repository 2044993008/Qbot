import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isGroupMember } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';


// GET - 获取群成员
export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupIdParam = searchParams.get('group_id');

    if (!groupIdParam) {
      return NextResponse.json({ error: '缺少群ID' }, { status: 400 });
    }

    const groupId = parseInt(groupIdParam, 10);
    if (Number.isNaN(groupId) || groupId <= 0) {
      return NextResponse.json({ error: '群ID无效' }, { status: 400 });
    }

    const isMember = await isGroupMember(groupId, payload.userId);
    if (!isMember) {
      return NextResponse.json({ error: '无权访问该群成员列表' }, { status: 403 });
    }

    const client = getSupabaseClient();

    // 获取群成员
    const { data: members, error } = await client
      .from('group_members')
      .select('id, user_id, role, joined_at')
      .eq('group_id', groupId);

    if (error) throw new Error(`查询群成员失败: ${error.message}`);

    if (!members || members.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // 获取成员详细信息
    const userIds = members.map(m => m.user_id);
    const { data: users } = await client
      .from('users')
      .select('id, qq_number, nickname, avatar_color, status, signature')
      .in('id', userIds);

    const membersWithDetails = members.map(m => {
      const user = users?.find(u => u.id === m.user_id);
      return {
        ...m,
        ...user,
      };
    });

    return NextResponse.json({ members: membersWithDetails });
  } catch (err) {
    console.error('获取群成员错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

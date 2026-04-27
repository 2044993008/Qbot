import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';


// GET - 获取群列表
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient();
    
    // 获取用户所在的群
    const { data: memberships, error: memberError } = await client
      .from('group_members')
      .select('group_id')
      .eq('user_id', payload.userId);

    if (memberError) throw new Error(`查询群成员失败: ${memberError.message}`);
    
    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const groupIds = memberships.map(m => m.group_id);
    
    // 获取群信息
    const { data: groups, error: groupsError } = await client
      .from('groups')
      .select('id, name, avatar_color, description')
      .in('id', groupIds);

    if (groupsError) throw new Error(`查询群信息失败: ${groupsError.message}`);

    // 获取每个群的成员数
    const { data: allMembers } = await client
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);

    const memberCountMap: Record<number, number> = {};
    allMembers?.forEach(m => {
      memberCountMap[m.group_id] = (memberCountMap[m.group_id] || 0) + 1;
    });

    const groupsWithCount = groups?.map(g => ({
      ...g,
      member_count: memberCountMap[g.id] || 0,
    }));

    return NextResponse.json({ groups: groupsWithCount });
  } catch (err) {
    console.error('获取群列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

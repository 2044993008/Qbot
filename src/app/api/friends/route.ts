import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth-utils';

// GET - 获取好友列表
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient();
    
    // 获取好友列表
    const { data: friends, error: friendsError } = await client
      .from('friends')
      .select('friend_id, remark, created_at')
      .eq('user_id', payload.userId);

    if (friendsError) throw new Error(`查询好友失败: ${friendsError.message}`);
    
    if (!friends || friends.length === 0) {
      return NextResponse.json({ friends: [] });
    }

    const friendIds = friends.map(f => f.friend_id);
    
    // 获取好友详细信息
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, qq_number, nickname, avatar_color, signature, status, last_seen')
      .in('id', friendIds);

    if (usersError) throw new Error(`查询用户详情失败: ${usersError.message}`);

    // 合并数据，使用 friends.created_at 作为添加时间
    const friendsWithDetails = friends.map(f => {
      const user = users?.find(u => u.id === f.friend_id);
      return user ? { ...user, remark: f.remark, friend_since: f.created_at } : null;
    }).filter(Boolean);

    return NextResponse.json({ friends: friendsWithDetails });
  } catch (err) {
    console.error('获取好友列表错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';


// GET - 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('id, qq_number, nickname, avatar_color, signature, status, last_seen, created_at')
      .eq('id', payload.userId)
      .maybeSingle();

    if (error) throw new Error(`查询用户失败: ${error.message}`);
    if (!data) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('获取用户信息错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// PUT - 更新用户信息
export async function PUT(request: NextRequest) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const updates = await request.json();
    const allowedFields = ['nickname', 'signature', 'avatar_color'];
    const filteredUpdates: Record<string, string> = {};
    
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .update(filteredUpdates)
      .eq('id', payload.userId)
      .select('id, qq_number, nickname, avatar_color, signature, status')
      .single();

    if (error) throw new Error(`更新用户失败: ${error.message}`);

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('更新用户信息错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

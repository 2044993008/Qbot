import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth-utils';

// POST - 注册
export async function POST(request: NextRequest) {
  try {
    const { qq_number, nickname, password } = await request.json();
    
    if (!qq_number || !nickname || !password) {
      return NextResponse.json({ error: '请填写所有必填项' }, { status: 400 });
    }

    if (qq_number.length < 5 || qq_number.length > 12) {
      return NextResponse.json({ error: 'QQ号长度必须在5-12位之间' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 检查QQ号是否已存在
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('id')
      .eq('qq_number', qq_number)
      .maybeSingle();

    if (checkError) throw new Error(`检查用户失败: ${checkError.message}`);
    if (existingUser) {
      return NextResponse.json({ error: '该QQ号已被注册' }, { status: 400 });
    }

    // 随机头像颜色
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];
    const passwordHash = await bcrypt.hash(password, 12);

    // 创建用户
    const { data, error } = await client
      .from('users')
      .insert({
        qq_number,
        nickname,
        password: passwordHash,
        avatar_color,
        status: 'online',
        signature: '这个人很懒，什么都没写',
      })
      .select('id, qq_number, nickname, avatar_color, signature, status')
      .single();

    if (error) throw new Error(`创建用户失败: ${error.message}`);

    const token = generateToken(data.id, data.qq_number);
    
    // 设置 cookie
    const cookieStore = await cookies();
    cookieStore.set('qq_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // 添加小Q管家为好友（双向关系）
    const { data: botUser } = await client
      .from('users')
      .select('id')
      .eq('nickname', '小 Q 管家')
      .maybeSingle();

    if (botUser) {
      // 新用户添加管家为好友
      await client.from('friends').insert({
        user_id: data.id,
        friend_id: botUser.id,
      });
      // 管家也添加新用户为好友（双向关系）
      await client.from('friends').insert({
        user_id: botUser.id,
        friend_id: data.id,
      });
    }

    return NextResponse.json({
      success: true,
      token,
      user: data
    });
  } catch (err) {
    console.error('注册错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

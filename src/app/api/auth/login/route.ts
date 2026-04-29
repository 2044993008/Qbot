import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';
import { generateToken, verifyToken } from '@/lib/auth-utils';

// POST - 登录
export async function POST(request: NextRequest) {
  try {
    const { qq_number, password } = await request.json();
    
    if (!qq_number || !password) {
      return NextResponse.json({ error: '请输入QQ号和密码' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('qq_number', qq_number)
      .maybeSingle();

    if (error) throw new Error(`查询用户失败: ${error.message}`);
    if (!data) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    const storedPassword = data.password;
    const isHashedPassword = /^\$2[aby]\$/.test(storedPassword);
    const isPasswordValid = isHashedPassword
      ? await bcrypt.compare(password, storedPassword)
      : storedPassword === password;

    if (!isPasswordValid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    if (!isHashedPassword) {
      const passwordHash = await bcrypt.hash(password, 12);
      const { error: updatePasswordError } = await client
        .from('users')
        .update({ password: passwordHash })
        .eq('id', data.id);

      if (updatePasswordError) {
        throw new Error(`升级密码失败: ${updatePasswordError.message}`);
      }

      data.password = passwordHash;
    }

    // 更新在线状态
    await client.from('users').update({ 
      status: 'online',
      last_seen: new Date().toISOString()
    }).eq('id', data.id);

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

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: data.id,
        qq_number: data.qq_number,
        nickname: data.nickname,
        avatar_color: data.avatar_color,
        signature: data.signature,
        status: data.status,
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// GET - 验证 token
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyToken(request);

    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const client = getSupabaseClient();
    const { data } = await client
      .from('users')
      .select('id, qq_number, nickname, avatar_color, signature, status, last_seen')
      .eq('id', payload.userId)
      .single();

    if (!data) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: data,
    });
  } catch (err) {
    console.error('验证错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

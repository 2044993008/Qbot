import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';
import { generateToken } from '@/lib/auth-utils';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { validateBody, registerSchema } from '@/lib/validation';
import { generateCsrfToken } from '@/lib/csrf';

// POST - 注册
export async function POST(request: NextRequest) {
  // 注册接口限流：3次/小时/IP
  const limit = rateLimitMiddleware({ maxRequests: 3, windowMs: 60 * 60 * 1000, keyPrefix: 'register' });
  const limitResult = await limit(request);
  if (!limitResult.allowed) {
    return NextResponse.json({ error: '注册次数过多，请稍后再试' }, { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter) } });
  }

  try {
    const validated = await validateBody(request, registerSchema);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const { qq_number, nickname, password } = validated.data;

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

    const token = await generateToken(data.id, data.qq_number);
    
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

    // JWT 和 CSRF token 仅通过 HttpOnly cookie 传递，不在响应体中返回
    return NextResponse.json({
      success: true,
      user: data
    });
  } catch (err) {
    console.error('注册错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

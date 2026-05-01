import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';
import { generateCsrfToken } from '@/lib/csrf';
import { cookies } from 'next/headers';

// GET - 验证登录状态
export async function GET(request: NextRequest) {
  try {
    const payload = getAuthUser(request);

    if (!payload || !payload.userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const supabase = await getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, qq_number, nickname, avatar_color, status, signature')
      .eq('id', payload.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // 确保 CSRF cookie 已设置（页面刷新后可能丢失）
    const cookieStore = await cookies();
    const existingCsrf = cookieStore.get('qq_csrf')?.value;
    if (!existingCsrf) {
      const csrfToken = generateCsrfToken(String(user.id));
      cookieStore.set('qq_csrf', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        qq_number: user.qq_number,
        nickname: user.nickname,
        avatar_color: user.avatar_color,
        status: user.status || 'online',
        signature: user.signature || '这个人很懒，什么都没写',
      },
    });
  } catch (error) {
    console.error('验证失败:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

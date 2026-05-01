import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getAuthUser } from '@/lib/auth-utils';
import { generateCsrfToken } from '@/lib/csrf';

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

    const csrfToken = generateCsrfToken(String(user.id));

    return NextResponse.json({
      authenticated: true,
      csrf_token: csrfToken,
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

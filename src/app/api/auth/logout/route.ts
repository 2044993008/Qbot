import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth-utils';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

// POST - 登出
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const csrfToken = extractCsrfToken(request);
    if (!csrfToken || !verifyCsrfToken(csrfToken, String(user.userId))) {
      return NextResponse.json({ error: 'CSRF验证失败' }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.delete('qq_token');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('登出错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

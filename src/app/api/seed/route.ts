import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { POST as seedPost } from '@/server/db/seed';
import { extractCsrfToken, verifyCsrfToken } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  const payload = getAuthUser(request);

  if (!payload) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const csrfToken = extractCsrfToken(request);
  if (!csrfToken || !verifyCsrfToken(csrfToken, String(payload.userId))) {
    return NextResponse.json({ error: 'CSRF验证失败' }, { status: 403 });
  }

  return seedPost();
}

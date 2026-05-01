import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-utils';
import { POST as seedPost } from '@/server/db/seed';

export async function POST(request: NextRequest) {
  const payload = getAuthUser(request);

  if (!payload) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  return seedPost();
}

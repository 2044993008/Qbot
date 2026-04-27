import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST - 登出
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('qq_token');
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('登出错误:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

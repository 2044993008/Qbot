import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenString } from '@/lib/auth-edge';

// 认证中间件：集中验证 JWT token
// 排除登录/注册/登出端点（它们自行处理认证）
export async function middleware(request: NextRequest) {
  // 优先从 Cookie 获取 token
  let token = request.cookies.get('qq_token')?.value;

  // 如果没有 Cookie，尝试从 Authorization header 获取
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: '未登录', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const payload = await verifyTokenString(token);

  if (!payload) {
    return NextResponse.json(
      { error: '未登录', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // 将用户信息注入请求头，供下游路由使用
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(payload.userId));
  requestHeaders.set('x-qq-number', payload.qqNumber);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// 匹配所有 API 路由，但排除登录/注册/登出
export const config = {
  matcher: [
    '/api/((?!auth/login|auth/register|auth/logout).*)',
  ],
};

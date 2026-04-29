import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// JWT Secret - 必须从环境变量读取，生产环境强制要求配置
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // 开发环境如果未配置，给一个一次性警告并继续（不应部署到生产）
    console.warn('[SECURITY] JWT_SECRET not set, using insecure development fallback. DO NOT deploy to production without setting JWT_SECRET!');
  }
  const encoder = new TextEncoder();
  return encoder.encode(secret || 'qq-chat-dev-secret-only');
}

const TOKEN_EXPIRY = '7d'; // 7天

// 生成 JWT token (使用 jose 库)
export async function generateToken(userId: number, qqNumber: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ userId, qqNumber })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

// 验证 token（支持 Cookie 和 Authorization header）
export async function verifyToken(request: NextRequest) {
  // 优先从 Cookie 获取
  let token = request.cookies.get('qq_token')?.value;

  // 如果没有 Cookie，尝试从 Authorization header 获取
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      clockTolerance: 60, // 允许60秒时钟偏移
    });

    const userId = payload.userId as number;
    const qqNumber = payload.qqNumber as string;

    if (typeof userId !== 'number' || typeof qqNumber !== 'string') {
      return null;
    }

    return { userId, qqNumber };
  } catch {
    // 验证失败（过期或签名错误）
    return null;
  }
}

// 验证 token string（用于 Socket.IO 等非 HTTP 场景）
export async function verifyTokenString(token: string): Promise<{ userId: number; qqNumber: string } | null> {
  if (!token) return null;

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      clockTolerance: 60,
    });

    const userId = payload.userId as number;
    const qqNumber = payload.qqNumber as string;

    if (typeof userId !== 'number' || typeof qqNumber !== 'string') {
      return null;
    }

    return { userId, qqNumber };
  } catch {
    return null;
  }
}

export async function isGroupMember(groupId: number, userId: number): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`验证群成员身份失败: ${error.message}`);
  }

  return !!data;
}

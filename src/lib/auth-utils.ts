import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// JWT Secret Key - 实际生产环境应使用环境变量
const JWT_SECRET = process.env.JWT_SECRET || 'qq-chat-secret-key-change-in-production';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天

// 创建 HMAC-SHA256 签名
function createSignature(data: string): string {
  return createHmac('sha256', JWT_SECRET).update(data).digest('hex');
}

// 生成 JWT token
export function generateToken(userId: number, qqNumber: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId,
    qqNumber,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY,
  };

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerEncoded}.${payloadEncoded}`);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
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
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;

    // 验证签名
    const expectedSignature = createSignature(`${headerEncoded}.${payloadEncoded}`);
    if (signature !== expectedSignature) {
      console.error('Token signature verification failed');
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString());

    // 检查过期
    if (payload.exp && Date.now() > payload.exp) {
      console.error('Token expired');
      return null;
    }

    return { userId: payload.userId, qqNumber: payload.qqNumber };
  } catch (error) {
    console.error('Token verification error:', error);
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

// 解码 token 获取用户信息（不验证签名，仅用于本地快速读取）
export function decodeToken(token: string): { userId: number; qqNumber: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return { userId: payload.userId, qqNumber: payload.qqNumber };
  } catch {
    return null;
  }
}

import { SignJWT, jwtVerify } from 'jose';

// JWT Secret - 必须从环境变量读取，生产环境强制要求配置
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('[SECURITY] JWT_SECRET not set, using insecure development fallback. DO NOT deploy to production without setting JWT_SECRET!');
  }
  const encoder = new TextEncoder();
  return encoder.encode(secret || 'qq-chat-dev-secret-only');
}

const TOKEN_EXPIRY = '7d'; // 7天

// 生成 JWT token (使用 jose 库) - Edge Runtime 兼容
export async function generateToken(userId: number, qqNumber: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ userId, qqNumber })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

// 验证 token string - Edge Runtime 兼容
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

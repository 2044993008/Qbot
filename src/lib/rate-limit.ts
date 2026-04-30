import { NextRequest } from 'next/server';
import { checkRedisRateLimit } from './rate-limit-redis';
import { isRedisEnabled } from './redis';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// 内存级限流存储（适用于单实例部署或未配置 Redis）
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  maxRequests: number;      // 窗口内最大请求数
  windowMs: number;         // 窗口时长（毫秒）
  keyPrefix?: string;       // key 前缀，用于区分不同端点
  identifier?: (req: NextRequest) => string; // 自定义标识提取函数
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxRequests: 60,
  windowMs: 60 * 1000, // 1分钟
  keyPrefix: 'api',
};

function checkMemoryRateLimit(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetIn: number; retryAfter: number } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const key = `${opts.keyPrefix}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // 窗口过期，重置
  if (!entry || now - entry.windowStart > opts.windowMs) {
    entry = { count: 0, windowStart: now };
    rateLimitStore.set(key, entry);
  }

  const resetIn = Math.ceil((entry.windowStart + opts.windowMs - now) / 1000);

  if (entry.count >= opts.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      retryAfter: resetIn,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: opts.maxRequests - entry.count,
    resetIn,
    retryAfter: 0,
  };
}

function skipRateLimit() {
  return process.env.PLAYWRIGHT_SKIP_RATE_LIMIT === 'true';
}

/**
 * 检查并更新限流状态（优先 Redis，未配置则回退内存）
 * @returns 是否允许请求，以及剩余配额信息
 */
export async function checkRateLimit(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): Promise<{ allowed: boolean; remaining: number; resetIn: number; retryAfter: number }> {
  if (skipRateLimit()) {
    return { allowed: true, remaining: 9999, resetIn: 0, retryAfter: 0 };
  }
  if (isRedisEnabled()) {
    return checkRedisRateLimit(identifier, { ...DEFAULT_OPTIONS, ...options });
  }
  return checkMemoryRateLimit(identifier, options);
}

/**
 * 同步版本的限流检查（用于不支持 async 的场景）
 * 仅使用内存限流，不检查 Redis
 */
export function checkRateLimitSync(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetIn: number; retryAfter: number } {
  if (skipRateLimit()) {
    return { allowed: true, remaining: 9999, resetIn: 0, retryAfter: 0 };
  }
  return checkMemoryRateLimit(identifier, options);
}

/**
 * 根据 userId 做限流（适用于已认证接口）
 * 优先 Redis，回退内存
 */
export async function checkUserRateLimit(
  userId: number,
  options: Partial<RateLimitOptions> = {}
): Promise<{ allowed: boolean; remaining: number; resetIn: number; retryAfter: number }> {
  if (skipRateLimit()) {
    return { allowed: true, remaining: 9999, resetIn: 0, retryAfter: 0 };
  }
  if (isRedisEnabled()) {
    return checkRedisRateLimit(String(userId), { keyPrefix: 'user', ...DEFAULT_OPTIONS, ...options });
  }
  return checkMemoryRateLimit(String(userId), { keyPrefix: 'user', ...options });
}

/**
 * 清理过期的限流记录（防止内存泄漏）
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > DEFAULT_OPTIONS.windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// 每5分钟清理一次
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Express-style rate limit middleware for Next.js API routes
 * 用法：
 *   const limit = rateLimitMiddleware({ maxRequests: 5, windowMs: 60_000 });
 *   const result = await limit(request);
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(result.retryAfter) } });
 */
export function rateLimitMiddleware(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (request: NextRequest) => {
    // 优先用 Authorization header 里的用户 ID，否则用 IP
    let identifier = '';
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      identifier = authHeader.substring(7);
    } else {
      // 用 IP 作为兜底标识
      const forwarded = request.headers.get('x-forwarded-for');
      identifier = forwarded?.split(',')[0]?.trim() || 'unknown';
    }

    return checkRateLimit(identifier, { ...opts, identifier: () => identifier });
  };
}



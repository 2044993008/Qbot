import { getRedisClient } from './redis';

interface RedisRateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

/**
 * Redis 滑动窗口限流
 * 使用 INCR + EXPIRE 实现
 * @returns 是否允许请求，以及剩余配额信息
 */
export async function checkRedisRateLimit(
  identifier: string,
  options: RedisRateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetIn: number; retryAfter: number }> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis 未配置，回退到允许（上层应使用内存限流）
    return { allowed: true, remaining: Infinity, resetIn: 0, retryAfter: 0 };
  }

  const key = `rate_limit:${options.keyPrefix || 'default'}:${identifier}`;
  const now = Date.now();
  const windowMs = options.windowMs;
  const maxRequests = options.maxRequests;

  try {
    // 使用 Redis 事务：获取当前计数，如果没有则设置初始值和过期时间
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= maxRequests) {
      // 获取剩余过期时间
      const ttl = await redis.pttl(key);
      const resetIn = Math.ceil(ttl / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        retryAfter: resetIn,
      };
    }

    // 增加计数
    const multi = redis.multi();
    multi.incr(key);
    if (count === 0) {
      // 第一次请求，设置过期时间
      multi.pexpire(key, windowMs);
    }
    const results = await multi.exec();
    const newCount = results?.[0]?.[1] as number;

    return {
      allowed: true,
      remaining: maxRequests - newCount,
      resetIn: Math.ceil(windowMs / 1000),
      retryAfter: 0,
    };
  } catch {
    // Redis 操作失败时回退到允许（避免误杀）
    return { allowed: true, remaining: Infinity, resetIn: 0, retryAfter: 0 };
  }
}

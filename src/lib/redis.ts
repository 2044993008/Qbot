import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      // 静默处理连接错误，避免崩溃
      console.error('[Redis] Connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });

    redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    return redis;
  } catch {
    return null;
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export function isRedisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

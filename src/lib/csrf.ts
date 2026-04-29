import { randomBytes, createHmac } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-dev-secret-change-in-prod';

/**
 * 生成 CSRF Token
 * @param sessionId 会话标识（可以是用户ID或session ID）
 */
export function generateCsrfToken(sessionId: string): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36);
  const data = `${sessionId}:${nonce}:${timestamp}`;
  const signature = createHmac('sha256', CSRF_SECRET).update(data).digest('hex');
  return `${nonce}.${timestamp}.${signature}`;
}

/**
 * 验证 CSRF Token
 */
export function verifyCsrfToken(token: string, sessionId: string): boolean {
  if (!token || !token.includes('.')) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [nonce, timestamp, signature] = parts;
  const data = `${sessionId}:${nonce}:${timestamp}`;
  const expectedSignature = createHmac('sha256', CSRF_SECRET).update(data).digest('hex');

  // 时间防重放（token 有效期 24 小时）
  const ts = parseInt(timestamp, 36);
  if (Date.now() - ts > 24 * 60 * 60 * 1000) {
    return false;
  }

  // 防止时序攻击，使用固定时间比较
  if (signature.length !== expectedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 从请求中提取 CSRF Token
 * 优先从 header X-CSRF-Token，其次从 body._csrf
 */
export function extractCsrfToken(request: Request): string | null {
  const header = request.headers.get('X-CSRF-Token');
  if (header) return header;

  // 部分场景可能从 form body 传递
  return null;
}

/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateToken,
  verifyToken,
  verifyTokenString,
  isGroupMember,
} from './auth-utils';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Re-mock getSupabaseClient with a local mock per-test
vi.mocked(getSupabaseClient).mockReturnValue({
  from: vi.fn(),
} as unknown as ReturnType<typeof getSupabaseClient>);

describe('auth-utils', () => {
  const TEST_USER_ID = 42;
  const TEST_QQ_NUMBER = '10086';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken()', () => {
    it('returns a non-empty string token', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('returns a valid JWT structure (three base64url segments)', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('includes an issued-at (iat) claim in the payload', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      expect(typeof payload.iat).toBe('number');
      expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
    });
  });

  describe('verifyToken()', () => {
    it('returns payload when valid token is present in cookie', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: token }),
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toEqual({ userId: TEST_USER_ID, qqNumber: TEST_QQ_NUMBER });
    });

    it('returns payload when valid token is present in Authorization header', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: new Headers({ Authorization: `Bearer ${token}` }),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toEqual({ userId: TEST_USER_ID, qqNumber: TEST_QQ_NUMBER });
    });

    it('prefers cookie over Authorization header when both present', async () => {
      const cookieToken = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const headerToken = await generateToken(999, '99999');
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: cookieToken }),
        },
        headers: new Headers({ Authorization: `Bearer ${headerToken}` }),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toEqual({ userId: TEST_USER_ID, qqNumber: TEST_QQ_NUMBER });
    });

    it('returns null when no token is present', async () => {
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toBeNull();
    });

    it('returns null when token is malformed', async () => {
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'not-a-jwt' }),
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toBeNull();
    });

    it('returns null when token signature is invalid', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const tampered = token.slice(0, -5) + 'XXXXX';
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: tampered }),
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toBeNull();
    });

    it('returns null when payload fields have wrong types', async () => {
      // Manually craft a token with string userId to simulate bad payload shape
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
      const badToken = await new SignJWT({ userId: 'not-a-number', qqNumber: TEST_QQ_NUMBER })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      const request = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: badToken }),
        },
        headers: new Headers(),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toBeNull();
    });

    it('returns null when Authorization header does not start with Bearer ', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const request = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: new Headers({ Authorization: `Basic ${token}` }),
      } as unknown as NextRequest;

      const result = await verifyToken(request);
      expect(result).toBeNull();
    });
  });

  describe('verifyTokenString()', () => {
    it('returns payload for a valid token string', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const result = await verifyTokenString(token);
      expect(result).toEqual({ userId: TEST_USER_ID, qqNumber: TEST_QQ_NUMBER });
    });

    it('returns null for an empty string', async () => {
      const result = await verifyTokenString('');
      expect(result).toBeNull();
    });

    it('returns null for a malformed token string', async () => {
      const result = await verifyTokenString('malformed-token');
      expect(result).toBeNull();
    });

    it('returns null for a tampered token', async () => {
      const token = await generateToken(TEST_USER_ID, TEST_QQ_NUMBER);
      const tampered = token.slice(0, -3) + 'abc';
      const result = await verifyTokenString(tampered);
      expect(result).toBeNull();
    });

    it('returns null when payload userId is not a number', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
      const badToken = await new SignJWT({ userId: '42', qqNumber: TEST_QQ_NUMBER })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      const result = await verifyTokenString(badToken);
      expect(result).toBeNull();
    });

    it('returns null when payload qqNumber is not a string', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
      const badToken = await new SignJWT({ userId: TEST_USER_ID, qqNumber: 10086 })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      const result = await verifyTokenString(badToken);
      expect(result).toBeNull();
    });
  });

  describe('isGroupMember()', () => {
    it('returns true when user is a member of the group', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
            }),
          }),
        }),
      });
      vi.mocked(getSupabaseClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabaseClient>);

      const result = await isGroupMember(1, 42);
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('group_members');
    });

    it('returns false when user is not a member of the group', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });
      vi.mocked(getSupabaseClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabaseClient>);

      const result = await isGroupMember(1, 42);
      expect(result).toBe(false);
    });

    it('throws an error when Supabase query fails', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection lost' } }),
            }),
          }),
        }),
      });
      vi.mocked(getSupabaseClient).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof getSupabaseClient>);

      await expect(isGroupMember(1, 42)).rejects.toThrow('验证群成员身份失败: connection lost');
    });
  });
});

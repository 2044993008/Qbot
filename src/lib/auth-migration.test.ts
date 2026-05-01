import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import * as React from 'react';
import { AuthProvider, useAuth } from './auth-context';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

// Shared mock for cookies
const mockCookieSet = vi.fn();

// Mock auth-utils for login route
vi.mock('@/lib/auth-utils', async () => {
  const actual = await vi.importActual('@/lib/auth-utils');
  return {
    ...actual,
    generateToken: vi.fn(() => Promise.resolve('mock-jwt-token')),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: () => () => Promise.resolve({ allowed: true, remaining: 5, resetIn: 60, retryAfter: 0 }),
}));

vi.mock('@/lib/csrf', () => ({
  generateCsrfToken: () => 'test-csrf-token',
}));

vi.mock('@/lib/validation', () => ({
  validateBody: vi.fn(async (_req: Request, _schema: unknown) => {
    const body = await _req.json();
    if (!body.qq_number || !body.password) {
      return { success: false, error: 'Invalid input' };
    }
    return { success: true, data: body };
  }),
  loginSchema: {},
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(() => Promise.resolve(true)) },
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: mockCookieSet,
    delete: vi.fn(),
  }),
}));

vi.mock('@/storage/database/supabase-client', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from '@/storage/database/supabase-client';

const mockedGetSupabaseClient = vi.mocked(getSupabaseClient);

// Helper component to access auth context (using React.createElement to avoid JSX in .ts file)
function TestConsumer() {
  const auth = useAuth();
  return React.createElement('div', null,
    React.createElement('span', { 'data-testid': 'authenticated' }, auth.isAuthenticated ? 'true' : 'false'),
    React.createElement('span', { 'data-testid': 'loading' }, auth.isLoading ? 'true' : 'false'),
    React.createElement('span', { 'data-testid': 'ready' }, auth.isReady ? 'true' : 'false'),
    React.createElement('button', { 'data-testid': 'login-btn', onClick: () => auth.login('10001', '123456') }, 'Login')
  );
}

describe('Auth Migration: localStorage → HttpOnly cookie', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieSet.mockClear();
    localStorageMock = {};

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Login API route', () => {
    it('login response body does NOT contain token or csrf_token', async () => {
      const mockUser = {
        id: 1,
        qq_number: '10001',
        nickname: 'TestUser',
        password: '$2a$12$testhash',
        avatar_color: '#3b82f6',
        signature: 'Hello',
        status: 'offline',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: mockUser, error: null })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            };
          }
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ qq_number: '10001', password: '123456' }),
      });

      const response = await loginPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).not.toHaveProperty('token');
      expect(data).not.toHaveProperty('csrf_token');
      expect(data.user).toBeDefined();
    });

    it('login sets HttpOnly cookie', async () => {
      const mockUser = {
        id: 1,
        qq_number: '10001',
        nickname: 'TestUser',
        password: '$2a$12$testhash',
        avatar_color: '#3b82f6',
        signature: 'Hello',
        status: 'offline',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve({ data: mockUser, error: null })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            };
          }
          return {};
        }),
      };
      mockedGetSupabaseClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof getSupabaseClient>);

      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ qq_number: '10001', password: '123456' }),
      });

      await loginPOST(request);

      // Verify cookie was set with HttpOnly
      expect(mockCookieSet).toHaveBeenCalledWith(
        'qq_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
    });
  });

  describe('AuthContext client-side behavior', () => {
    it('clears old localStorage tokens on mount', async () => {
      // Pre-populate localStorage with old tokens
      localStorageMock['qq_token'] = 'old-jwt-token';
      localStorageMock['qq_csrf_token'] = 'old-csrf-token';

      // Mock fetch for verify call (returns not authenticated so we can focus on cleanup)
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ authenticated: false }), { status: 401 })
      );

      render(
        React.createElement(AuthProvider, null,
          React.createElement(TestConsumer, null)
        )
      );

      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('qq_token');
        expect(window.localStorage.removeItem).toHaveBeenCalledWith('qq_csrf_token');
      });
    });

    it('login does NOT store token in localStorage', async () => {
      // Mock fetch with URL-based responses
      global.fetch = vi.fn(async (url: string | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();

        if (urlString.includes('/auth/verify')) {
          return new Response(
            JSON.stringify({ authenticated: false }),
            { status: 401 }
          );
        }

        if (urlString.includes('/auth/login')) {
          return new Response(
            JSON.stringify({
              success: true,
              user: { id: 1, qq_number: '10001', nickname: 'TestUser' },
            }),
            { status: 200 }
          );
        }

        return new Response(JSON.stringify({}), { status: 404 });
      });

      const { getByTestId } = render(
        React.createElement(AuthProvider, null,
          React.createElement(TestConsumer, null)
        )
      );

      // Wait for initial mount/ready
      await waitFor(() => {
        expect(getByTestId('ready').textContent).toBe('true');
      });

      // Trigger login
      await act(async () => {
        getByTestId('login-btn').click();
      });

      // After login, the component should show authenticated
      await waitFor(() => {
        expect(getByTestId('authenticated').textContent).toBe('true');
      });

      // Verify localStorage was NEVER used to store the token
      expect(window.localStorage.setItem).not.toHaveBeenCalledWith('qq_token', expect.any(String));
      expect(window.localStorage.setItem).not.toHaveBeenCalledWith('qq_csrf_token', expect.any(String));
    });
  });
});

import { vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * 创建带认证的 NextRequest
 */
export function createAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
  token?: string
): NextRequest {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return new NextRequest(url, {
    ...options,
    headers,
  });
}

/**
 * 创建标准 mock Supabase 客户端
 * 支持链式调用和 mock 返回值设置
 */
export function createMockSupabaseClient() {
  const chain: any = {};

  // 创建返回 chain 的 mock 方法
  const createChainMock = () => {
    const fn = vi.fn(() => chain);
    return fn;
  };

  chain.select = createChainMock();
  chain.eq = createChainMock();
  chain.in = createChainMock();
  chain.neq = createChainMock();
  chain.gt = createChainMock();
  chain.lt = createChainMock();
  chain.gte = createChainMock();
  chain.lte = createChainMock();
  chain.order = createChainMock();
  chain.limit = createChainMock();
  chain.range = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.insert = createChainMock();
  chain.update = createChainMock();
  chain.delete = createChainMock();
  chain.count = vi.fn(() => Promise.resolve({ count: 0, error: null }));

  const fromMock = vi.fn(() => chain);

  return {
    from: fromMock,
    _chain: chain,
  };
}

/**
 * 创建更灵活的 mock Supabase 客户端
 * 允许为特定表和特定调用设置返回值
 */
export function createMockSupabaseClientV2(responses: Record<string, any> = {}) {
  let callIndex = 0;
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.range = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.count = vi.fn(() => Promise.resolve({ count: 0, error: null }));

  const fromMock = vi.fn((table: string) => {
    return chain;
  });

  return {
    from: fromMock,
    _chain: chain,
    _setResponse: (method: string, value: any) => {
      chain[method] = vi.fn(() => Promise.resolve(value));
    },
    _setMaybeSingle: (value: any) => {
      chain.maybeSingle = vi.fn(() => Promise.resolve(value));
    },
    _setSingle: (value: any) => {
      chain.single = vi.fn(() => Promise.resolve(value));
    },
    _setInsertSingle: (value: any) => {
      const insertChain = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(value)),
        })),
      };
      chain.insert = vi.fn(() => insertChain);
    },
    _setUpdateEq: (value: any) => {
      const updateChain = {
        eq: vi.fn(() => Promise.resolve(value)),
      };
      chain.update = vi.fn(() => updateChain);
    },
  };
}

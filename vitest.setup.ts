import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/headers for server components
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock Supabase client globally
vi.mock('@/storage/database/supabase-client', () => ({
  getSupabaseClient: vi.fn(),
}));

// Mock Redis
vi.mock('@/lib/rate-limit-redis', () => ({
  getRedisClient: vi.fn(),
}));

// Mock OpenAI
vi.mock('@/lib/openai', () => ({
  createChatCompletion: vi.fn(),
  generateImage: vi.fn(),
}));

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.OPENAI_BASE_URL = 'https://test.openai.com';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as logoutPOST } from './route';
import { cookies } from 'next/headers';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with success on logout', async () => {
    const mockDelete = vi.fn();
    vi.mocked(cookies).mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: mockDelete,
    } as unknown as ReturnType<typeof cookies>);

    const response = await logoutPOST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('qq_token');
  });

  it('returns 500 on cookie error', async () => {
    vi.mocked(cookies).mockImplementation(() => {
      throw new Error('Cookie error');
    });

    const response = await logoutPOST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('服务器错误');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

// Mock authApi
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();
const mockVerify = vi.fn();

vi.mock('@/lib/api', () => ({
  authApi: {
    login: (...args: unknown[]) => mockLogin(...args),
    register: (...args: unknown[]) => mockRegister(...args),
    logout: () => mockLogout(),
    verify: () => mockVerify(),
  },
}));

// Test component that exposes auth context values and captures async errors
function TestComponent() {
  const auth = useAuth();
  const [lastError, setLastError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLastError(null);
    try {
      await auth.login('10001', '123456');
    } catch (e) {
      setLastError((e as Error).message);
    }
  };

  const handleRegister = async () => {
    setLastError(null);
    try {
      await auth.register('10001', 'TestUser', '123456');
    } catch (e) {
      setLastError((e as Error).message);
    }
  };

  return (
    <div>
      <div data-testid="is-loading">{String(auth.isLoading)}</div>
      <div data-testid="is-authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="user">{auth.user ? auth.user.nickname : 'null'}</div>
      <div data-testid="last-error">{lastError ?? 'none'}</div>
      <button data-testid="login-btn" onClick={handleLogin}>
        Login
      </button>
      <button data-testid="register-btn" onClick={handleRegister}>
        Register
      </button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

const mockUser = {
  id: 1,
  qq_number: '10001',
  nickname: 'TestUser',
  avatar_color: '#3b82f6',
  signature: 'Hello',
  status: 'online' as const,
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with isLoading=true and no user', async () => {
    mockVerify.mockResolvedValue({ authenticated: false });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initially loading (before useEffect runs)
    expect(screen.getByTestId('is-loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('is-loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  describe('login', () => {
    it('sets user and isLoading=false on success', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      mockLogin.mockResolvedValue({ success: true, user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      const loginBtn = screen.getByTestId('login-btn');

      await act(async () => {
        loginBtn.click();
      });

      // During login, isLoading should be true
      // After login, isLoading should be false and user set
      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user').textContent).toBe('TestUser');
      expect(screen.getByTestId('last-error').textContent).toBe('none');
      expect(mockLogin).toHaveBeenCalledWith('10001', '123456');
    });

    it('propagates error and sets isLoading=false on API failure', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      const loginBtn = screen.getByTestId('login-btn');

      await act(async () => {
        loginBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('last-error').textContent).toBe('Invalid credentials');
      });

      expect(screen.getByTestId('is-loading').textContent).toBe('false');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });

    it('propagates error and sets isLoading=false on response.success=false', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      mockLogin.mockResolvedValue({ success: false });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      const loginBtn = screen.getByTestId('login-btn');

      await act(async () => {
        loginBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('last-error').textContent).toBe('登录失败，请检查账号密码');
      });

      expect(screen.getByTestId('is-loading').textContent).toBe('false');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });

  describe('register', () => {
    it('sets user and isLoading=false on success', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      mockRegister.mockResolvedValue({ success: true, user: mockUser });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      const registerBtn = screen.getByTestId('register-btn');

      await act(async () => {
        registerBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user').textContent).toBe('TestUser');
      expect(screen.getByTestId('last-error').textContent).toBe('none');
      expect(mockRegister).toHaveBeenCalledWith('10001', 'TestUser', '123456');
    });

    it('propagates error and sets isLoading=false on API failure', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      mockRegister.mockRejectedValue(new Error('QQ number already exists'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      const registerBtn = screen.getByTestId('register-btn');

      await act(async () => {
        registerBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('last-error').textContent).toBe('QQ number already exists');
      });

      expect(screen.getByTestId('is-loading').textContent).toBe('false');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });

    it('propagates error and sets isLoading=false on response.success=false', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      mockRegister.mockResolvedValue({ success: false });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      const registerBtn = screen.getByTestId('register-btn');

      await act(async () => {
        registerBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('last-error').textContent).toBe('注册失败，请重试');
      });

      expect(screen.getByTestId('is-loading').textContent).toBe('false');
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });

  describe('logout', () => {
    it('clears user and sets isLoading=false', async () => {
      mockVerify.mockResolvedValue({ authenticated: true, user: mockUser });
      mockLogout.mockResolvedValue({ success: true });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      const logoutBtn = screen.getByTestId('logout-btn');

      await act(async () => {
        logoutBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });

  describe('error propagation contract', () => {
    it('login caller can catch error and read error message', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      const apiError = new Error('Network error');
      mockLogin.mockRejectedValue(apiError);

      let capturedError: Error | undefined;

      function ErrorCapture() {
        const auth = useAuth();
        return (
          <button
            data-testid="login-with-catch"
            onClick={async () => {
              try {
                await auth.login('10001', 'wrong');
              } catch (e) {
                capturedError = e as Error;
              }
            }}
          >
            Login with Catch
          </button>
        );
      }

      render(
        <AuthProvider>
          <ErrorCapture />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-with-catch')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('login-with-catch').click();
      });

      await waitFor(() => {
        expect(capturedError).toBeDefined();
      });

      expect(capturedError!.message).toBe('Network error');
    });

    it('register caller can catch error and read error message', async () => {
      mockVerify.mockResolvedValue({ authenticated: false });
      const apiError = new Error('QQ already taken');
      mockRegister.mockRejectedValue(apiError);

      let capturedError: Error | undefined;

      function ErrorCapture() {
        const auth = useAuth();
        return (
          <button
            data-testid="register-with-catch"
            onClick={async () => {
              try {
                await auth.register('10001', 'NewUser', 'pass');
              } catch (e) {
                capturedError = e as Error;
              }
            }}
          >
            Register with Catch
          </button>
        );
      }

      render(
        <AuthProvider>
          <ErrorCapture />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('register-with-catch')).toBeInTheDocument();
      });

      await act(async () => {
        screen.getByTestId('register-with-catch').click();
      });

      await waitFor(() => {
        expect(capturedError).toBeDefined();
      });

      expect(capturedError!.message).toBe('QQ already taken');
    });
  });
});

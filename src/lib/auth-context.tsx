'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from '@/lib/types';
import { authApi } from '@/lib/api';

const TOKEN_KEY = 'qq_token';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isReady: boolean; // 客户端是否已准备就绪
  login: (qq_number: string, password: string) => Promise<void>;
  register: (qq_number: string, nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false); // 标记客户端是否准备就绪

  // 从 localStorage 恢复 token（仅在客户端执行）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        setToken(savedToken);
      }
      // 标记客户端已准备就绪
      setIsReady(true);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    // 如果没有 token，直接设置未登录状态
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await authApi.verify();
      if (response.authenticated && response.user) {
        setUser(response.user);
        if (response.csrf_token && typeof window !== 'undefined') {
          localStorage.setItem('qq_csrf_token', response.csrf_token);
        }
      } else {
        setUser(null);
        setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('qq_csrf_token');
      }
      }
    } catch {
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // 当 token 准备好后，验证用户状态
  useEffect(() => {
    if (isReady) {
      refreshUser();
    }
  }, [isReady, refreshUser]);

  const login = async (qq_number: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(qq_number, password);
      if (response.success && response.token) {
        setUser(response.user);
        setToken(response.token);
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, response.token);
          if (response.csrf_token) {
            localStorage.setItem('qq_csrf_token', response.csrf_token);
          }
        }
      } else {
        throw new Error('登录失败，请检查账号密码');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (qq_number: string, nickname: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(qq_number, nickname, password);
      if (response.success && response.token) {
        setUser(response.user);
        setToken(response.token);
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, response.token);
          if (response.csrf_token) {
            localStorage.setItem('qq_csrf_token', response.csrf_token);
          }
        }
      } else {
        throw new Error('注册失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
      }
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isReady,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

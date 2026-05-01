'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from '@/lib/types';
import { authApi } from '@/lib/api';

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
  const [isReady, setIsReady] = useState(false); // 标记客户端是否准备就绪

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authApi.verify();
      if (response.authenticated && response.user) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 迁移清理 + 初始化验证
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('qq_token');
      localStorage.removeItem('qq_csrf_token');
      // 先验证用户状态（确保 CSRF cookie 已设置），再标记就绪
      refreshUser().then(() => {
        setIsReady(true);
      });
    }
  }, [refreshUser]);

  const login = async (qq_number: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(qq_number, password);
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        throw new Error('登录失败，请检查账号密码');
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (qq_number: string, nickname: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.register(qq_number, nickname, password);
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        throw new Error('注册失败，请重试');
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
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

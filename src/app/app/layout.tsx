'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 只有当客户端准备就绪、加载完成、且未认证时才重定向
    if (isReady && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, isLoading, router]);

  // 客户端未准备就绪时，显示加载状态
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#12b7f5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

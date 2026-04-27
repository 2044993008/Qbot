'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/avatar';
import {
  MessageSquare,
  Users,
  Image,
  User,
  Settings,
  LogOut,
  Search,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onSelectChat?: (type: 'private' | 'group', id: number, name: string) => void;
}

export function Sidebar({ onSelectChat }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);

  const navItems = [
    { id: 'chats', label: '消息', icon: MessageSquare, href: '/app' },
    { id: 'friends', label: '联系人', icon: Users, href: '/app/friends' },
    { id: 'moments', label: '空间', icon: Image, href: '/app/moments' },
    { id: 'profile', label: '我的', icon: User, href: '/app/profile' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-[#f5f5f5]">
      {/* 顶部区域 */}
      <div className="p-4 bg-[#12b7f5] text-white">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={user?.nickname || 'U'} color={user?.avatar_color} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{user?.nickname || '用户'}</div>
            <div className="text-xs opacity-80">QQ {user?.qq_number}</div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        {/* 设置菜单 */}
        {showSettings && (
          <div className="space-y-1 pt-2 border-t border-white/20">
            <Link
              href="/app/profile"
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/20 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>个人资料</span>
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </div>
        )}
      </div>

      {/* 搜索框 */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索"
            className="w-full pl-10 pr-4 py-2 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-[#12b7f5] text-sm"
          />
        </div>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.id === 'chats' && pathname === '/app');
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors',
                isActive && 'bg-white border-l-4 border-[#12b7f5]'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-[#12b7f5]' : 'text-gray-500')} />
              <span className={cn(isActive ? 'text-[#12b7f5] font-medium' : 'text-gray-700')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  
  const navItems = [
    { id: 'chats', label: '消息', icon: MessageSquare, href: '/app' },
    { id: 'friends', label: '联系人', icon: Users, href: '/app/friends' },
    { id: 'moments', label: '空间', icon: Image, href: '/app/moments' },
    { id: 'profile', label: '我的', icon: User, href: '/app/profile' },
  ];

  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.id === 'chats' && pathname === '/app');
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2',
                isActive ? 'text-[#12b7f5]' : 'text-gray-500'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

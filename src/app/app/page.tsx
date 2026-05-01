'use client';

import { Sidebar, MobileNav } from '@/components/sidebar';
import ChatList from '@/components/chat-list';

export default function AppPage() {
  return (
    <div className="h-screen flex overflow-hidden">
      {/* 桌面端侧边栏 */}
      <div className="w-72 border-r bg-white desktop-only">
        <Sidebar />
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-hidden">
            <ChatList onSelectChat={() => {}} />
          </div>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <MobileNav />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Sidebar, MobileNav } from '@/components/sidebar';
import ChatList from '@/components/chat-list';
import ChatWindow from '@/components/chat-window';
import { useAuth } from '@/lib/auth-context';
import { ChevronLeft } from 'lucide-react';

interface ChatTarget {
  type: 'private' | 'group';
  id: number;
  name: string;
  avatar?: string;
}

export default function AppPage() {
  const { user } = useAuth();
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const handleSelectChat = (type: 'private' | 'group', id: number, name: string, avatar?: string) => {
    setChatTarget({ type, id, name, avatar });
    // 移动端隐藏侧边栏
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleBack = () => {
    setChatTarget(null);
    setShowSidebar(true);
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 桌面端侧边栏 */}
      <div className={`w-72 border-r bg-white desktop-only ${!showSidebar ? 'hidden' : ''}`}>
        <Sidebar onSelectChat={handleSelectChat} />
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        {chatTarget ? (
          // 聊天窗口 - 使用 calc 计算高度，减去顶部导航
          <div className="flex flex-col h-full">
            {/* 移动端顶部导航 */}
            <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-white border-b">
              <button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-medium truncate">{chatTarget.name}</span>
            </div>
            {/* 聊天窗口 - 使用 calc 填满剩余空间 */}
            <div className="flex-1 min-h-0">
              <ChatWindow
                type={chatTarget.type}
                targetId={chatTarget.id}
                targetName={chatTarget.name}
                targetAvatar={chatTarget.avatar}
                onBack={handleBack}
              />
            </div>
          </div>
        ) : (
          // 聊天列表
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-hidden">
              <ChatList onSelectChat={handleSelectChat} />
            </div>
          </div>
        )}
      </div>

      {/* 移动端底部导航 */}
      <MobileNav />
    </div>
  );
}

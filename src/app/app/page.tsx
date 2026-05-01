'use client';

import ChatList from '@/components/chat-list';

export default function AppPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden">
          <ChatList onSelectChat={() => {}} />
        </div>
      </div>
    </div>
  );
}

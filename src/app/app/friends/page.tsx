'use client';

import { useState, useEffect } from 'react';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFriends, useConversations } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { FriendProfileCard } from '@/components/friend-profile-card';
import { Search, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

export default function FriendsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { friends, fetchFriends } = useFriends();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [profileCardFriendId, setProfileCardFriendId] = useState<number | null>(null);

  useEffect(() => {
    // 只有在用户已认证且不再加载时才获取数据
    if (!authLoading && isAuthenticated) {
      fetchFriends();
    }
  }, [authLoading, isAuthenticated, fetchFriends]);

  // 按状态分组
  const onlineFriends = friends.filter(f => f.status === 'online' && f.nickname !== '小 Q 管家');
  const offlineFriends = friends.filter(f => f.status === 'offline');
  const busyFriends = friends.filter(f => f.status === 'busy');
  const botFriend = friends.find(f => f.nickname === '小 Q 管家');

  // 过滤
  const filteredFriends = friends.filter(f => {
    const name = (f.remark || f.nickname).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleStartChat = (friendId: number) => {
    router.push(`/app/chat/${friendId}`);
  };

  const handleOpenProfile = (friendId: number) => {
    setProfileCardFriendId(friendId);
  };

  const FriendItem = ({ friend }: { friend: typeof friends[0] }) => (
    <div
      className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => handleOpenProfile(friend.id)}
    >
      <Avatar
        name={friend.remark || friend.nickname}
        color={friend.avatar_color}
        size="lg"
        status={friend.status as "online" | "offline" | "busy"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {friend.remark || friend.nickname}
          </span>
          {friend.nickname === '小 Q 管家' && (
            <span className="px-1.5 py-0.5 bg-[#12b7f5] text-white text-xs rounded">AI</span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">
          {friend.signature || '这个人很懒，什么都没写'}
        </p>
      </div>
      <Button
        size="sm"
        className="bg-[#12b7f5] hover:bg-[#0aa8e8]"
        onClick={(e) => {
          e.stopPropagation();
          handleStartChat(friend.id);
        }}
      >
        <MessageSquare className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 移动端顶部 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b">
          <h1 className="text-lg font-semibold">联系人</h1>
        </div>

        {/* 搜索 */}
        <div className="p-4 bg-white border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索好友"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full bg-gray-100 border-0"
            />
          </div>
        </div>

        {/* 好友列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
          {searchQuery ? (
            // 搜索结果
            <div className="space-y-2">
              <h3 className="text-sm text-gray-500 font-medium">搜索结果</h3>
              {filteredFriends.map((friend) => (
                <FriendItem key={friend.id} friend={friend} />
              ))}
              {filteredFriends.length === 0 && (
                <p className="text-center text-gray-500 py-8">没有找到好友</p>
              )}
            </div>
          ) : (
            // 分类显示
            <>
              {/* 管家 */}
              {botFriend && (
                <div className="space-y-2">
                  <h3 className="text-sm text-gray-500 font-medium">智能助手</h3>
                  <div
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg cursor-pointer hover:shadow-md transition-shadow border border-blue-100"
                    onClick={() => handleOpenProfile(botFriend.id)}
                  >
                    <Avatar
                      name={botFriend.remark || botFriend.nickname}
                      color={botFriend.avatar_color}
                      size="lg"
                      status={botFriend.status as "online" | "offline" | "busy"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-600">
                          {botFriend.remark || botFriend.nickname}
                        </span>
                        <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded">AI</span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {botFriend.signature || '你的智能聊天助手'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartChat(botFriend.id);
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* 在线好友 */}
              {onlineFriends.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm text-gray-500 font-medium">
                    在线好友 ({onlineFriends.length})
                  </h3>
                  {onlineFriends.map((friend) => (
                    <FriendItem key={`online-${friend.id}`} friend={friend} />
                  ))}
                </div>
              )}

              {/* 忙碌好友 */}
              {busyFriends.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm text-gray-500 font-medium">
                    忙碌 ({busyFriends.length})
                  </h3>
                  {busyFriends.map((friend) => (
                    <FriendItem key={`busy-${friend.id}`} friend={friend} />
                  ))}
                </div>
              )}

              {/* 离线好友 */}
              {offlineFriends.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm text-gray-500 font-medium">
                    离线好友 ({offlineFriends.length})
                  </h3>
                  {offlineFriends.map((friend) => (
                    <FriendItem key={`offline-${friend.id}`} friend={friend} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 好友资料卡片弹窗 */}
      {profileCardFriendId && (
        <FriendProfileCard
          friendId={profileCardFriendId}
          onClose={() => setProfileCardFriendId(null)}
          onStartChat={handleStartChat}
        />
      )}

    </>
  );
}

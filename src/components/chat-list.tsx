'use client';

import { useEffect, useState } from 'react';
import { Sidebar, MobileNav } from '@/components/sidebar';
import { useConversations, useFriends, useGroups } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/avatar';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ChatListProps {
  onSelectChat: (type: 'private' | 'group', id: number, name: string, avatar?: string) => void;
}

export default function ChatList({ onSelectChat }: ChatListProps) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { conversations, fetchConversations } = useConversations();
  const { friends, fetchFriends } = useFriends();
  const { groups, fetchGroups } = useGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'friends' | 'groups'>('chats');

  useEffect(() => {
    // 只有在用户已认证且不再加载时才获取数据
    if (!authLoading && isAuthenticated) {
      fetchConversations();
      fetchFriends();
      fetchGroups();
    }
  }, [authLoading, isAuthenticated, fetchConversations, fetchFriends, fetchGroups]);

  // 过滤会话
  const filteredConversations = conversations.filter(conv => {
    const name = conv.target_name?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase());
  });

  // 过滤好友
  const filteredFriends = friends.filter(friend => {
    const name = (friend.remark || friend.nickname).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // 过滤群组
  const filteredGroups = groups.filter(group => {
    return group.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 管家（放在最前面）
  const botFriend = filteredFriends.find(f => f.nickname === '小 Q 管家');
  const otherFriends = filteredFriends.filter(f => f.nickname !== '小 Q 管家');
  const sortedFriends = botFriend ? [botFriend, ...otherFriends] : otherFriends;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 搜索框 */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-full bg-gray-100 border-0"
          />
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'chats' 
              ? 'text-[#12b7f5] border-b-2 border-[#12b7f5]' 
              : 'text-gray-500'
          }`}
        >
          聊天
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'friends' 
              ? 'text-[#12b7f5] border-b-2 border-[#12b7f5]' 
              : 'text-gray-500'
          }`}
        >
          好友
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'groups' 
              ? 'text-[#12b7f5] border-b-2 border-[#12b7f5]' 
              : 'text-gray-500'
          }`}
        >
          群聊
        </button>
      </div>

      {/* 列表内容 */}
      <div className="flex-1 overflow-y-auto">
        {/* 聊天列表 */}
        {activeTab === 'chats' && (
          <div>
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>暂无聊天记录</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={`conv-${conv.id}`}
                  data-testid="conversation-item"
                  onClick={() => onSelectChat(conv.type as 'private' | 'group', conv.target_id, conv.target_name || '未知', conv.target_avatar)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b"
                >
                  <Avatar
                    name={conv.target_name || '?'}
                    color={conv.target_avatar}
                    size="lg"
                    status={conv.type === 'private' ? (conv.target_status as "online" | "offline" | "busy") : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{conv.target_name}</span>
                      {conv.last_message_time && (
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: false, locale: zhCN })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {conv.last_message || '暂无消息'}
                    </p>
                  </div>
                  {conv.unread_count && conv.unread_count > 0 && (
                    <div className="unread-badge">
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 好友列表 */}
        {activeTab === 'friends' && (
          <div>
            {sortedFriends.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>暂无好友</p>
              </div>
            ) : (
              sortedFriends.map((friend) => (
                <div
                  key={`friend-${friend.id}`}
                  onClick={() => onSelectChat('private', friend.id, friend.remark || friend.nickname, friend.avatar_color)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b"
                >
                  <Avatar
                    name={friend.remark || friend.nickname}
                    color={friend.avatar_color}
                    size="lg"
                    status={friend.status as "online" | "offline" | "busy"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {friend.remark || friend.nickname}
                      </span>
                      {friend.nickname === '小 Q 管家' && (
                        <span className="px-1.5 py-0.5 bg-[#12b7f5] text-white text-xs rounded">AI</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {friend.signature || '这个人很懒，什么都没写'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 群聊列表 */}
        {activeTab === 'groups' && (
          <div>
            {filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>暂无群聊</p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={`group-${group.id}`}
                  onClick={() => onSelectChat('group', group.id, group.name, group.avatar_color)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b"
                >
                  <Avatar
                    name={group.name}
                    color={group.avatar_color}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{group.name}</span>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {group.member_count || 0} 位成员
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

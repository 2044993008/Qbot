'use client';

import { useState, useEffect } from 'react';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, MessageSquare, Calendar, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Friend, MessagePreview } from '@/lib/types';
import { friendsApi } from '@/lib/api';

interface FriendProfileCardProps {
  friendId: number;
  onClose: () => void;
  onStartChat: (friendId: number) => void;
}

export function FriendProfileCard({ friendId, onClose, onStartChat }: FriendProfileCardProps) {
  const [friend, setFriend] = useState<Friend | null>(null);
  const [recentMessages, setRecentMessages] = useState<MessagePreview[]>([]);
  const [remark, setRemark] = useState('');
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFriendDetail = async () => {
      try {
        const response = await friendsApi.getDetail(friendId);
        setFriend(response.friend);
        setRecentMessages(response.recentMessages || []);
        setRemark(response.friend.remark || '');
      } catch (error) {
        console.error('加载好友详情失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadFriendDetail();
  }, [friendId]);

  const refreshFriendDetail = async () => {
    const response = await friendsApi.getDetail(friendId);
    setFriend(response.friend);
    setRecentMessages(response.recentMessages || []);
    setRemark(response.friend.remark || '');
  };

  const handleSaveRemark = async () => {
    try {
      await friendsApi.updateRemark(friendId, remark);
      await refreshFriendDetail();
      setIsEditingRemark(false);
    } catch (error) {
      console.error('保存备注失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl w-full max-w-sm mx-4 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#12b7f5] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!friend) return null;

  const statusText = {
    online: '在线',
    offline: '离线',
    busy: '忙碌'
  };

  const statusClass = {
    online: 'text-green-500',
    offline: 'text-gray-400',
    busy: 'text-orange-500'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部背景 */}
        <div className="h-24 bg-gradient-to-r from-[#12b7f5] to-[#0aa8e8] relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* 头像和信息 */}
        <div className="px-4 -mt-12">
          <Avatar
            name={friend.nickname}
            color={friend.avatar_color}
            size="xl"
            status={friend.status as "online" | "offline" | "busy"}
            className="border-4 border-white"
          />
          
          <div className="mt-3 text-center">
            <h2 className="text-xl font-semibold">{friend.remark || friend.nickname}</h2>
            <p className="text-gray-500">QQ {friend.qq_number}</p>
            <div className={`mt-1 text-sm ${statusClass[friend.status as keyof typeof statusClass]}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                friend.status === 'online' ? 'bg-green-500' :
                friend.status === 'busy' ? 'bg-orange-500' : 'bg-gray-400'
              }`} />
              {statusText[friend.status as keyof typeof statusText]}
            </div>
          </div>
        </div>

        {/* 详细信息 */}
        <div className="p-4 space-y-4">
          {/* 个性签名 */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-700">{friend.signature || '这个人很懒，什么都没写'}</p>
          </div>

          {/* 备注编辑 */}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            {isEditingRemark ? (
              <div className="flex-1 flex gap-2">
                <Input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="设置备注名"
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSaveRemark}>保存</Button>
              </div>
            ) : (
              <div 
                className="flex-1 text-gray-700 cursor-pointer hover:text-[#12b7f5]"
                onClick={() => setIsEditingRemark(true)}
              >
                备注：{friend.remark || '点击设置'}
              </div>
            )}
          </div>

          {/* 加入时间 */}
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Calendar className="w-4 h-4" />
            <span>
              成为好友{' '}
              {formatDistanceToNow(new Date(friend.friendship_created_at || Date.now()), {
                addSuffix: true,
                locale: zhCN,
              })}
            </span>
          </div>

          {/* 最近聊天记录 */}
          {recentMessages.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm text-gray-500 font-medium mb-2">最近聊天</h3>
              <div className="space-y-2">
                {recentMessages.slice(0, 3).map((msg) => (
                  <div key={`msg-${msg.id}`} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                    <p className="truncate">{msg.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: zhCN })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onStartChat(friendId)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              发消息
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

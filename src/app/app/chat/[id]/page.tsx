'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '@/components/chat-window';
import { useAuth } from '@/lib/auth-context';
import { friendsApi, conversationsApi, groupsApi, botApi } from '@/lib/api';
import type { Conversation, Friend } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

const BOT_USER_NAME = '小Q管家';

export default function ChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [botUserId, setBotUserId] = useState<number | null>(null);
  const [isBotReady, setIsBotReady] = useState(false);
  const [targetInfo, setTargetInfo] = useState<{
    type: 'private' | 'group';
    id: number;
    name: string;
    avatar?: string;
  } | null>(null);

  const loadFriendTargetInfo = async (urlId: number): Promise<boolean> => {
    try {
      const friendResponse = await friendsApi.getDetail(urlId);
      const friend = friendResponse.friend as Friend | undefined;

      if (!friend) {
        return false;
      }

      if (
        (botUserId !== null && friend.id === botUserId) ||
        friend.nickname?.includes('管家') ||
        friend.nickname?.includes('Bot')
      ) {
        setTargetInfo({
          type: 'private',
          id: botUserId ?? friend.id,
          name: BOT_USER_NAME,
          avatar: friend.avatar_color || '#6366f1',
        });
        return true;
      }

      setTargetInfo({
        type: 'private',
        id: friend.id,
        name: friend.remark || friend.nickname,
        avatar: friend.avatar_color,
      });
      return true;
    } catch (error) {
      console.error('获取好友信息失败，尝试按会话解析:', error);
      return false;
    }
  };

  const loadConversationTargetInfo = async (urlId: number): Promise<boolean> => {
    try {
      const convResponse = await conversationsApi.getDetail(urlId);
      const conv = convResponse.conversation as Conversation | undefined;

      if (!conv) {
        return false;
      }

      if (conv.type === 'private' && botUserId !== null && conv.target_id === botUserId) {
        setTargetInfo({
          type: 'private',
          id: botUserId,
          name: BOT_USER_NAME,
          avatar: conv.target_user?.avatar_color || '#6366f1',
        });
      } else if (conv.type === 'group') {
        setTargetInfo({
          type: 'group',
          id: conv.target_id,
          name: conv.group?.name || '群聊',
          avatar: conv.group?.avatar_color || '#6366f1',
        });
      } else {
        setTargetInfo({
          type: 'private',
          id: conv.target_id,
          name: conv.target_user?.nickname || '私聊',
          avatar: conv.target_user?.avatar_color || '#999999',
        });
      }

      return true;
    } catch (error) {
      console.error('获取会话信息失败:', error);
      return false;
    }
  };

  const loadGroupTargetInfo = async (urlId: number): Promise<boolean> => {
    try {
      const response = await groupsApi.getList();
      const group = response.groups.find((g) => g.id === urlId);
      if (group) {
        setTargetInfo({
          type: 'group',
          id: group.id,
          name: group.name,
          avatar: group.avatar_color || '#6366f1',
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('获取群信息失败:', error);
      return false;
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      botApi
        .getConfig()
        .then((response) => {
          setBotUserId(response.bot?.id ?? null);
        })
        .catch((error) => {
          console.error('获取管家信息失败:', error);
          setBotUserId(null);
        })
        .finally(() => {
          setIsBotReady(true);
        });
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isBotReady) {
      const loadConversationInfo = async () => {
        try {
          const urlId = parseInt(resolvedParams.id);
          const loadedFriend = await loadFriendTargetInfo(urlId);
          if (loadedFriend) {
            return;
          }

          const loadedConversation = await loadConversationTargetInfo(urlId);
          if (loadedConversation) {
            return;
          }

          const loadedGroup = await loadGroupTargetInfo(urlId);
          if (loadedGroup) {
            return;
          }

          if (botUserId !== null && urlId === botUserId) {
            setTargetInfo({
              type: 'private',
              id: botUserId,
              name: BOT_USER_NAME,
              avatar: '#6366f1',
            });
          }
        } catch (error) {
          console.error('获取会话信息失败:', error);
        }
      };

      loadConversationInfo();
    }
  }, [authLoading, isAuthenticated, isBotReady, botUserId, resolvedParams.id]);

  if (!targetInfo) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#12b7f5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <ChatWindow
        type={targetInfo.type}
        targetId={targetInfo.id}
        targetName={targetInfo.name}
        targetAvatar={targetInfo.avatar}
        onBack={() => router.back()}
        isBotConversation={targetInfo.type === 'private' && botUserId !== null && targetInfo.id === botUserId}
      />
    </div>
  );
}

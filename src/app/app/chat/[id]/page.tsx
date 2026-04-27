'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '@/components/chat-window';
import { useAuth } from '@/lib/auth-context';
import { friendsApi, conversationsApi, botApi } from '@/lib/api';

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
    id: number;
    name: string;
    avatar?: string;
  } | null>(null);

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
          const friendResponse = await friendsApi.getDetail(urlId);

          if (friendResponse.friend) {
            const friend = friendResponse.friend;
            if (
              (botUserId !== null && friend.id === botUserId) ||
              friend.nickname?.includes('管家') ||
              friend.nickname?.includes('Bot')
            ) {
              setTargetInfo({
                id: botUserId ?? friend.id,
                name: BOT_USER_NAME,
                avatar: friend.avatar_color || '#6366f1',
              });
              return;
            }

            setTargetInfo({
              id: friend.id,
              name: friend.remark || friend.nickname,
              avatar: friend.avatar_color,
            });
            return;
          }

          const convResponse = await conversationsApi.getDetail(urlId);
          if (convResponse.conversation) {
            const conv = convResponse.conversation;
            if (conv.type === 'private' && botUserId !== null && conv.target_id === botUserId) {
              setTargetInfo({
                id: botUserId,
                name: BOT_USER_NAME,
                avatar: conv.target_user?.avatar_color || '#6366f1',
              });
            } else if (conv.type === 'group') {
              setTargetInfo({
                id: conv.target_id,
                name: conv.group?.name || '群聊',
                avatar: conv.group?.avatar_color || '#6366f1',
              });
            } else {
              setTargetInfo({
                id: conv.target_id,
                name: conv.target_user?.nickname || '私聊',
                avatar: conv.target_user?.avatar_color || '#999999',
              });
            }
            return;
          }

          if (botUserId !== null && urlId === botUserId) {
            setTargetInfo({
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
    <div className="h-screen flex flex-col">
      <ChatWindow
        type="private"
        targetId={targetInfo.id}
        targetName={targetInfo.name}
        targetAvatar={targetInfo.avatar}
        onBack={() => router.back()}
      />
    </div>
  );
}

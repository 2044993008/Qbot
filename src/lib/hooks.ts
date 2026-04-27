'use client';

import { useState, useCallback } from 'react';
import type { Conversation, Friend, Group, GroupMember, Message, Moment } from '@/lib/types';
import { conversationsApi, friendsApi, groupsApi, messagesApi, momentsApi } from '@/lib/api';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConversations = useCallback(() => {
    return (async () => {
      setIsLoading(true);
      try {
        const response = await conversationsApi.getList();
        setConversations(response.conversations || []);
      } catch (error) {
        console.error('获取会话列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const getOrCreateConversation = useCallback((type: 'private' | 'group', targetId: number) => {
    return (async () => {
      try {
        const response = await conversationsApi.getOrCreate(type, targetId);
        await fetchConversations();
        return response.conversation;
      } catch (error) {
        console.error('创建会话失败:', error);
        return null;
      }
    })();
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    fetchConversations,
    getOrCreateConversation,
  };
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFriends = useCallback(() => {
    return (async () => {
      setIsLoading(true);
      try {
        const response = await friendsApi.getList();
        setFriends(response.friends || []);
      } catch (error) {
        console.error('获取好友列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return {
    friends,
    isLoading,
    fetchFriends,
  };
}

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGroups = useCallback(() => {
    return (async () => {
      setIsLoading(true);
      try {
        const response = await groupsApi.getList();
        setGroups(response.groups || []);
      } catch (error) {
        console.error('获取群列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const getMembers = useCallback((groupId: number) => {
    return (async () => {
      try {
        const response = await groupsApi.getMembers(groupId);
        return response.members || [];
      } catch (error) {
        console.error('获取群成员失败:', error);
        return [];
      }
    })();
  }, []);

  return {
    groups,
    isLoading,
    fetchGroups,
    getMembers,
  };
}

export function useMessages(conversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMessages = useCallback(() => {
    return (async () => {
      if (!conversationId) return;
      
      setIsLoading(true);
      try {
        const response = await messagesApi.getList(conversationId);
        setMessages(response.messages || []);
      } catch (error) {
        console.error('获取消息列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [conversationId]);

  const sendMessage = useCallback((
    type: 'text' | 'image' | 'file',
    content: string,
    metadata?: Record<string, unknown>
  ) => {
    return (async () => {
      if (!conversationId) return null;
      
      try {
        const response = await messagesApi.send(conversationId, type, content, metadata);
        if (response.message) {
          setMessages(prev => [...prev, response.message]);
        }
        return response.message;
      } catch (error) {
        console.error('发送消息失败:', error);
        return null;
      }
    })();
  }, [conversationId]);

  return {
    messages,
    isLoading,
    fetchMessages,
    sendMessage,
    setMessages,
  };
}

export function useMoments(userId?: number) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMoments = useCallback(() => {
    return (async () => {
      setIsLoading(true);
      try {
        const response = await momentsApi.getList(userId);
        setMoments(response.moments || []);
      } catch (error) {
        console.error('获取动态列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userId]);

  const publishMoment = useCallback((content: string, images?: string[]) => {
    return (async () => {
      try {
        const response = await momentsApi.publish(content, images);
        if (response.moment) {
          setMoments(prev => [response.moment, ...prev]);
        }
        return response.moment;
      } catch (error) {
        console.error('发布动态失败:', error);
        return null;
      }
    })();
  }, []);

  const likeMoment = useCallback((momentId: number) => {
    return (async () => {
      try {
        const response = await momentsApi.like(momentId);
        setMoments(prev => prev.map(m => 
          m.id === momentId 
            ? { ...m, is_liked: response.liked, like_count: m.like_count + (response.liked ? 1 : -1) }
            : m
        ));
      } catch (error) {
        console.error('点赞失败:', error);
      }
    })();
  }, []);

  const commentMoment = useCallback((momentId: number, content: string) => {
    return (async () => {
      try {
        const response = await momentsApi.comment(momentId, content);
        if (response.comment) {
          setMoments(prev => prev.map(m => 
            m.id === momentId 
              ? { ...m, comment_count: m.comment_count + 1, comments: [...(m.comments || []), response.comment] }
              : m
          ));
        }
      } catch (error) {
        console.error('评论失败:', error);
      }
    })();
  }, []);

  return {
    moments,
    isLoading,
    fetchMoments,
    publishMoment,
    likeMoment,
    commentMoment,
  };
}

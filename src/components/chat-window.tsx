'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMessages, useGroups } from '@/lib/hooks';
import { botApi, conversationsApi, messagesApi, momentsApi, getCsrfToken } from '@/lib/api';
import { Send, Image as ImageIcon, AtSign, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAuth } from '@/lib/auth-context';
import type { GroupMember, Message, SearchResult, User, BotResponse, BotPreviewAction } from '@/lib/types';
import { getMessageRenderer } from '@/components/message-renderers';

interface ChatWindowProps {
  type: 'private' | 'group';
  targetId: number;
  targetName: string;
  targetAvatar?: string;
  onBack?: () => void;
  isBotConversation?: boolean;
}

// 获取管家用户信息（动态获取，而非硬编码）
async function getBotUser(): Promise<User | null> {
  try {
    const response = await fetch('/api/bot', { 
      method: 'GET',
      credentials: 'include' 
    });
    const data = await response.json();
    return data.bot || null;
  } catch {
    return null;
  }
}

export default function ChatWindow({ 
  type, 
  targetId, 
  targetName, 
  targetAvatar,
  onBack,
  isBotConversation = false,
}: ChatWindowProps) {
  const { user } = useAuth();
  const currentUserId = user?.id || 0;
  
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [showAtPanel, setShowAtPanel] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [botUser, setBotUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  
  const { messages, fetchMessages, sendMessage, setMessages } = useMessages(conversationId);
  const shouldAutoReplyAsBot = isBotConversation || (botUser !== null && targetId === botUser.id);

  // 获取管家用户信息
  useEffect(() => {
    getBotUser().then(bot => {
      if (bot) setBotUser(bot);
    });
  }, []);

  // 获取或创建会话
  useEffect(() => {
    const initConversation = async () => {
      try {
        const conv = await conversationsApi.getOrCreate(type, targetId);
        if (conv?.conversation) {
          setConversationId(conv.conversation.id);
        }
      } catch (error) {
        console.error('初始化会话失败:', error);
      }
    };
    initConversation();
  }, [type, targetId]);

  // 获取群成员（仅群聊）
  useEffect(() => {
    if (type === 'group') {
      const loadMembers = async () => {
        try {
          const response = await fetch(`/api/groups/members?group_id=${targetId}`, { credentials: 'include' });
          const data = await response.json();
          setMembers(data.members || []);
        } catch (error) {
          console.error('获取群成员失败:', error);
        }
      };
      loadMembers();
    }
  }, [type, targetId]);

  // 重置消息分页状态
  useEffect(() => {
    if (conversationId) {
      setHasMoreMessages(true);
    }
  }, [conversationId]);

  // 滚动到底部
  useEffect(() => {
      if (messages.length > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages.length]);

  // 加载更多历史消息
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMoreMessages || messages.length === 0) return;
    
    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
          const response = await fetch(`/api/messages?conversation_id=${conversationId}&before=${oldestMessage.id}&limit=20`, { credentials: 'include' });
          const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        setMessages(prev => [...data.messages, ...prev]);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('加载更多消息失败:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, isLoadingMore, hasMoreMessages, messages, setMessages]);

  // 滚动到顶部加载更多
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current && messagesContainerRef.current.scrollTop < 100) {
      loadMoreMessages();
    }
  }, [loadMoreMessages]);

  // 处理发送消息
  const handleSend = async () => {
    if (!inputMessage.trim() || !conversationId) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setIsTyping(true);

    try {
      // 发送到服务器（sendMessage 会自动添加消息到列表）
      const sentMessage = await sendMessage('text', content);

      if (!sentMessage) {
        // 发送失败，恢复输入框并显示错误提示
        setInputMessage(content);
        const errorMsg: Message = {
          id: -Date.now(),
          conversation_id: conversationId,
          sender_id: 0,
          sender_nickname: '系统',
          sender_avatar: '#ef4444',
          type: 'text',
          content: '消息发送失败，请检查网络后重试',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
        setIsTyping(false);
        return;
      }

      // 模拟管家回复（通过显式会话标记判断）
      if (shouldAutoReplyAsBot && botUser) {
        try {
          // 【流式输出】使用 SSE 获取打字机效果
          const useStreaming = true; // 可通过设置切换
          if (useStreaming) {
            await handleStreamBotResponse(content, conversationId, botUser);
          } else {
            // 回退到同步模式
            const botResponse = await botApi.send(content, conversationId);
            if (botResponse.type === 'preview' && botResponse.preview) {
              const previewMessage: Message = {
                id: -Date.now(),
                conversation_id: conversationId,
                sender_id: botUser.id,
                sender_nickname: botUser.nickname,
                sender_avatar: botUser.avatar_color,
                type: 'text',
                content: botResponse.response,
                metadata: { preview: botResponse.preview, isPreview: true },
                created_at: new Date().toISOString(),
              };
              setMessages(prev => [...prev, previewMessage]);
            } else {
              await fetchMessages();
            }
          }
        } catch (error) {
          console.error('管家回复失败:', error);
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
    } finally {
      setIsTyping(false);
    }
  };

  // 处理流式 Bot 回复（SSE 打字机效果）
  const handleStreamBotResponse = async (userContent: string, convId: number, bot: User) => {
    const tempId = -Date.now();
    let fullContent = '';
    let previewData: Record<string, unknown> | null = null;

    // 先添加一个空的 Bot 消息占位
    const tempMessage: Message = {
      id: tempId,
      conversation_id: convId,
      sender_id: bot.id,
      sender_nickname: bot.nickname,
      sender_avatar: bot.avatar_color,
      type: 'text',
      content: '',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const csrfToken = getCsrfToken();
      const response = await fetch('/api/bot/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userContent,
          conversation_id: convId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('SSE 连接失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 保留最后一个可能不完整的行到缓冲区
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'delta' && data.content) {
                fullContent += data.content;
                setMessages(prev =>
                  prev.map(m => (m.id === tempId ? { ...m, content: fullContent } : m))
                );
              } else if (data.type === 'preview') {
                // Agent 返回了 preview，记录到局部变量，循环结束后统一应用
                previewData = data.preview as Record<string, unknown>;
                fullContent = data.response || fullContent;
              } else if (data.type === 'done') {
                fullContent = data.fullContent || fullContent;
              } else if (data.error) {
                console.error('SSE error:', data.error);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 循环结束后统一应用最终状态（避免 React 批处理导致 metadata 丢失）
      setMessages(prev => {
        const msg = prev.find(m => m.id === tempId);
        if (!msg) return prev;

        if (previewData) {
          return prev.map(m =>
            m.id === tempId
              ? { ...msg, content: fullContent, metadata: { preview: previewData, isPreview: true } }
              : m
          );
        }

        return prev.map(m => (m.id === tempId ? { ...msg, content: fullContent } : m));
      });
    } catch (error) {
      console.error('流式 Bot 回复失败:', error);
      // 显示错误消息
      setMessages(prev =>
        prev.map(m =>
          m.id === tempId
            ? { ...m, content: '抱歉，我这边出了点小问题，能再说一遍吗？' }
            : m
        )
      );
    }
  };

  // 执行单个 preview action
  const executeSinglePreview = async (preview: BotPreviewAction): Promise<{ success: boolean; message?: string }> => {
    if (!preview) return { success: false };

    if (preview.action === 'send_message' && preview.target_id) {
      const convType = preview.target_type === 'group' ? 'group' : 'private';
      const conv = await conversationsApi.getOrCreate(convType, preview.target_id);
      if (preview.content) {
        await messagesApi.send(conv.conversation.id, 'text', preview.content);
      }
      if (preview.image_url) {
        await messagesApi.send(conv.conversation.id, 'image', preview.image_url);
      }
      return { success: true, message: `已发送消息给 ${preview.target || ''}` };
    }

    if (preview.action === 'publish_moment') {
      await momentsApi.publish(preview.content || '', preview.image_urls);
      return { success: true, message: '已发布空间动态' };
    }

    if (preview.action === 'generate_image') {
      const result = await botApi.executeTool('generate_image', { prompt: preview.prompt, style: preview.style });
      if (result.imageUrl && conversationId) {
        await messagesApi.send(conversationId, 'image', result.imageUrl);
        return { success: true, message: '图片已生成并发送' };
      }
      return { success: false, message: result.error || '图片生成失败' };
    }

    if (preview.action === 'generate_video') {
      const result = await botApi.executeTool('generate_video', { prompt: preview.prompt, duration: preview.duration });
      if (result.videoUrl && conversationId) {
        await messagesApi.send(conversationId, 'image', result.videoUrl);
        return { success: true, message: '视频已生成并发送' };
      }
      return { success: false, message: result.error || '视频生成失败' };
    }

    if (preview.action === 'delete_friend' && preview.friend_id) {
      const result = await botApi.executeTool('delete_friend', { friend_id: preview.friend_id });
      if (result.success) {
        return { success: true, message: `已删除好友「${preview.friend_name || preview.target || ''}」` };
      }
      return { success: false, message: result.error || '删除好友失败' };
    }

    if (preview.action === 'leave_group' && preview.group_id) {
      const result = await botApi.executeTool('leave_group', { group_id: preview.group_id });
      if (result.success) {
        return { success: true, message: `已退出群聊「${preview.group_name || preview.target || ''}」` };
      }
      return { success: false, message: result.error || '退出群聊失败' };
    }

    if (preview.action === 'edit_moment' && preview.moment_id) {
      await momentsApi.update(preview.moment_id, { content: preview.new_content, images: preview.new_images });
      return { success: true, message: '动态已编辑' };
    }

    if (preview.action === 'delete_moment' && preview.moment_id) {
      await momentsApi.delete(preview.moment_id);
      return { success: true, message: '动态已删除' };
    }

    return { success: true, message: '操作已完成' };
  };

  // 处理确认预览操作
  const handleConfirmAction = async (msg: Message) => {
    const previewData = msg.metadata?.preview as BotResponse['preview'];
    if (!previewData) return;

    // 支持 { actions: [...] } 格式（多步骤 Agent 编排返回）
    const actions: BotPreviewAction[] = 'actions' in previewData && Array.isArray((previewData as Record<string, unknown>).actions)
      ? (previewData as { actions: BotPreviewAction[] }).actions
      : [previewData as BotPreviewAction];

    const results: string[] = [];

    try {
      for (const action of actions) {
        if (!action) continue;
        const result = await executeSinglePreview(action);
        if (result.message) {
          results.push(result.message);
        }
      }

      // 移除预览消息，添加成功提示
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      const successMessage: Message = {
        id: -Date.now() - 1,
        conversation_id: conversationId!,
        sender_id: botUser!.id,
        sender_nickname: botUser!.nickname,
        sender_avatar: botUser!.avatar_color,
        type: 'text',
        content: results.join('\n') || '操作已完成~',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, successMessage]);

      // 刷新消息列表（如果涉及发送消息到其他会话）
      await fetchMessages();
    } catch (error) {
      console.error('确认操作失败:', error);
      // 移除预览消息，添加失败提示
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      const errorMessage: Message = {
        id: -Date.now() - 1,
        conversation_id: conversationId!,
        sender_id: botUser!.id,
        sender_nickname: botUser!.nickname,
        sender_avatar: botUser!.avatar_color,
        type: 'text',
        content: '操作失败了，请稍后再试~',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // 处理取消预览操作
  const handleCancelAction = (msg: Message) => {
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    const cancelMessage: Message = {
      id: -Date.now() - 1,
      conversation_id: conversationId!,
      sender_id: botUser!.id,
      sender_nickname: botUser!.nickname,
      sender_avatar: botUser!.avatar_color,
      type: 'text',
      content: '已取消操作~',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, cancelMessage]);
  };

  // 处理 @ 提及
  const handleAt = (member: GroupMember) => {
    setInputMessage(prev => prev + `@${member.nickname} `);
    setShowAtPanel(false);
  };

  // 处理回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 格式化消息时间
  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return '昨天 ' + format(date, 'HH:mm');
    } else {
      return format(date, 'MM/dd HH:mm');
    }
  };

  // 判断是否显示日期分隔
  const showDateDivider = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;
    return !isSameDay(new Date(currentMsg.created_at), new Date(prevMsg.created_at));
  };

  // 获取成员角色
  const getMemberRole = (nickname: string) => {
    return members.find(m => m.nickname === nickname)?.role;
  };

  // 渲染消息气泡（使用插件化渲染器）
  const renderMessageBubble = (msg: Message, isMine: boolean) => {
    const Renderer = getMessageRenderer(msg);
    return (
      <Renderer
        msg={msg}
        isMine={isMine}
        botUser={botUser}
        conversationId={conversationId}
        onConfirmAction={handleConfirmAction}
        onCancelAction={handleCancelAction}
        fetchMessages={fetchMessages}
        setMessages={setMessages}
      />
    );
  };

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* 顶部栏 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm shrink-0">
        {onBack && (
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800 truncate">{targetName}</h2>
          {type === 'group' && (
            <p className="text-xs text-gray-500">{members.length} 位群成员</p>
          )}
        </div>
      </div>

      {/* 消息区域 */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ minHeight: 0 }}
      >
        {/* 加载更多按钮 */}
        {hasMoreMessages && (
          <div className="flex justify-center mb-4">
            <button
              onClick={loadMoreMessages}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  加载更多消息
                </>
              )}
            </button>
          </div>
        )}

        {/* 消息列表 */}
        <div className="space-y-3">
          {messages.map((msg, index) => {
            const isMine = msg.sender_id === currentUserId;
            const showSender = type === 'group' && !isMine && msg.sender_nickname;
            const prevMsg = index > 0 ? messages[index - 1] : undefined;
            const showDate = showDateDivider(msg, prevMsg);
            const role = showSender ? getMemberRole(msg.sender_nickname || '') : undefined;
            const isSameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id && 
              isSameDay(new Date(prevMsg.created_at), new Date(msg.created_at));
            
            return (
              <div key={`msg-${msg.id}`}>
                {/* 日期分隔 */}
                {showDate && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-white/80 rounded-full text-xs text-gray-500 shadow-sm">
                      {format(new Date(msg.created_at), 'yyyy年MM月dd日', { locale: zhCN })}
                    </span>
                  </div>
                )}
                
                {/* 消息内容 */}
                <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} ${isSameSenderAsPrev ? 'mt-1' : 'mt-3'}`}>
                  {/* 头像 */}
                  {isMine ? (
                    <Avatar 
                      name="我" 
                      color="#3b82f6"
                      size="md"
                      className="shrink-0"
                    />
                  ) : (
                    <Avatar 
                      name={msg.sender_nickname || '?'} 
                      color={msg.sender_avatar}
                      size="md"
                      className="shrink-0"
                    />
                  )}
                  
                  {/* 消息主体 */}
                  <div className={`flex flex-col max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* 发送者信息（仅群聊中非自己的消息） */}
                    {showSender && !isSameSenderAsPrev && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-700">{msg.sender_nickname}</span>
                        {role && role !== '普通成员' && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                            {role}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* 消息气泡 */}
                    {renderMessageBubble(msg, isMine)}
                    
                    {/* 时间戳 */}
                    {!isSameSenderAsPrev && (
                      <span className="text-xs text-gray-400 mt-1">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 正在输入指示器 */}
        {isTyping && (
          <div className="flex gap-2 mt-3 animate-fadeIn">
            <Avatar name="?" color="#6366f1" size="md" />
            <div className="message-bubble message-bubble-received">
              <div className="flex gap-1 py-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* @ 提及面板 */}
      {showAtPanel && type === 'group' && (
        <div className="bg-white border-t shadow-lg max-h-64 overflow-y-auto">
          <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-white">
            <span className="text-sm font-medium text-gray-700">选择要 @ 的成员</span>
            <button onClick={() => setShowAtPanel(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleAt(member)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <Avatar name={member.nickname} color={member.avatar_color} size="sm" />
                <div className="text-left flex-1">
                  <div className="text-sm font-medium text-gray-800">{member.nickname}</div>
                  {member.role && member.role !== '普通成员' && (
                    <div className="text-xs text-blue-500">{member.role}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 - 固定在底部 */}
      <div className="bg-white border-t p-3 shrink-0">
        <div className="flex items-end gap-3">
          {/* 图片按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-gray-500 hover:text-[#12b7f5]"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          
          {/* @ 按钮（仅群聊） */}
          {type === 'group' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAtPanel(!showAtPanel)}
              className={`shrink-0 ${showAtPanel ? 'text-[#12b7f5] bg-blue-50' : 'text-gray-500 hover:text-[#12b7f5]'}`}
            >
              <AtSign className="w-5 h-5" />
            </Button>
          )}
          
          {/* 输入框 */}
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (按 Enter 发送)"
              rows={1}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:border-[#12b7f5] focus:ring-2 focus:ring-[#12b7f5]/20 resize-none text-base"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          
          {/* 发送按钮 */}
          <Button
            onClick={handleSend}
            disabled={!inputMessage.trim()}
            className="shrink-0 bg-[#12b7f5] hover:bg-[#0aa8e8] rounded-xl px-5"
          >
            <Send className="w-4 h-4 mr-1" />
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

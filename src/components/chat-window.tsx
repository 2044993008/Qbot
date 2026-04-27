'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMessages, useGroups } from '@/lib/hooks';
import { conversationsApi, messagesApi } from '@/lib/api';
import { Send, Image as ImageIcon, AtSign, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAuth } from '@/lib/auth-context';
import type { GroupMember, Message, SearchResult, User } from '@/lib/types';

interface ChatWindowProps {
  type: 'private' | 'group';
  targetId: number;
  targetName: string;
  targetAvatar?: string;
  onBack?: () => void;
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
          const response = await fetch(`/api/groups/members?group_id=${targetId}`);
          const data = await response.json();
          setMembers(data.members || []);
        } catch (error) {
          console.error('获取群成员失败:', error);
        }
      };
      loadMembers();
    }
  }, [type, targetId]);

  // 获取消息
  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      setHasMoreMessages(true);
    }
  }, [conversationId, fetchMessages]);

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
      const response = await fetch(`/api/messages?conversation_id=${conversationId}&before=${oldestMessage.id}&limit=20`);
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
      await sendMessage('text', content);

      // 模拟管家回复（通过动态获取的管家用户 ID 判断）
      if (botUser && targetId === botUser.id) {
        setTimeout(async () => {
          try {
            const response = await fetch('/api/bot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ message: content }),
            });
            const data = await response.json();
            
            if (data.response) {
              const botMessage: Message & { searchResults?: SearchResult[] } = {
                id: Date.now() + 1,
                conversation_id: conversationId,
                sender_id: botUser.id,
                sender_nickname: botUser.nickname || '小 Q 管家',
                sender_avatar: botUser.avatar_color || '#6366f1',
                type: 'text' as const,
                content: data.response,
                created_at: new Date().toISOString(),
                is_mine: false,
              };
              
              if (data.type === 'search_results' && data.results) {
                botMessage.searchResults = data.results as SearchResult[];
              }
              
              setMessages(prev => [...prev, botMessage]);
            }
          } catch (error) {
            console.error('管家回复失败:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
    } finally {
      setIsTyping(false);
    }
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

  // 渲染消息气泡
  const renderMessageBubble = (msg: Message, isMine: boolean) => (
    <div className={`message-bubble ${isMine ? 'message-bubble-sent' : 'message-bubble-received'}`}>
      {msg.type === 'image' ? (
        <img src={msg.content} alt="图片" className="max-w-full rounded-lg" />
      ) : (
        <div>
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          {/* AI 管家搜索结果 */}
          {msg.searchResults && msg.searchResults.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
              {msg.searchResults.slice(0, 5).map((result, idx) => (
                <div key={idx} className="bg-white/60 rounded-lg p-3 text-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-blue-600">{result.sender}</span>
                    {result.role && result.role !== '普通成员' && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">
                        {result.role}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{result.time}</span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{result.content}</p>
                </div>
              ))}
              {msg.searchResults.length > 5 && (
                <p className="text-xs text-gray-500 text-center py-1">
                  还有 {msg.searchResults.length - 5} 条消息...
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

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
              <div key={msg.id}>
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

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, BotResponse, SearchResult, BotPreviewAction } from '@/lib/types';
import { conversationsApi, messagesApi, momentsApi, botApi } from '@/lib/api';

// ============================================
// 消息渲染器类型定义
// ============================================

export interface MessageRendererProps {
  msg: Message;
  isMine: boolean;
  botUser?: { id: number; nickname: string; avatar_color: string } | null;
  conversationId: number | null;
  onConfirmAction?: (msg: Message) => void;
  onCancelAction?: (msg: Message) => void;
  fetchMessages?: () => void;
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
}

export type MessageRenderer = React.FC<MessageRendererProps>;

// ============================================
// 文本消息渲染器
// ============================================

export const TextMessageRenderer: MessageRenderer = ({ msg, isMine }) => {
  return (
    <div className={`message-bubble ${isMine ? 'message-bubble-sent' : 'message-bubble-received'}`}>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="whitespace-pre-wrap break-words m-0">{children}</p>,
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            ul: ({ children }) => <ul className="list-disc pl-4 my-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 my-1">{children}</ol>,
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">{children}</code>,
            pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">{children}</pre>,
            a: ({ href, children }) => <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
            h1: ({ children }) => <h1 className="text-lg font-bold my-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-bold my-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold my-1">{children}</h3>,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>,
            hr: () => <hr className="my-2 border-gray-200" />,
          }}
        >
          {msg.content}
        </ReactMarkdown>
        {msg.searchResults && msg.searchResults.length > 0 && (
          <SearchResultsRenderer results={msg.searchResults} />
        )}
      </div>
    </div>
  );
};

// ============================================
// 图片消息渲染器
// ============================================

export const ImageMessageRenderer: MessageRenderer = ({ msg }) => {
  return (
    <div className="message-bubble message-bubble-received">
      <img 
        src={msg.content} 
        alt="图片" 
        className="max-w-full rounded-lg" 
        onError={(e) => {
          // 图片加载失败时显示占位符
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfliqDovb3lm77niYc8L3RleHQ+PC9zdmc+';
        }}
      />
    </div>
  );
};

// ============================================
// 搜索结果渲染器
// ============================================

function SearchResultsRenderer({ results }: { results: SearchResult[] }) {
  return (
    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
      {results.slice(0, 5).map((result, idx) => (
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
      {results.length > 5 && (
        <p className="text-xs text-gray-500 text-center py-1">
          还有 {results.length - 5} 条消息...
        </p>
      )}
    </div>
  );
}

// ============================================
// 预览确认卡片渲染器
// ============================================

// 单个操作预览卡片
function PreviewActionCard({
  preview,
}: {
  preview: BotPreviewAction;
}) {
  const actionConfig = {
    send_message: { icon: '✉️', label: '代发消息', color: 'text-blue-600' },
    publish_moment: { icon: '📢', label: '发布空间动态', color: 'text-green-600' },
    generate_image: { icon: '🎨', label: '生成图片', color: 'text-purple-600' },
    generate_video: { icon: '🎬', label: '生成视频', color: 'text-pink-600' },
    delete_friend: { icon: '👤', label: '删除好友', color: 'text-red-600' },
    leave_group: { icon: '🚪', label: '退出群聊', color: 'text-orange-600' },
    edit_moment: { icon: '✏️', label: '编辑动态', color: 'text-blue-600' },
    delete_moment: { icon: '🗑️', label: '删除动态', color: 'text-red-600' },
  };

  const config = actionConfig[preview?.action as keyof typeof actionConfig] || { icon: '⚡', label: '执行操作', color: 'text-gray-600' };

  return (
    <div className="bg-white rounded-lg p-3 mb-2 border border-amber-200 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{config.icon}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white ${config.color}`}>
          {config.label}
        </span>
      </div>

      {preview?.target && (
        <div className="text-xs text-gray-500 mb-1">
          目标: <span className="font-medium text-gray-700">{preview.target}</span>
          {preview.target_type && ` (${preview.target_type === 'group' ? '群聊' : '好友'})`}
        </div>
      )}
      {preview?.friend_name && (
        <div className="text-xs text-gray-500 mb-1">
          好友: <span className="font-medium text-gray-700">{preview.friend_name}</span>
        </div>
      )}
      {preview?.group_name && (
        <div className="text-xs text-gray-500 mb-1">
          群聊: <span className="font-medium text-gray-700">{preview.group_name}</span>
        </div>
      )}

      <div className="mt-2">
        {preview?.action === 'edit_moment' && preview?.old_content && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">原内容</div>
            <div className="text-sm text-gray-500 line-through whitespace-pre-wrap break-words">{preview.old_content}</div>
            <div className="border-t border-gray-100 pt-2">
              <div className="text-xs text-gray-400">新内容</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{preview.new_content}</div>
            </div>
          </div>
        )}
        {preview?.action === 'delete_moment' && preview?.content && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{preview.content}</div>
        )}
        {(preview?.action === 'delete_friend' || preview?.action === 'leave_group') && (
          <div className="text-sm text-red-600 font-medium">
            {preview.action === 'delete_friend' ? '确认从好友列表中移除？' : '确认退出该群聊？'}
          </div>
        )}
        {!['edit_moment', 'delete_moment', 'delete_friend', 'leave_group'].includes(preview?.action || '') && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap break-words font-mono">
            {preview?.content || preview?.prompt}
          </div>
        )}
        {preview?.image_urls && preview.image_urls.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            附带 {preview.image_urls.length} 张图片
          </div>
        )}
      </div>
    </div>
  );
}

export const PreviewMessageRenderer: MessageRenderer = ({
  msg,
  botUser,
  conversationId,
  onConfirmAction,
  onCancelAction,
}) => {
  const preview = msg.metadata?.preview as BotResponse['preview'];
  if (!preview) {
    return null;
  }

  // 支持 { actions: [...] } 格式（多步骤 Agent 编排返回）
  const actions: BotPreviewAction[] = 'actions' in preview && Array.isArray((preview as Record<string, unknown>).actions)
    ? (preview as { actions: BotPreviewAction[] }).actions
    : [preview as BotPreviewAction];

  return (
    <div className="message-bubble message-bubble-received bg-amber-50 border-2 border-amber-300 shadow-md max-w-[85%]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
        <span className="text-lg">⚡</span>
        <span className="font-bold text-gray-800 text-sm">AI管家 请求确认</span>
        {actions.length > 1 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white text-gray-600">
            共 {actions.length} 项操作
          </span>
        )}
      </div>

      {actions.map((action, index) => (
        <PreviewActionCard key={index} preview={action} />
      ))}

      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          onClick={() => onConfirmAction?.(msg)}
          disabled={!!msg.metadata?.isExecuting}
          className="bg-[#12b7f5] hover:bg-[#0aa8e8] text-white font-medium px-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {msg.metadata?.isExecuting ? '执行中...' : (actions.length > 1 ? '全部确认执行' : '确认执行')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCancelAction?.(msg)}
          disabled={!!msg.metadata?.isExecuting}
          className="border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          取消
        </Button>
      </div>
    </div>
  );
};

// ============================================
// 系统消息渲染器
// ============================================

export const SystemMessageRenderer: MessageRenderer = ({ msg }) => {
  return (
    <div className="flex justify-center my-2">
      <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
        {msg.content}
      </span>
    </div>
  );
};

// ============================================
// 正在输入指示器渲染器
// ============================================

export const TypingIndicatorRenderer: MessageRenderer = ({ botUser }) => {
  return (
    <div className="message-bubble message-bubble-received">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-gray-500">{botUser?.nickname || 'AI管家'} 正在思考...</span>
      </div>
    </div>
  );
};

// ============================================
// 渲染器注册表
// ============================================

export const messageRenderers: Record<string, MessageRenderer> = {
  text: TextMessageRenderer,
  image: ImageMessageRenderer,
  file: TextMessageRenderer,
  system: SystemMessageRenderer,
  preview: PreviewMessageRenderer,
  typing: TypingIndicatorRenderer,
};

// 根据消息类型获取渲染器
export function getMessageRenderer(msg: Message): MessageRenderer {
  if (msg.metadata?.isPreview) {
    return messageRenderers.preview;
  }
  if (msg.type === 'system') {
    return messageRenderers.system;
  }
  if (msg.metadata?.isTyping) {
    return messageRenderers.typing;
  }
  return messageRenderers[msg.type] || messageRenderers.text;
}

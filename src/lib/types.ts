// 用户类型
export interface User {
  id: number;
  qq_number: string;
  nickname: string;
  avatar_color: string;
  signature: string;
  status: 'online' | 'offline' | 'busy';
  last_seen?: string;
  created_at?: string;
  remark?: string;
}

// 好友类型
export interface Friend extends User {
  remark?: string;
}

// 群组类型
export interface Group {
  id: number;
  name: string;
  avatar_color: string;
  description?: string;
  member_count?: number;
}

// 群成员类型
export interface GroupMember extends User {
  role: string;
  joined_at?: string;
}

// 会话类型
export interface Conversation {
  id: number;
  type: 'private' | 'group';
  user_id: number;
  target_id: number;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  target_name?: string;
  target_avatar?: string;
  target_status?: string;
  // 关联数据
  group?: {
    id: number;
    name: string;
    description?: string;
    avatar_color?: string;
    member_count?: number;
  };
  target_user?: {
    id: number;
    nickname: string;
    avatar_color?: string;
    signature?: string;
    status?: string;
  };
}

// 消息类型
export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_nickname?: string;
  sender_avatar?: string;
  type: 'text' | 'image' | 'file' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  is_mine?: boolean;
  // AI 管家搜索结果
  searchResults?: SearchResult[];
}

// AI 管家搜索结果
export interface SearchResult {
  sender: string;
  role?: string;
  content: string;
  time: string;
  isLong?: boolean;
  fullContent?: string;
}

// 空间动态类型
export interface Moment {
  id: number;
  user_id: number;
  publisher_nickname?: string;
  publisher_avatar?: string;
  content: string;
  images?: string[];
  like_count: number;
  comment_count: number;
  is_liked?: boolean;
  comments?: MomentComment[];
  created_at: string;
}

// 动态评论类型
export interface MomentComment {
  id: number;
  moment_id: number;
  user_id: number;
  user_nickname?: string;
  user_avatar?: string;
  content: string;
  created_at: string;
}

// 管家响应类型
export interface BotResponse {
  response: string;
  type: 'text' | 'search_results' | 'preview' | 'polished_text';
  results?: SearchResult[];
  preview?: {
    content: string;
    receiver?: string;
    emojis?: string[];
    isMoment?: boolean;
  };
  content?: string;
  groupName?: string;
}

// API 响应类型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: User;
}

// 消息预览
export interface MessagePreview {
  id: number;
  content: string;
  type: string;
  created_at: string;
}

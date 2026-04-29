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
  friendship_created_at?: string;
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
    action: 'send_message' | 'publish_moment' | 'generate_image' | 'generate_video' | 'delete_friend' | 'leave_group' | 'edit_moment' | 'delete_moment';
    content?: string;
    target?: string;
    target_type?: 'friend' | 'group';
    target_id?: number;
    conversation_id?: number;
    receiver?: string;
    emojis?: string[];
    isMoment?: boolean;
    prompt?: string;
    style?: string;
    duration?: number;
    image_url?: string;
    image_urls?: string[];
    // 新增：社交管理操作字段
    friend_id?: number;
    friend_name?: string;
    group_id?: number;
    group_name?: string;
    moment_id?: number;
    old_content?: string;
    new_content?: string;
    new_images?: string[];
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

// 定时任务类型
export interface ScheduledTask {
  id: number;
  user_id: number;
  name: string;
  description: string;
  cron_expression: string;
  task_type: 'reminder' | 'send_message' | 'post_moment';
  config: Record<string, unknown>;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
}

// 任务执行日志类型
export interface TaskExecutionLog {
  id: number;
  task_id: number;
  status: 'running' | 'success' | 'failed';
  output: string;
  error_message: string;
  started_at: string;
  completed_at?: string;
}

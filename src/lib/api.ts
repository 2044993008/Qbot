import type { User, Friend, Group, GroupMember, Conversation, Message, Moment, BotResponse, MessagePreview } from './types';

const API_BASE = '/api';
const TOKEN_KEY = 'qq_token';

// 获取 token（优先从 localStorage 获取）
function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // 合并自定义 headers
  if (options.headers) {
    const customHeaders = options.headers as Record<string, string>;
    Object.assign(headers, customHeaders);
  }
  
  // 如果有 token，添加到 Authorization header
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

// 认证 API
export const authApi = {
  login: (qq_number: string, password: string) =>
    request<{ token: string; user: User; success: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ qq_number, password }),
    }),

  register: (qq_number: string, nickname: string, password: string) =>
    request<{ token: string; user: User; success: boolean }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ qq_number, nickname, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  verify: () =>
    request<{ authenticated: boolean; user?: User }>('/auth/verify'),
};

// 用户 API
export const userApi = {
  getProfile: () =>
    request<{ user: User }>('/user'),

  updateProfile: (data: Partial<User>) =>
    request<{ user: User }>('/user', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// 好友 API
export const friendsApi = {
  getList: () =>
    request<{ friends: Friend[] }>('/friends'),

  getDetail: (friendId: number) =>
    request<{ friend: Friend; recentMessages: MessagePreview[] }>(`/friends/${friendId}`),

  updateRemark: (friendId: number, remark: string) =>
    request<{ success: boolean }>(`/friends/${friendId}`, {
      method: 'PUT',
      body: JSON.stringify({ friend_id: friendId, remark }),
    }),
};

// 会话 API
export const conversationsApi = {
  getList: () =>
    request<{ conversations: Conversation[] }>('/conversations'),

  getDetail: (conversationId: number) =>
    request<{ conversation: Conversation }>(`/conversations/${conversationId}`),

  getOrCreate: (type: 'private' | 'group', targetId: number) =>
    request<{ conversation: Conversation }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ type, target_id: targetId }),
    }),
};

// 消息 API
export const messagesApi = {
  getList: (conversationId: number, limit = 50, offset = 0) =>
    request<{ messages: Message[] }>(
      `/messages?conversation_id=${conversationId}&limit=${limit}&offset=${offset}`
    ),

  send: (conversationId: number, type: string, content: string, metadata?: Record<string, unknown>) =>
    request<{ message: Message }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, type, content, metadata }),
    }),
};

// 群组 API
export const groupsApi = {
  getList: () =>
    request<{ groups: Group[] }>('/groups'),

  getMembers: (groupId: number) =>
    request<{ members: GroupMember[] }>(`/groups/members?group_id=${groupId}`),
};

// 动态 API
export const momentsApi = {
  getList: (userId?: number, limit = 20, offset = 0) =>
    request<{ moments: Moment[] }>(
      `/moments${userId ? `?user_id=${userId}&` : '?'}limit=${limit}&offset=${offset}`
    ),

  publish: (content: string, images?: string[]) =>
    request<{ moment: Moment }>('/moments', {
      method: 'POST',
      body: JSON.stringify({ content, images }),
    }),

  like: (momentId: number) =>
    request<{ liked: boolean }>('/moments/like', {
      method: 'POST',
      body: JSON.stringify({ moment_id: momentId }),
    }),

  comment: (momentId: number, content: string) =>
    request<{ comment: import('./types').MomentComment }>('/moments/comment', {
      method: 'POST',
      body: JSON.stringify({ moment_id: momentId, content }),
    }),
};

// 管家 API
export const botApi = {
  send: (message: string, context?: unknown) =>
    request<BotResponse>('/bot', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),

  getConfig: () =>
    request<{ bot: User | null; name: string }>('/bot'),
};

// 设置 API
export const settingsApi = {
  get: (key?: string) =>
    request<{ settings?: unknown[]; key?: string; value?: string }>(
      key ? `/settings?key=${key}` : '/settings'
    ),

  update: (key: string, value: string) =>
    request<{ success: boolean }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    }),
};

// 上传 API
export const uploadApi = {
  image: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    // 获取本地存储的 token
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('qq_token') : null;
    const headers: HeadersInit = {};
    if (localToken) {
      headers['Authorization'] = `Bearer ${localToken}`;
    }

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '上传失败' }));
      throw new Error(error.error || '上传失败');
    }

    return response.json();
  },
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useConversations,
  useFriends,
  useGroups,
  useMessages,
  useMoments,
  useTasks,
} from '@/lib/hooks';
import type { Conversation, Friend, Group, Message, Moment, ScheduledTask } from '@/lib/types';

// Mock APIs
vi.mock('@/lib/api', () => ({
  conversationsApi: {
    getList: vi.fn(),
    getOrCreate: vi.fn(),
  },
  friendsApi: {
    getList: vi.fn(),
    getDetail: vi.fn(),
    updateRemark: vi.fn(),
  },
  groupsApi: {
    getList: vi.fn(),
    getMembers: vi.fn(),
  },
  messagesApi: {
    getList: vi.fn(),
    send: vi.fn(),
  },
  momentsApi: {
    getList: vi.fn(),
    publish: vi.fn(),
    like: vi.fn(),
    comment: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  tasksApi: {
    getList: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock socket client
vi.mock('@/lib/socket-client', () => ({
  joinConversation: vi.fn(),
  leaveConversation: vi.fn(),
  onNewMessage: vi.fn(),
  offNewMessage: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  conversationsApi,
  friendsApi,
  groupsApi,
  messagesApi,
  momentsApi,
  tasksApi,
} from '@/lib/api';
import { joinConversation, leaveConversation, onNewMessage, offNewMessage } from '@/lib/socket-client';

const mockConversations: Conversation[] = [
  {
    id: 1,
    type: 'private',
    user_id: 1,
    target_id: 2,
    target_name: '张小明',
    last_message: '你好',
    last_message_time: '2024-01-01T10:00:00Z',
    unread_count: 2,
  },
  {
    id: 2,
    type: 'group',
    user_id: 1,
    target_id: 3,
    target_name: '班级群',
    last_message: '大家早上好',
    last_message_time: '2024-01-01T09:00:00Z',
    unread_count: 0,
  },
];

const mockFriends: Friend[] = [
  { id: 1, qq_number: '10002', nickname: '张小明', avatar_color: '#ff0000', signature: 'Hello', status: 'online', remark: '小明' },
  { id: 2, qq_number: '10003', nickname: '小 Q 管家', avatar_color: '#12b7f5', signature: 'AI助手', status: 'online' },
];

const mockGroups: Group[] = [
  { id: 1, name: '班级群', avatar_color: '#00ff00', member_count: 30 },
];

const mockMessages: Message[] = [
  { id: 1, conversation_id: 1, sender_id: 1, sender_nickname: '我', type: 'text', content: '你好', created_at: '2024-01-01T10:00:00Z' },
  { id: 2, conversation_id: 1, sender_id: 2, sender_nickname: '张小明', type: 'text', content: '你好呀', created_at: '2024-01-01T10:01:00Z' },
];

const mockMoments: Moment[] = [
  { id: 1, user_id: 1, publisher_nickname: '我', content: '今天天气真好', like_count: 5, comment_count: 2, is_liked: false, created_at: '2024-01-01T08:00:00Z' },
];

const mockTasks: ScheduledTask[] = [
  { id: 1, user_id: 1, name: '每日提醒', description: '每天早上提醒', cron_expression: '0 9 * * *', task_type: 'reminder', config: {}, enabled: true, created_at: '2024-01-01T00:00:00Z' },
];

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns conversations', async () => {
    vi.mocked(conversationsApi.getList).mockResolvedValue({ conversations: mockConversations });

    const { result } = renderHook(() => useConversations());

    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.fetchConversations();
    });

    await waitFor(() => {
      expect(result.current.conversations).toEqual(mockConversations);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('handles fetch error gracefully', async () => {
    vi.mocked(conversationsApi.getList).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useConversations());

    await act(async () => {
      await result.current.fetchConversations();
    });

    await waitFor(() => {
      expect(result.current.conversations).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('creates or gets a conversation', async () => {
    const newConv: Conversation = { id: 3, type: 'private', user_id: 1, target_id: 5, target_name: '李华' };
    vi.mocked(conversationsApi.getOrCreate).mockResolvedValue({ conversation: newConv });
    vi.mocked(conversationsApi.getList).mockResolvedValue({ conversations: [...mockConversations, newConv] });

    const { result } = renderHook(() => useConversations());

    const conv = await act(async () => {
      return await result.current.getOrCreateConversation('private', 5);
    });

    expect(conv).toEqual(newConv);
    expect(conversationsApi.getOrCreate).toHaveBeenCalledWith('private', 5);
  });
});

describe('useFriends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns friends', async () => {
    vi.mocked(friendsApi.getList).mockResolvedValue({ friends: mockFriends });

    const { result } = renderHook(() => useFriends());

    await act(async () => {
      await result.current.fetchFriends();
    });

    await waitFor(() => {
      expect(result.current.friends).toEqual(mockFriends);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('handles fetch error gracefully', async () => {
    vi.mocked(friendsApi.getList).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFriends());

    await act(async () => {
      await result.current.fetchFriends();
    });

    await waitFor(() => {
      expect(result.current.friends).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe('useGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns groups', async () => {
    vi.mocked(groupsApi.getList).mockResolvedValue({ groups: mockGroups });

    const { result } = renderHook(() => useGroups());

    await act(async () => {
      await result.current.fetchGroups();
    });

    await waitFor(() => {
      expect(result.current.groups).toEqual(mockGroups);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('fetches group members', async () => {
    const members = [{ id: 1, qq_number: '10001', nickname: '我', avatar_color: '#0000ff', signature: '', status: 'online', role: '班长' }];
    vi.mocked(groupsApi.getMembers).mockResolvedValue({ members });

    const { result } = renderHook(() => useGroups());

    const res = await act(async () => {
      return await result.current.getMembers(1);
    });

    expect(res).toEqual(members);
    expect(groupsApi.getMembers).toHaveBeenCalledWith(1);
  });
});

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch messages when conversationId is null', async () => {
    const { result } = renderHook(() => useMessages(null));

    await act(async () => {
      await result.current.fetchMessages();
    });

    expect(messagesApi.getList).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('fetches messages when conversationId is provided', async () => {
    vi.mocked(messagesApi.getList).mockResolvedValue({ messages: mockMessages });

    const { result } = renderHook(() => useMessages(1));

    await waitFor(() => {
      expect(messagesApi.getList).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual(mockMessages);
    });
  });

  it('sends a message and updates state', async () => {
    const newMessage: Message = { id: 3, conversation_id: 1, sender_id: 1, type: 'text', content: '新消息', created_at: '2024-01-01T10:02:00Z' };
    vi.mocked(messagesApi.getList).mockResolvedValue({ messages: mockMessages });
    vi.mocked(messagesApi.send).mockResolvedValue({ message: newMessage });

    const { result } = renderHook(() => useMessages(1));

    await waitFor(() => expect(result.current.messages).toEqual(mockMessages));

    await act(async () => {
      await result.current.sendMessage('text', '新消息');
    });

    await waitFor(() => {
      expect(result.current.messages).toContainEqual(newMessage);
    });
  });

  it('joins and leaves conversation via WebSocket', async () => {
    vi.mocked(messagesApi.getList).mockResolvedValue({ messages: [] });

    const { unmount } = renderHook(() => useMessages(1));

    await waitFor(() => {
      expect(joinConversation).toHaveBeenCalledWith(1);
    });

    unmount();

    expect(leaveConversation).toHaveBeenCalledWith(1);
  });
});

describe('useMoments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches moments', async () => {
    vi.mocked(momentsApi.getList).mockResolvedValue({ moments: mockMoments });

    const { result } = renderHook(() => useMoments());

    await act(async () => {
      await result.current.fetchMoments();
    });

    await waitFor(() => {
      expect(result.current.moments).toEqual(mockMoments);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('publishes a moment and prepends to list', async () => {
    const newMoment: Moment = { id: 2, user_id: 1, content: '新动态', like_count: 0, comment_count: 0, created_at: '2024-01-02T00:00:00Z' };
    vi.mocked(momentsApi.getList).mockResolvedValue({ moments: mockMoments });
    vi.mocked(momentsApi.publish).mockResolvedValue({ moment: newMoment });

    const { result } = renderHook(() => useMoments());

    await act(async () => {
      await result.current.fetchMoments();
    });

    await act(async () => {
      await result.current.publishMoment('新动态');
    });

    await waitFor(() => {
      expect(result.current.moments[0]).toEqual(newMoment);
      expect(result.current.moments).toHaveLength(2);
    });
  });

  it('toggles like on a moment', async () => {
    vi.mocked(momentsApi.getList).mockResolvedValue({ moments: mockMoments });
    vi.mocked(momentsApi.like).mockResolvedValue({ liked: true });

    const { result } = renderHook(() => useMoments());

    await act(async () => {
      await result.current.fetchMoments();
    });

    await act(async () => {
      await result.current.likeMoment(1);
    });

    await waitFor(() => {
      expect(result.current.moments[0].is_liked).toBe(true);
      expect(result.current.moments[0].like_count).toBe(6);
    });
  });

  it('comments on a moment', async () => {
    const comment = { id: 1, moment_id: 1, user_id: 1, user_nickname: '我', content: '赞', created_at: '2024-01-01T09:00:00Z' };
    vi.mocked(momentsApi.getList).mockResolvedValue({ moments: mockMoments });
    vi.mocked(momentsApi.comment).mockResolvedValue({ comment });

    const { result } = renderHook(() => useMoments());

    await act(async () => {
      await result.current.fetchMoments();
    });

    await act(async () => {
      await result.current.commentMoment(1, '赞');
    });

    await waitFor(() => {
      expect(result.current.moments[0].comment_count).toBe(3);
      expect(result.current.moments[0].comments).toContainEqual(comment);
    });
  });

  it('deletes a moment', async () => {
    vi.mocked(momentsApi.getList).mockResolvedValue({ moments: mockMoments });
    vi.mocked(momentsApi.delete).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useMoments());

    await act(async () => {
      await result.current.fetchMoments();
    });

    await act(async () => {
      await result.current.deleteMoment(1);
    });

    await waitFor(() => {
      expect(result.current.moments).toHaveLength(0);
    });
  });
});

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tasks', async () => {
    vi.mocked(tasksApi.getList).mockResolvedValue({ tasks: mockTasks });

    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.fetchTasks();
    });

    await waitFor(() => {
      expect(result.current.tasks).toEqual(mockTasks);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('creates a task and prepends to list', async () => {
    const newTask: ScheduledTask = { id: 2, user_id: 1, name: '新任务', description: '测试', cron_expression: '0 0 * * *', task_type: 'reminder', config: {}, enabled: false, created_at: '2024-01-02T00:00:00Z' };
    vi.mocked(tasksApi.getList).mockResolvedValue({ tasks: mockTasks });
    vi.mocked(tasksApi.create).mockResolvedValue({ task: newTask });

    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.fetchTasks();
    });

    await act(async () => {
      await result.current.createTask({
        name: '新任务',
        description: '测试',
        cron_expression: '0 0 * * *',
        task_type: 'reminder',
        config: {},
        enabled: false,
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]).toEqual(newTask);
      expect(result.current.tasks).toHaveLength(2);
    });
  });

  it('deletes a task', async () => {
    vi.mocked(tasksApi.getList).mockResolvedValue({ tasks: mockTasks });
    vi.mocked(tasksApi.delete).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useTasks());

    await act(async () => {
      await result.current.fetchTasks();
    });

    await act(async () => {
      await result.current.deleteTask(1);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0);
    });
  });
});

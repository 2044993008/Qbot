import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppPage from '@/app/app/page';
import ChatList from '@/components/chat-list';

const mockPush = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
  }),
}));

// Mock auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      nickname: 'DemoUser',
      avatar_color: '#3b82f6',
      qq_number: '10001',
      status: 'online',
      signature: 'Hello',
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// Mock hooks
vi.mock('@/lib/hooks', () => ({
  useConversations: vi.fn(() => ({
    conversations: [
      {
        id: 1,
        type: 'private',
        user_id: 1,
        target_id: 2,
        target_name: '张小明',
        target_avatar: '#ff0000',
        target_status: 'online',
        last_message: '你好',
        last_message_time: '2024-01-01T10:00:00Z',
        unread_count: 2,
      },
      {
        id: 3,
        type: 'group',
        user_id: 1,
        target_id: 1,
        target_name: '班级群',
        target_avatar: '#00ff00',
        last_message: '大家早上好',
        last_message_time: '2024-01-01T09:00:00Z',
        unread_count: 0,
      },
    ],
    isLoading: false,
    fetchConversations: vi.fn(),
    getOrCreateConversation: vi.fn(),
  })),
  useFriends: vi.fn(() => ({
    friends: [
      { id: 1, qq_number: '10002', nickname: '张小明', avatar_color: '#ff0000', signature: 'Hello', status: 'online', remark: '小明' },
      { id: 2, qq_number: '10003', nickname: '小 Q 管家', avatar_color: '#12b7f5', signature: 'AI助手', status: 'online' },
    ],
    isLoading: false,
    fetchFriends: vi.fn(),
  })),
  useGroups: vi.fn(() => ({
    groups: [
      { id: 1, name: '班级群', avatar_color: '#00ff00', member_count: 30 },
    ],
    isLoading: false,
    fetchGroups: vi.fn(),
    getMembers: vi.fn(),
  })),
  useMessages: vi.fn(() => ({
    messages: [],
    isLoading: false,
    fetchMessages: vi.fn(),
    sendMessage: vi.fn(),
    setMessages: vi.fn(),
  })),
}));

// Mock ChatWindow to detect if it renders
vi.mock('@/components/chat-window', () => ({
  default: (props: { targetName: string }) => (
    <div data-testid="chat-window" data-target-name={props.targetName}>
      ChatWindow: {props.targetName}
    </div>
  ),
}));

// Do NOT mock ChatList - we need to test the real component's router.push behavior

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5分钟前',
  format: () => '10:00',
  isToday: () => true,
  isYesterday: () => false,
  isSameDay: () => true,
}));

vi.mock('date-fns/locale', () => ({
  zhCN: {},
}));

// Mock Avatar
vi.mock('@/components/avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid={`avatar-${name}`}>{name}</div>,
}));

// Mock Sidebar (used by layout, not by AppPage directly)
vi.mock('@/components/sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
  MobileNav: () => <div data-testid="mobile-nav">MobileNav</div>,
}));

describe('Dual Chat Routing Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('/app page renders ChatList and not ChatWindow', () => {
    render(<AppPage />);

    // ChatList renders search input, tabs, and conversation items
    expect(screen.getByPlaceholderText('搜索')).toBeInTheDocument();
    expect(screen.getByText('聊天')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-window')).not.toBeInTheDocument();
  });

  it('ChatList navigates to /app/chat/:conversationId when conversation is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelectChat = vi.fn();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const conversationItem = screen.getAllByTestId('conversation-item')[0];
    await user.click(conversationItem);

    expect(mockPush).toHaveBeenCalledWith('/app/chat/1');
    expect(mockOnSelectChat).toHaveBeenCalledWith('private', 1, '张小明', '#ff0000');
  });

  it('ChatList navigates to /app/chat/:friendId when friend is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelectChat = vi.fn();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    // 小明 is the first friend after bot (张小明)
    const friendItems = screen.getAllByTestId('avatar-小明');
    const friendItem = friendItems[0].closest('div[class*="cursor-pointer"]')
      || friendItems[0].closest('div');
    if (friendItem) await user.click(friendItem);

    expect(mockPush).toHaveBeenCalledWith('/app/chat/1');
    expect(mockOnSelectChat).toHaveBeenCalledWith('private', 1, '小明', '#ff0000');
  });

  it('ChatList navigates to /app/chat/:groupId when group is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelectChat = vi.fn();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const groupsTab = screen.getByText('群聊');
    await user.click(groupsTab);

    const groupItems = screen.getAllByTestId('avatar-班级群');
    const groupItem = groupItems[0].closest('div[class*="cursor-pointer"]')
      || groupItems[0].closest('div');
    if (groupItem) await user.click(groupItem);

    expect(mockPush).toHaveBeenCalledWith('/app/chat/1');
    expect(mockOnSelectChat).toHaveBeenCalledWith('group', 1, '班级群', '#00ff00');
  });

  it('ChatList navigates to /app/chat/:botId when bot friend is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelectChat = vi.fn();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    const botItems = screen.getAllByTestId('avatar-小 Q 管家');
    const botItem = botItems[0].closest('div[class*="cursor-pointer"]')
      || botItems[0].closest('div');
    if (botItem) await user.click(botItem);

    expect(mockPush).toHaveBeenCalledWith('/app/chat/2');
    expect(mockOnSelectChat).toHaveBeenCalledWith('private', 2, '小 Q 管家', '#12b7f5');
  });
});

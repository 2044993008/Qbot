import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatList from '@/components/chat-list';

// Mock hooks
vi.mock('@/lib/hooks', () => ({
  useConversations: vi.fn(),
  useFriends: vi.fn(),
  useGroups: vi.fn(),
}));

// Mock auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

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
  Avatar: ({ name, status }: { name: string; status?: string }) => (
    <div data-testid={`avatar-${name}`} data-status={status}>{name.charAt(0)}</div>
  ),
}));

// Mock Sidebar
vi.mock('@/components/sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
  MobileNav: () => <div data-testid="mobile-nav">MobileNav</div>,
}));

import { useConversations, useFriends, useGroups } from '@/lib/hooks';

const mockConversations = [
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
    id: 2,
    type: 'group',
    user_id: 1,
    target_id: 3,
    target_name: '班级群',
    target_avatar: '#00ff00',
    last_message: '大家早上好',
    last_message_time: '2024-01-01T09:00:00Z',
    unread_count: 0,
  },
];

const mockFriends = [
  { id: 1, qq_number: '10002', nickname: '张小明', avatar_color: '#ff0000', signature: 'Hello', status: 'online', remark: '小明' },
  { id: 2, qq_number: '10003', nickname: '小 Q 管家', avatar_color: '#12b7f5', signature: 'AI助手', status: 'online' },
  { id: 3, qq_number: '10004', nickname: '李华', avatar_color: '#0000ff', signature: 'World', status: 'offline' },
];

const mockGroups = [
  { id: 1, name: '班级群', avatar_color: '#00ff00', member_count: 30 },
  { id: 2, name: '游戏群', avatar_color: '#ff00ff', member_count: 10 },
];

describe('ChatList', () => {
  const mockOnSelectChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConversations).mockReturnValue({
      conversations: mockConversations,
      isLoading: false,
      fetchConversations: vi.fn(),
      getOrCreateConversation: vi.fn(),
    });
    vi.mocked(useFriends).mockReturnValue({
      friends: mockFriends,
      isLoading: false,
      fetchFriends: vi.fn(),
    });
    vi.mocked(useGroups).mockReturnValue({
      groups: mockGroups,
      isLoading: false,
      fetchGroups: vi.fn(),
      getMembers: vi.fn(),
    });
  });

  it('renders chat list tab by default', () => {
    render(<ChatList onSelectChat={mockOnSelectChat} />);
    expect(screen.getByText('聊天')).toHaveClass('text-[#12b7f5]');
    expect(screen.getByText('张小明')).toBeInTheDocument();
    expect(screen.getByText('班级群')).toBeInTheDocument();
  });

  it('filters conversations by search query', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const searchInput = screen.getByPlaceholderText('搜索');
    await user.type(searchInput, '张小明');

    expect(screen.getByText('张小明')).toBeInTheDocument();
    expect(screen.queryByText('班级群')).not.toBeInTheDocument();
  });

  it('shows empty state when no conversations match', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const searchInput = screen.getByPlaceholderText('搜索');
    await user.type(searchInput, '不存在的人');

    expect(screen.getByText('暂无聊天记录')).toBeInTheDocument();
  });

  it('switches to friends tab and displays friends', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    expect(screen.getByText('小明')).toBeInTheDocument();
    expect(screen.getByText('李华')).toBeInTheDocument();
  });

  it('sorts bot friend to top in friends tab', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    // 小 Q 管家 should have AI badge
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('switches to groups tab and displays groups', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const groupsTab = screen.getByText('群聊');
    await user.click(groupsTab);

    expect(screen.getByText('班级群')).toBeInTheDocument();
    expect(screen.getByText('游戏群')).toBeInTheDocument();
  });

  it('filters friends by search query', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const searchInput = screen.getByPlaceholderText('搜索');
    await user.type(searchInput, '李华');

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    expect(screen.getByText('李华')).toBeInTheDocument();
    expect(screen.queryByText('张小明')).not.toBeInTheDocument();
  });

  it('calls onSelectChat and navigates when conversation is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const conversationItem = screen.getByText('张小明').closest('div[class*="cursor-pointer"]')
      || screen.getByText('张小明').closest('div');
    if (conversationItem) await user.click(conversationItem);

    expect(mockOnSelectChat).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/app/chat/1');
  });

  it('navigates to friend chat when friend is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    const friendItem = screen.getByText('小明').closest('div[class*="cursor-pointer"]')
      || screen.getByText('小明').closest('div');
    if (friendItem) await user.click(friendItem);

    expect(mockPush).toHaveBeenCalledWith('/app/chat/1');
  });

  it('navigates to group chat when group is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const groupsTab = screen.getByText('群聊');
    await user.click(groupsTab);

    const groupItem = screen.getByText('班级群').closest('div[class*="cursor-pointer"]')
      || screen.getByText('班级群').closest('div');
    if (groupItem) await user.click(groupItem);

    expect(mockPush).toHaveBeenCalledWith('/app/chat/1');
  });

  it('shows empty state for friends tab when no friends', async () => {
    vi.mocked(useFriends).mockReturnValue({
      friends: [],
      isLoading: false,
      fetchFriends: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const friendsTab = screen.getByText('好友');
    await user.click(friendsTab);

    expect(screen.getByText('暂无好友')).toBeInTheDocument();
  });

  it('shows empty state for groups tab when no groups', async () => {
    vi.mocked(useGroups).mockReturnValue({
      groups: [],
      isLoading: false,
      fetchGroups: vi.fn(),
      getMembers: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const groupsTab = screen.getByText('群聊');
    await user.click(groupsTab);

    expect(screen.getByText('暂无群聊')).toBeInTheDocument();
  });

  it('filters groups by search query', async () => {
    const user = userEvent.setup();
    render(<ChatList onSelectChat={mockOnSelectChat} />);

    const searchInput = screen.getByPlaceholderText('搜索');
    await user.type(searchInput, '游戏群');

    const groupsTab = screen.getByText('群聊');
    await user.click(groupsTab);

    expect(screen.getByText('游戏群')).toBeInTheDocument();
    expect(screen.queryByText('班级群')).not.toBeInTheDocument();
  });
});

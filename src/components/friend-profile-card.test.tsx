import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FriendProfileCard } from '@/components/friend-profile-card';

// Mock API
vi.mock('@/lib/api', () => ({
  friendsApi: {
    getDetail: vi.fn(),
    updateRemark: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '1年前',
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

import { friendsApi } from '@/lib/api';

const mockFriend = {
  id: 1,
  qq_number: '10002',
  nickname: '张小明',
  avatar_color: '#ff0000',
  signature: '热爱生活',
  status: 'online' as const,
  remark: '小明',
  friendship_created_at: '2023-01-01T00:00:00Z',
};

const mockRecentMessages = [
  { id: 1, content: '最近的消息1', type: 'text', created_at: '2024-01-01T10:00:00Z' },
  { id: 2, content: '最近的消息2', type: 'text', created_at: '2024-01-01T09:00:00Z' },
];

describe('FriendProfileCard', () => {
  const mockOnClose = vi.fn();
  const mockOnStartChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(friendsApi.getDetail).mockResolvedValue({
      friend: mockFriend,
      recentMessages: mockRecentMessages,
    });
  });

  it('renders loading state initially', () => {
    vi.mocked(friendsApi.getDetail).mockImplementation(() => new Promise(() => {}));
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders friend data after loading', async () => {
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('小明')).toBeInTheDocument();
    });

    expect(screen.getByText('QQ 10002')).toBeInTheDocument();
    expect(screen.getByText('热爱生活')).toBeInTheDocument();
    expect(screen.getByText('在线')).toBeInTheDocument();
  });

  it('renders remark when available', async () => {
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText(/备注：小明/)).toBeInTheDocument();
    });
  });

  it('renders recent messages', async () => {
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('最近聊天')).toBeInTheDocument();
      expect(screen.getByText('最近的消息1')).toBeInTheDocument();
      expect(screen.getByText('最近的消息2')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('小明')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: '' });
    await user.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('小明')).toBeInTheDocument();
    });

    const backdrop = screen.getByText('小明').closest('.fixed');
    if (backdrop) await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onStartChat when chat button is clicked', async () => {
    const user = userEvent.setup();
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('发消息')).toBeInTheDocument();
    });

    const chatBtn = screen.getByText('发消息');
    await user.click(chatBtn);

    expect(mockOnStartChat).toHaveBeenCalledWith(1);
  });

  it('enters remark editing mode when remark is clicked', async () => {
    const user = userEvent.setup();
    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText(/备注：小明/)).toBeInTheDocument();
    });

    const remarkArea = screen.getByText(/备注：小明/);
    await user.click(remarkArea);

    expect(screen.getByPlaceholderText('设置备注名')).toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
  });

  it('saves remark when save button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(friendsApi.updateRemark).mockResolvedValue({ success: true });

    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText(/备注：小明/)).toBeInTheDocument();
    });

    const remarkArea = screen.getByText(/备注：小明/);
    await user.click(remarkArea);

    const input = screen.getByPlaceholderText('设置备注名');
    await user.clear(input);
    await user.type(input, '新备注');

    const saveBtn = screen.getByText('保存');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(friendsApi.updateRemark).toHaveBeenCalledWith(1, '新备注');
    });
  });

  it('renders offline status correctly', async () => {
    vi.mocked(friendsApi.getDetail).mockResolvedValue({
      friend: { ...mockFriend, status: 'offline' as const },
      recentMessages: [],
    });

    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('离线')).toBeInTheDocument();
    });
  });

  it('renders busy status correctly', async () => {
    vi.mocked(friendsApi.getDetail).mockResolvedValue({
      friend: { ...mockFriend, status: 'busy' as const },
      recentMessages: [],
    });

    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('忙碌')).toBeInTheDocument();
    });
  });

  it('renders default signature when empty', async () => {
    vi.mocked(friendsApi.getDetail).mockResolvedValue({
      friend: { ...mockFriend, signature: '' },
      recentMessages: [],
    });

    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('这个人很懒，什么都没写')).toBeInTheDocument();
    });
  });

  it('renders fallback remark text when no remark', async () => {
    vi.mocked(friendsApi.getDetail).mockResolvedValue({
      friend: { ...mockFriend, remark: '' },
      recentMessages: [],
    });

    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText(/备注：点击设置/)).toBeInTheDocument();
    });
  });

  it('does not render recent messages section when empty', async () => {
    vi.mocked(friendsApi.getDetail).mockResolvedValue({
      friend: mockFriend,
      recentMessages: [],
    });

    render(<FriendProfileCard friendId={1} onClose={mockOnClose} onStartChat={mockOnStartChat} />);

    await waitFor(() => {
      expect(screen.getByText('小明')).toBeInTheDocument();
    });

    expect(screen.queryByText('最近聊天')).not.toBeInTheDocument();
  });
});

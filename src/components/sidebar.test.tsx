import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar, MobileNav } from '@/components/sidebar';

const mockLogout = vi.fn();

// Mock useAuth
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      nickname: 'TestUser',
      qq_number: '10001',
      avatar_color: '#3b82f6',
      status: 'online',
      signature: 'Hello',
    },
    logout: mockLogout,
  }),
}));

// Mock next/navigation usePathname
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/app'),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock Avatar
vi.mock('@/components/avatar', () => ({
  Avatar: ({ name, size }: { name: string; size?: string }) => (
    <div data-testid={`avatar-${size || 'md'}`}>{name.charAt(0)}</div>
  ),
}));

// Mock Link
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className} data-testid={`link-${href.replace(/\//g, '-')}`}>
      {children}
    </a>
  ),
}));

describe('Sidebar', () => {
  it('renders user info correctly', () => {
    render(<Sidebar />);
    expect(screen.getByText('TestUser')).toBeInTheDocument();
    expect(screen.getByText('QQ 10001')).toBeInTheDocument();
  });

  it('renders all navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('消息')).toBeInTheDocument();
    expect(screen.getByText('联系人')).toBeInTheDocument();
    expect(screen.getByText('空间')).toBeInTheDocument();
    expect(screen.getByText('定时任务')).toBeInTheDocument();
    expect(screen.getByText('操作记录')).toBeInTheDocument();
    expect(screen.getByText('我的')).toBeInTheDocument();
  });

  it('marks chats as active when pathname is /app', () => {
    render(<Sidebar />);
    const chatLink = screen.getByTestId('link--app');
    expect(chatLink).toHaveClass('bg-white');
    expect(chatLink).toHaveClass('border-l-4');
  });

  it('toggles settings menu on settings button click', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Settings menu should not be visible initially
    expect(screen.queryByText('个人资料')).not.toBeInTheDocument();
    expect(screen.queryByText('退出登录')).not.toBeInTheDocument();

    // Click settings button
    const settingsBtn = screen.getByRole('button');
    await user.click(settingsBtn);

    // Settings menu should be visible
    expect(screen.getByText('个人资料')).toBeInTheDocument();
    expect(screen.getByText('退出登录')).toBeInTheDocument();

    // Click again to close
    await user.click(settingsBtn);
    expect(screen.queryByText('个人资料')).not.toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', async () => {
    mockLogout.mockClear();
    const user = userEvent.setup();
    render(<Sidebar />);

    const settingsBtn = screen.getByRole('button');
    await user.click(settingsBtn);

    const logoutBtn = screen.getByText('退出登录');
    await user.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('renders search input', () => {
    render(<Sidebar />);
    expect(screen.getByPlaceholderText('搜索')).toBeInTheDocument();
  });
});

describe('MobileNav', () => {
  it('renders all mobile navigation items', () => {
    render(<MobileNav />);
    expect(screen.getByText('消息')).toBeInTheDocument();
    expect(screen.getByText('联系人')).toBeInTheDocument();
    expect(screen.getByText('空间')).toBeInTheDocument();
    expect(screen.getByText('定时任务')).toBeInTheDocument();
    expect(screen.getByText('操作记录')).toBeInTheDocument();
    expect(screen.getByText('我的')).toBeInTheDocument();
  });

  it('marks active item based on pathname', () => {
    render(<MobileNav />);
    const chatLink = screen.getByTestId('link--app');
    expect(chatLink).toHaveClass('text-[#12b7f5]');
  });
});

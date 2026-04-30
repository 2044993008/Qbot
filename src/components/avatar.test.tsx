import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '@/components/avatar';

describe('Avatar', () => {
  it('renders with default size and color', () => {
    render(<Avatar name="张三" />);
    const avatar = screen.getByText('张');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('style', expect.stringContaining('rgb(59, 130, 246)'));
  });

  it('renders correct initials for multi-char name', () => {
    render(<Avatar name="李四" />);
    expect(screen.getByText('李')).toBeInTheDocument();
  });

  it('renders fallback "?" when name is empty', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(<Avatar name="Test" size="sm" data-testid="avatar-sm" />);
    let avatar = screen.getByText('T');
    expect(avatar).toHaveClass('w-8', 'h-8', 'text-xs');

    rerender(<Avatar name="Test" size="md" data-testid="avatar-md" />);
    avatar = screen.getByText('T');
    expect(avatar).toHaveClass('w-10', 'h-10', 'text-sm');

    rerender(<Avatar name="Test" size="lg" data-testid="avatar-lg" />);
    avatar = screen.getByText('T');
    expect(avatar).toHaveClass('w-12', 'h-12', 'text-base');

    rerender(<Avatar name="Test" size="xl" data-testid="avatar-xl" />);
    avatar = screen.getByText('T');
    expect(avatar).toHaveClass('w-16', 'h-16', 'text-xl');
  });

  it('renders online status indicator', () => {
    render(<Avatar name="Test" status="online" size="md" />);
    const container = screen.getByText('T').parentElement;
    expect(container).toBeInTheDocument();
    const statusIndicator = container?.querySelector('.bg-green-500');
    expect(statusIndicator).toBeInTheDocument();
  });

  it('renders offline status indicator', () => {
    render(<Avatar name="Test" status="offline" size="md" />);
    const container = screen.getByText('T').parentElement;
    const statusIndicator = container?.querySelector('.bg-gray-400');
    expect(statusIndicator).toBeInTheDocument();
  });

  it('renders busy status indicator', () => {
    render(<Avatar name="Test" status="busy" size="md" />);
    const container = screen.getByText('T').parentElement;
    const statusIndicator = container?.querySelector('.bg-orange-500');
    expect(statusIndicator).toBeInTheDocument();
  });

  it('does not render status when not provided', () => {
    render(<Avatar name="Test" size="md" />);
    const container = screen.getByText('T').parentElement;
    expect(container?.querySelector('.border-2.border-white')).not.toBeInTheDocument();
  });

  it('renders with custom color', () => {
    render(<Avatar name="Test" color="#ff0000" />);
    const avatar = screen.getByText('T');
    expect(avatar).toHaveAttribute('style', expect.stringContaining('rgb(255, 0, 0)'));
  });

  it('applies custom className', () => {
    render(<Avatar name="Test" className="custom-class" />);
    const avatar = screen.getByText('T').parentElement;
    expect(avatar).toHaveClass('custom-class');
  });

  it('renders status with correct size classes', () => {
    render(<Avatar name="Test" status="online" size="sm" />);
    const container = screen.getByText('T').parentElement;
    const statusIndicator = container?.querySelector('.bg-green-500');
    expect(statusIndicator).toHaveClass('w-2.5', 'h-2.5');
  });
});

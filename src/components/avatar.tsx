'use client';

import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

const statusSizeClasses = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

const statusClasses = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-orange-500',
};

export function Avatar({ name, color = '#3b82f6', size = 'md', status, className }: AvatarProps) {
  const initials = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold text-white',
          sizeClasses[size]
        )}
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      {status && (
        <div
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            statusSizeClasses[size],
            statusClasses[status]
          )}
        />
      )}
    </div>
  );
}

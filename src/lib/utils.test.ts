import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn()', () => {
  describe('basic string class merging', () => {
    it('returns a single class string unchanged', () => {
      expect(cn('px-4 py-2')).toBe('px-4 py-2');
    });

    it('merges multiple string class arguments', () => {
      expect(cn('px-4', 'py-2', 'bg-blue-500')).toBe('px-4 py-2 bg-blue-500');
    });

    it('trims extra whitespace between classes', () => {
      expect(cn('px-4  py-2', '  bg-blue-500  ')).toBe('px-4 py-2 bg-blue-500');
    });
  });

  describe('conditional / object syntax', () => {
    it('includes classes with truthy conditions', () => {
      expect(cn('base-class', { active: true, disabled: false })).toBe('base-class active');
    });

    it('handles all-falsy object values', () => {
      expect(cn('base-class', { active: false, loading: 0 as unknown as boolean })).toBe('base-class');
    });

    it('handles all-truthy object values', () => {
      expect(cn({ 'text-red-500': true, 'font-bold': true })).toBe('text-red-500 font-bold');
    });
  });

  describe('array syntax', () => {
    it('flattens array arguments', () => {
      expect(cn(['px-4', 'py-2'], 'bg-blue-500')).toBe('px-4 py-2 bg-blue-500');
    });

    it('flattens nested arrays', () => {
      expect(cn([['px-4', ['py-2']]], 'bg-blue-500')).toBe('px-4 py-2 bg-blue-500');
    });

    it('handles arrays with conditional objects', () => {
      expect(cn(['base-class', { active: true, hidden: false }])).toBe('base-class active');
    });
  });

  describe('nullish and boolean edge cases', () => {
    it('ignores null and undefined inputs', () => {
      expect(cn('px-4', null, undefined, 'py-2')).toBe('px-4 py-2');
    });

    it('ignores boolean inputs', () => {
      expect(cn('px-4', false, true, 'py-2')).toBe('px-4 py-2');
    });

    it('treats 0 as falsy and ignores it, but preserves truthy numbers as strings', () => {
      expect(cn('px-4', 0, 'py-2')).toBe('px-4 py-2');
      // clsx converts truthy numbers to strings intentionally
      expect(cn('px-4', 1, 'py-2')).toBe('px-4 1 py-2');
    });

    it('returns empty string when given no arguments', () => {
      expect(cn()).toBe('');
    });

    it('returns empty string when all arguments are nullish', () => {
      expect(cn(null, undefined, false, '')).toBe('');
    });
  });

  describe('tailwind-merge behavior', () => {
    it('resolves conflicting utility classes to the last one', () => {
      expect(cn('px-2 px-4')).toBe('px-4');
    });

    it('resolves conflicting color classes', () => {
      expect(cn('text-red-500 text-blue-500')).toBe('text-blue-500');
    });

    it('resolves conflicting margin utilities', () => {
      expect(cn('m-2 m-4 m-1')).toBe('m-1');
    });

    it('merges non-conflicting utilities without loss', () => {
      expect(cn('px-4 py-2 text-white bg-black')).toBe('px-4 py-2 text-white bg-black');
    });

    it('resolves conflicts across mixed argument types', () => {
      expect(cn('px-2', { 'px-4': true }, ['px-6'])).toBe('px-6');
    });

    it('handles arbitrary value conflicts correctly', () => {
      expect(cn('w-[100px] w-[200px]')).toBe('w-[200px]');
    });
  });

  describe('complex real-world combinations', () => {
    it('merges a typical button class set', () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        isActive && 'ring-2 ring-offset-2',
        isDisabled && 'opacity-50 cursor-not-allowed',
        'text-sm font-medium'
      );
      expect(result).toBe(
        'inline-flex items-center justify-center rounded-md px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-offset-2 text-sm font-medium'
      );
    });

    it('handles overriding base classes with conditional overrides', () => {
      const variant = 'danger';
      const base = 'px-4 py-2 rounded font-medium';
      const result = cn(
        base,
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'danger' && 'bg-red-500 text-white'
      );
      expect(result).toBe('px-4 py-2 rounded font-medium bg-red-500 text-white');
    });

    it('handles className forwarding pattern', () => {
      const baseClass = 'flex items-center gap-2 p-4';
      const forwardedClass = 'p-6 bg-card';
      expect(cn(baseClass, forwardedClass)).toBe('flex items-center gap-2 p-6 bg-card');
    });
  });
});

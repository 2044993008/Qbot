import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMessages } from '@/lib/hooks';

// Mock APIs
vi.mock('@/lib/api', () => ({
  messagesApi: {
    getList: vi.fn(),
    send: vi.fn(),
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

import { messagesApi } from '@/lib/api';

describe('useMessages race condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getList exactly once when conversationId is provided', async () => {
    vi.mocked(messagesApi.getList).mockResolvedValue({ messages: [] });

    renderHook(() => useMessages(1));

    await waitFor(() => {
      expect(messagesApi.getList).toHaveBeenCalledTimes(1);
      expect(messagesApi.getList).toHaveBeenCalledWith(1);
    });
  });

  it('calls getList exactly once when conversationId changes', async () => {
    vi.mocked(messagesApi.getList).mockResolvedValue({ messages: [] });

    const { rerender } = renderHook(
      ({ convId }: { convId: number }) => useMessages(convId),
      { initialProps: { convId: 1 } }
    );

    await waitFor(() => {
      expect(messagesApi.getList).toHaveBeenCalledTimes(1);
    });

    rerender({ convId: 2 });

    await waitFor(() => {
      expect(messagesApi.getList).toHaveBeenCalledTimes(2);
      expect(messagesApi.getList).toHaveBeenLastCalledWith(2);
    });
  });

  it('prevents duplicate in-flight fetch when fetchMessages is called rapidly', async () => {
    let resolveFetch: (value: { messages: [] }) => void;
    const fetchPromise = new Promise<{ messages: [] }>((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(messagesApi.getList).mockReturnValue(fetchPromise);

    const { result } = renderHook(() => useMessages(1));

    // Wait for the initial automatic fetch to start
    await waitFor(() => {
      expect(messagesApi.getList).toHaveBeenCalledTimes(1);
    });

    // Call fetchMessages manually while one is already in flight
    await result.current.fetchMessages();
    await result.current.fetchMessages();

    // Should still only be 1 call because the first one is in flight
    expect(messagesApi.getList).toHaveBeenCalledTimes(1);

    // Resolve the pending fetch
    resolveFetch!({ messages: [] });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Now call again after the previous one finished
    await result.current.fetchMessages();

    expect(messagesApi.getList).toHaveBeenCalledTimes(2);
  });
});

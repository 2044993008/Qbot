'use client';

import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = getToken();
    socket = io({
      path: '/api/socket',
      auth: { token: token || '' },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // console.log('[Socket] Connected');
    });

    socket.on('disconnect', () => {
      // console.log('[Socket] Disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinConversation(conversationId: number) {
  const s = getSocket();
  s.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: number) {
  const s = getSocket();
  s.emit('leave_conversation', conversationId);
}

export function onNewMessage(callback: (message: unknown) => void) {
  const s = getSocket();
  s.on('new_message', callback);
}

export function offNewMessage(callback: (message: unknown) => void) {
  const s = getSocket();
  s.off('new_message', callback);
}

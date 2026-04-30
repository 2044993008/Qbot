import { describe, it, expect } from 'vitest';

// Import all named type exports to verify they exist and compile successfully
import type {
  User,
  Friend,
  Group,
  GroupMember,
  Conversation,
  Message,
  SearchResult,
  Moment,
  MomentComment,
  BotPreviewAction,
  BotResponse,
  ApiResponse,
  LoginResponse,
  MessagePreview,
  ScheduledTask,
  TaskExecutionLog,
  BotAuditLog,
} from './types';

/**
 * Runtime shape validators for each interface.
 * These act as living documentation of the intended runtime contract
 * and protect against accidental drift in the type definitions.
 */
function isUserLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.qq_number === 'string' &&
    typeof v.nickname === 'string' &&
    typeof v.avatar_color === 'string' &&
    typeof v.signature === 'string' &&
    typeof v.status === 'string'
  );
}

function isFriendLike(value: unknown): boolean {
  return isUserLike(value);
}

function isGroupLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.name === 'string' &&
    typeof v.avatar_color === 'string'
  );
}

function isGroupMemberLike(value: unknown): boolean {
  return isUserLike(value) && typeof (value as Record<string, unknown>).role === 'string';
}

function isConversationLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.type === 'string' &&
    typeof v.user_id === 'number' &&
    typeof v.target_id === 'number'
  );
}

function isMessageLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.conversation_id === 'number' &&
    typeof v.sender_id === 'number' &&
    typeof v.type === 'string' &&
    typeof v.content === 'string' &&
    typeof v.created_at === 'string'
  );
}

function isSearchResultLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sender === 'string' &&
    typeof v.content === 'string' &&
    typeof v.time === 'string'
  );
}

function isMomentLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.user_id === 'number' &&
    typeof v.content === 'string' &&
    typeof v.like_count === 'number' &&
    typeof v.comment_count === 'number' &&
    typeof v.created_at === 'string'
  );
}

function isMomentCommentLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.moment_id === 'number' &&
    typeof v.user_id === 'number' &&
    typeof v.content === 'string' &&
    typeof v.created_at === 'string'
  );
}

function isBotPreviewActionLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.action === 'string';
}

function isBotResponseLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.response === 'string' && typeof v.type === 'string';
}

function isApiResponseLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return 'data' in v || 'error' in v || 'success' in v;
}

function isLoginResponseLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === 'string' && typeof v.user === 'object';
}

function isMessagePreviewLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'number' && typeof v.content === 'string';
}

function isScheduledTaskLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.user_id === 'number' &&
    typeof v.name === 'string' &&
    typeof v.cron_expression === 'string' &&
    typeof v.task_type === 'string' &&
    typeof v.enabled === 'boolean'
  );
}

function isTaskExecutionLogLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.task_id === 'number' &&
    typeof v.status === 'string' &&
    typeof v.output === 'string' &&
    typeof v.error_message === 'string' &&
    typeof v.started_at === 'string'
  );
}

function isBotAuditLogLike(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    typeof v.user_id === 'number' &&
    typeof v.session_id === 'string' &&
    typeof v.request === 'string' &&
    typeof v.response === 'string' &&
    typeof v.latency_ms === 'number' &&
    typeof v.tokens_used === 'number' &&
    typeof v.model === 'string' &&
    typeof v.status === 'string' &&
    typeof v.error === 'string' &&
    typeof v.created_at === 'string'
  );
}

describe('types module exports', () => {
  /**
   * These tests verify two things:
   * 1. TypeScript compilation succeeds (the import statements above would fail at compile time if exports were missing)
   * 2. Runtime shape validators document the expected contract for each type
   */

  it('exports User interface with correct runtime shape', () => {
    const user: User = {
      id: 1,
      qq_number: '10001',
      nickname: 'TestUser',
      avatar_color: '#3b82f6',
      signature: 'Hello',
      status: 'online',
    };
    expect(isUserLike(user)).toBe(true);
  });

  it('exports Friend interface with correct runtime shape', () => {
    const friend: Friend = {
      id: 2,
      qq_number: '10002',
      nickname: 'Friend',
      avatar_color: '#ef4444',
      signature: 'Sig',
      status: 'offline',
      remark: 'Bestie',
    };
    expect(isFriendLike(friend)).toBe(true);
  });

  it('exports Group interface with correct runtime shape', () => {
    const group: Group = {
      id: 10,
      name: 'Test Group',
      avatar_color: '#22c55e',
      description: 'A test group',
      member_count: 5,
    };
    expect(isGroupLike(group)).toBe(true);
  });

  it('exports GroupMember interface with correct runtime shape', () => {
    const member: GroupMember = {
      id: 3,
      qq_number: '10003',
      nickname: 'Member',
      avatar_color: '#a855f7',
      signature: '',
      status: 'busy',
      role: 'admin',
    };
    expect(isGroupMemberLike(member)).toBe(true);
  });

  it('exports Conversation interface with correct runtime shape', () => {
    const conversation: Conversation = {
      id: 100,
      type: 'private',
      user_id: 1,
      target_id: 2,
      last_message: 'Hi',
      unread_count: 0,
    };
    expect(isConversationLike(conversation)).toBe(true);
  });

  it('exports Message interface with correct runtime shape', () => {
    const message: Message = {
      id: 1000,
      conversation_id: 100,
      sender_id: 1,
      sender_nickname: 'Sender',
      type: 'text',
      content: 'Hello world',
      created_at: new Date().toISOString(),
    };
    expect(isMessageLike(message)).toBe(true);
  });

  it('exports SearchResult interface with correct runtime shape', () => {
    const result: SearchResult = {
      sender: 'Alice',
      content: 'Some message',
      time: new Date().toISOString(),
    };
    expect(isSearchResultLike(result)).toBe(true);
  });

  it('exports Moment interface with correct runtime shape', () => {
    const moment: Moment = {
      id: 1,
      user_id: 1,
      content: 'My first moment',
      images: ['https://example.com/img.jpg'],
      like_count: 10,
      comment_count: 2,
      created_at: new Date().toISOString(),
    };
    expect(isMomentLike(moment)).toBe(true);
  });

  it('exports MomentComment interface with correct runtime shape', () => {
    const comment: MomentComment = {
      id: 1,
      moment_id: 1,
      user_id: 2,
      user_nickname: 'Commenter',
      content: 'Nice!',
      created_at: new Date().toISOString(),
    };
    expect(isMomentCommentLike(comment)).toBe(true);
  });

  it('exports BotPreviewAction interface with correct runtime shape', () => {
    const action: BotPreviewAction = {
      action: 'send_message',
      content: 'Hello',
      target_type: 'friend',
      target_id: 1,
    };
    expect(isBotPreviewActionLike(action)).toBe(true);
  });

  it('exports BotResponse interface with correct runtime shape', () => {
    const response: BotResponse = {
      response: 'Here is the result',
      type: 'text',
    };
    expect(isBotResponseLike(response)).toBe(true);
  });

  it('exports ApiResponse interface with correct runtime shape', () => {
    const apiResponse: ApiResponse<string> = {
      data: 'hello',
      success: true,
    };
    expect(isApiResponseLike(apiResponse)).toBe(true);
  });

  it('exports LoginResponse interface with correct runtime shape', () => {
    const loginResponse: LoginResponse = {
      token: 'jwt-token',
      user: {
        id: 1,
        qq_number: '10001',
        nickname: 'User',
        avatar_color: '#3b82f6',
        signature: '',
        status: 'online',
      },
    };
    expect(isLoginResponseLike(loginResponse)).toBe(true);
  });

  it('exports MessagePreview interface with correct runtime shape', () => {
    const preview: MessagePreview = {
      id: 1,
      content: 'Preview',
      type: 'text',
      created_at: new Date().toISOString(),
    };
    expect(isMessagePreviewLike(preview)).toBe(true);
  });

  it('exports ScheduledTask interface with correct runtime shape', () => {
    const task: ScheduledTask = {
      id: 1,
      user_id: 1,
      name: 'Daily Reminder',
      description: 'Remind me every day',
      cron_expression: '0 9 * * *',
      task_type: 'reminder',
      config: { message: 'Good morning' },
      enabled: true,
    };
    expect(isScheduledTaskLike(task)).toBe(true);
  });

  it('exports TaskExecutionLog interface with correct runtime shape', () => {
    const log: TaskExecutionLog = {
      id: 1,
      task_id: 1,
      status: 'success',
      output: 'Done',
      error_message: '',
      started_at: new Date().toISOString(),
    };
    expect(isTaskExecutionLogLike(log)).toBe(true);
  });

  it('exports BotAuditLog interface with correct runtime shape', () => {
    const audit: BotAuditLog = {
      id: 1,
      user_id: 1,
      session_id: 'sess-001',
      request: 'Hello bot',
      plan: {},
      tool_calls: [],
      response: 'Hello user',
      latency_ms: 120,
      tokens_used: 50,
      model: 'gpt-4',
      status: 'success',
      error: '',
      created_at: new Date().toISOString(),
    };
    expect(isBotAuditLogLike(audit)).toBe(true);
  });

  describe('union type coverage', () => {
    it('accepts all valid User status values', () => {
      const statuses: User['status'][] = ['online', 'offline', 'busy'];
      expect(statuses).toContain('online');
      expect(statuses).toContain('offline');
      expect(statuses).toContain('busy');
    });

    it('accepts all valid Message type values', () => {
      const types: Message['type'][] = ['text', 'image', 'file', 'system'];
      expect(types).toContain('text');
      expect(types).toContain('image');
      expect(types).toContain('file');
      expect(types).toContain('system');
    });

    it('accepts all valid Conversation type values', () => {
      const types: Conversation['type'][] = ['private', 'group'];
      expect(types).toContain('private');
      expect(types).toContain('group');
    });

    it('accepts all valid BotResponse type values', () => {
      const types: BotResponse['type'][] = ['text', 'search_results', 'preview', 'polished_text'];
      expect(types).toContain('text');
      expect(types).toContain('search_results');
      expect(types).toContain('preview');
      expect(types).toContain('polished_text');
    });

    it('accepts all valid ScheduledTask task_type values', () => {
      const types: ScheduledTask['task_type'][] = ['reminder', 'send_message', 'post_moment'];
      expect(types).toContain('reminder');
      expect(types).toContain('send_message');
      expect(types).toContain('post_moment');
    });

    it('accepts all valid TaskExecutionLog status values', () => {
      const statuses: TaskExecutionLog['status'][] = ['running', 'success', 'failed'];
      expect(statuses).toContain('running');
      expect(statuses).toContain('success');
      expect(statuses).toContain('failed');
    });
  });
});

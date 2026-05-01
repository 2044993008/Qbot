import { describe, it, expect } from 'vitest';
import { botMessageSchema, botToolExecuteSchema } from './validation';

describe('botMessageSchema', () => {
  it('passes with valid message and conversation_id', () => {
    const result = botMessageSchema.safeParse({ message: '你好', conversation_id: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('你好');
      expect(result.data.conversation_id).toBe(1);
    }
  });

  it('passes with message only', () => {
    const result = botMessageSchema.safeParse({ message: 'hello world' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('hello world');
      expect(result.data.conversation_id).toBeUndefined();
    }
  });

  it('passes with optional system_prompt', () => {
    const result = botMessageSchema.safeParse({
      message: 'test',
      conversation_id: 1,
      system_prompt: 'custom prompt',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.system_prompt).toBe('custom prompt');
    }
  });

  it('fails with empty message', () => {
    const result = botMessageSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messageError = result.error.issues.find(i => i.path[0] === 'message');
      expect(messageError).toBeDefined();
    }
  });

  it('fails with message exceeding 2000 characters', () => {
    const result = botMessageSchema.safeParse({ message: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messageError = result.error.issues.find(i => i.path[0] === 'message');
      expect(messageError).toBeDefined();
    }
  });

  it('passes with message of exactly 2000 characters', () => {
    const result = botMessageSchema.safeParse({ message: 'a'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  it('fails with non-string message (number)', () => {
    const result = botMessageSchema.safeParse({ message: 123 });
    expect(result.success).toBe(false);
  });

  it('fails with non-string message (boolean)', () => {
    const result = botMessageSchema.safeParse({ message: true });
    expect(result.success).toBe(false);
  });

  it('fails when message field is missing', () => {
    const result = botMessageSchema.safeParse({ conversation_id: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messageError = result.error.issues.find(i => i.path[0] === 'message');
      expect(messageError).toBeDefined();
    }
  });

  it('fails with empty object', () => {
    const result = botMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails with negative conversation_id', () => {
    const result = botMessageSchema.safeParse({ message: 'test', conversation_id: -1 });
    expect(result.success).toBe(false);
  });

  it('fails with zero conversation_id', () => {
    const result = botMessageSchema.safeParse({ message: 'test', conversation_id: 0 });
    expect(result.success).toBe(false);
  });

  it('fails with non-integer conversation_id', () => {
    const result = botMessageSchema.safeParse({ message: 'test', conversation_id: 1.5 });
    expect(result.success).toBe(false);
  });
});

describe('botToolExecuteSchema', () => {
  it('passes with valid execute_tool payload including params', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: true,
      tool: 'send_message',
      params: { target: '李华', content: 'hello' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.execute_tool).toBe(true);
      expect(result.data.tool).toBe('send_message');
      expect(result.data.params).toEqual({ target: '李华', content: 'hello' });
    }
  });

  it('passes without optional params', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: true,
      tool: 'suggest_moment',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toBeUndefined();
    }
  });

  it('fails when tool is missing', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: true,
      params: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const toolError = result.error.issues.find(i => i.path[0] === 'tool');
      expect(toolError).toBeDefined();
    }
  });

  it('fails when execute_tool is string "yes"', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: 'yes',
      tool: 'send_message',
    });
    expect(result.success).toBe(false);
  });

  it('fails when execute_tool is false', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: false,
      tool: 'send_message',
    });
    expect(result.success).toBe(false);
  });

  it('fails when execute_tool is 1', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: 1,
      tool: 'send_message',
    });
    expect(result.success).toBe(false);
  });

  it('fails when tool is empty string', () => {
    const result = botToolExecuteSchema.safeParse({
      execute_tool: true,
      tool: '',
    });
    expect(result.success).toBe(false);
  });

  it('fails with empty object', () => {
    const result = botToolExecuteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

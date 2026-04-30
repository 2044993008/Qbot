import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  /**
   * We must re-import the logger module in each test block after mutating NODE_ENV
   * because the module-level `isDev` constant is evaluated at import time.
   */
  async function importLogger() {
    vi.resetModules();
    const mod = await import('./logger');
    return mod.logger;
  }

  describe('development environment (NODE_ENV !== production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('logs debug messages with correct prefix', async () => {
      const logger = await importLogger();
      logger.debug('debug message');
      expect(console.debug).toHaveBeenCalledTimes(1);
      const callArg = (console.debug as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[DEBUG\] debug message$/);
    });

    it('logs info messages with correct prefix', async () => {
      const logger = await importLogger();
      logger.info('info message');
      expect(console.info).toHaveBeenCalledTimes(1);
      const callArg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toMatch(/^\[.+\] \[INFO\] info message$/);
    });

    it('logs warn messages with correct prefix', async () => {
      const logger = await importLogger();
      logger.warn('warn message');
      expect(console.warn).toHaveBeenCalledTimes(1);
      const callArg = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toMatch(/^\[.+\] \[WARN\] warn message$/);
    });

    it('logs error messages with correct prefix', async () => {
      const logger = await importLogger();
      logger.error('error message');
      expect(console.error).toHaveBeenCalledTimes(1);
      const callArg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toMatch(/^\[.+\] \[ERROR\] error message$/);
    });

    it('appends structured meta as JSON', async () => {
      const logger = await importLogger();
      const meta = { userId: 42, action: 'login' };
      logger.info('user action', meta);
      const callArg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toContain('user action');
      expect(callArg).toContain(JSON.stringify(meta));
    });

    it('does not append meta when omitted', async () => {
      const logger = await importLogger();
      logger.info('simple message');
      const callArg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).not.toContain('{}');
    });

    it('handles empty meta object gracefully', async () => {
      const logger = await importLogger();
      logger.info('message', {});
      const callArg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toContain('message');
      expect(callArg).toContain('{}');
    });

    it('handles nested meta objects', async () => {
      const logger = await importLogger();
      const meta = { request: { path: '/api/test', method: 'GET' }, response: { status: 200 } };
      logger.debug('request handled', meta);
      const callArg = (console.debug as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      const parsedMeta = JSON.parse(callArg.split(' ').slice(-1)[0]);
      expect(parsedMeta).toEqual(meta);
    });

    it('handles meta with arrays', async () => {
      const logger = await importLogger();
      const meta = { tags: ['auth', 'api'] };
      logger.warn('tagged event', meta);
      const callArg = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toContain('["auth","api"]');
    });
  });

  describe('production environment (NODE_ENV === production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('does not log debug messages', async () => {
      const logger = await importLogger();
      logger.debug('debug message');
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('does not log info messages', async () => {
      const logger = await importLogger();
      logger.info('info message');
      expect(console.info).not.toHaveBeenCalled();
    });

    it('does not log warn messages', async () => {
      const logger = await importLogger();
      logger.warn('warn message');
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('logs error messages', async () => {
      const logger = await importLogger();
      logger.error('error message');
      expect(console.error).toHaveBeenCalledTimes(1);
      const callArg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toMatch(/^\[.+\] \[ERROR\] error message$/);
    });

    it('logs error messages with meta', async () => {
      const logger = await importLogger();
      const meta = { errorCode: 'E500', stack: '...' };
      logger.error('critical failure', meta);
      const callArg = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toContain('critical failure');
      expect(callArg).toContain('E500');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('handles message with special characters', async () => {
      const logger = await importLogger();
      logger.info('message with "quotes" and \n newlines');
      const callArg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toContain('message with "quotes" and \n newlines');
    });

    it('handles undefined meta gracefully', async () => {
      const logger = await importLogger();
      logger.warn('warning');
      const callArg = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg.trim()).toMatch(/^\[.+\] \[WARN\] warning$/);
    });

    it('handles meta with null values', async () => {
      const logger = await importLogger();
      logger.info('nullable', { value: null });
      const callArg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
      expect(callArg).toContain('"value":null');
    });
  });
});

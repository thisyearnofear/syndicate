import { logger } from '@/lib/logger';

describe('logger', () => {
  let infoSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation();
    debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  describe('log methods call correct console methods', () => {
    it('info calls console.info', () => {
      logger.info('hello');
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('debug calls console.debug', () => {
      logger.debug('hello');
      expect(debugSpy).toHaveBeenCalledTimes(1);
    });

    it('warn calls console.warn', () => {
      logger.warn('hello');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('error calls console.error', () => {
      logger.error('hello');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('log format', () => {
    it('includes timestamp, level, and message', () => {
      logger.info('test message');
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: test message$/
      );
    });

    it('uppercase level for warn', () => {
      logger.warn('caution');
      const output = warnSpy.mock.calls[0][0] as string;
      expect(output).toContain('WARN: caution');
    });

    it('uppercase level for error', () => {
      logger.error('fail');
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain('ERROR: fail');
    });

    it('uppercase level for debug', () => {
      logger.debug('trace');
      const output = debugSpy.mock.calls[0][0] as string;
      expect(output).toContain('DEBUG: trace');
    });
  });

  describe('context', () => {
    it('appends context as JSON when provided', () => {
      logger.info('with ctx', { userId: 'abc', count: 3 });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).toContain('"userId":"abc"');
      expect(output).toContain('"count":3');
    });

    it('omits context when not provided', () => {
      logger.info('no ctx');
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('{');
    });

    it('omits context when empty object', () => {
      logger.info('empty ctx', {});
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('{');
    });
  });

  describe('child logger', () => {
    it('merges parent context into every log call', () => {
      const child = logger.child({ service: 'auth' });
      child.info('login');
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).toContain('"service":"auth"');
    });

    it('merges child call context with parent context', () => {
      const child = logger.child({ service: 'auth' });
      child.warn('retry', { attempt: 2 });
      const output = warnSpy.mock.calls[0][0] as string;
      expect(output).toContain('"service":"auth"');
      expect(output).toContain('"attempt":2');
    });

    it('child call context overrides parent on key collision', () => {
      const child = logger.child({ service: 'auth' });
      child.info('override', { service: 'billing' });
      const output = infoSpy.mock.calls[0][0] as string;
      expect(output).toContain('"service":"billing"');
      expect(output).not.toContain('"service":"auth"');
    });

    it('nested child merges all ancestor contexts', () => {
      const child = logger.child({ service: 'auth' });
      const grandchild = child.child({ requestId: 'xyz' });
      grandchild.error('deep fail', { code: 500 });
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain('"service":"auth"');
      expect(output).toContain('"requestId":"xyz"');
      expect(output).toContain('"code":500');
    });
  });

  describe('log levels in production', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
    });

    it('suppresses debug when NODE_ENV is production', async () => {
      (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
      jest.resetModules();
       
      const { logger: prodLogger } = await import('@/lib/logger');
  prodLogger.debug('should not appear');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('still logs info/warn/error in production', async () => {
      (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
      jest.resetModules();
       
      const { logger: prodLogger } = await import('@/lib/logger');
      prodLogger.info('visible');
      prodLogger.warn('visible');
      prodLogger.error('visible');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * STRUCTURED LOGGER
 *
 * Core Principles Applied:
 * - CLEAN: Single logging interface, structured output
 * - MODULAR: Composable log levels and context
 * - PERFORMANT: No-op in production for debug level
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  if (context && Object.keys(context).length > 0) {
    return `${base} ${JSON.stringify(context)}`;
  }
  return base;
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

export const logger: Logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.debug(formatLog('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.info(formatLog('info', message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, context));
    }
  },

  error(message: string, context?: LogContext): void {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, context));
    }
  },

  child(context: LogContext): Logger {
    return {
      debug: (msg: string, ctx?: LogContext) => logger.debug(msg, { ...context, ...ctx }),
      info: (msg: string, ctx?: LogContext) => logger.info(msg, { ...context, ...ctx }),
      warn: (msg: string, ctx?: LogContext) => logger.warn(msg, { ...context, ...ctx }),
      error: (msg: string, ctx?: LogContext) => logger.error(msg, { ...context, ...ctx }),
      child: (childCtx: LogContext) => logger.child({ ...context, ...childCtx }),
    };
  },
};

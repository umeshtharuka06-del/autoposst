import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'autopost' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});

export type Logger = typeof logger;

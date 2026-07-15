import type { Context } from 'grammy';
import type { User } from '@prisma/client';

/** Bot context enriched by the auth middleware with the DB user. */
export type BotContext = Context & {
  dbUser: User;
};

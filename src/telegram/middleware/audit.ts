import type { NextFunction } from 'grammy';
import { auditRepository } from '../../repositories/audit.repository';
import type { BotContext } from '../context';

/** Records every command and callback action to audit_logs. */
export async function auditMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const text = ctx.message?.text;
  const callback = ctx.callbackQuery?.data;

  if (text?.startsWith('/')) {
    const command = text.split(/\s+/)[0]!;
    // Never log arguments of credential commands (tokens).
    const safeArgs = command === '/facebook' || command === '/pinterest' ? '[redacted]' : text.slice(command.length, 200);
    await auditRepository.record({
      userId: ctx.dbUser.id,
      action: `command:${command}`,
      details: { args: safeArgs.trim() || undefined },
    });
  } else if (callback) {
    await auditRepository.record({
      userId: ctx.dbUser.id,
      action: `callback:${callback.split(':')[0]}`,
      details: { data: callback },
    });
  }

  await next();
}

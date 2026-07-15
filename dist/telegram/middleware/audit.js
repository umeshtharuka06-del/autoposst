"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditMiddleware = auditMiddleware;
const audit_repository_1 = require("../../repositories/audit.repository");
/** Records every command and callback action to audit_logs. */
async function auditMiddleware(ctx, next) {
    const text = ctx.message?.text;
    const callback = ctx.callbackQuery?.data;
    if (text?.startsWith('/')) {
        const command = text.split(/\s+/)[0];
        // Never log arguments of credential commands (tokens).
        const safeArgs = command === '/facebook' || command === '/pinterest' ? '[redacted]' : text.slice(command.length, 200);
        await audit_repository_1.auditRepository.record({
            userId: ctx.dbUser.id,
            action: `command:${command}`,
            details: { args: safeArgs.trim() || undefined },
        });
    }
    else if (callback) {
        await audit_repository_1.auditRepository.record({
            userId: ctx.dbUser.id,
            action: `callback:${callback.split(':')[0]}`,
            details: { data: callback },
        });
    }
    await next();
}
//# sourceMappingURL=audit.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRepository = exports.AuditRepository = void 0;
const prisma_1 = require("../lib/prisma");
class AuditRepository {
    record(params) {
        return prisma_1.prisma.auditLog.create({
            data: {
                userId: params.userId ?? null,
                action: params.action,
                entity: params.entity ?? null,
                entityId: params.entityId ?? null,
                details: params.details,
            },
        });
    }
    recent(limit) {
        return prisma_1.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    }
}
exports.AuditRepository = AuditRepository;
exports.auditRepository = new AuditRepository();
//# sourceMappingURL=audit.repository.js.map
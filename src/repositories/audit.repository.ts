import { AuditLog, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class AuditRepository {
  record(params: {
    userId?: string | null;
    action: string;
    entity?: string | null;
    entityId?: string | null;
    details?: Prisma.InputJsonValue;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        details: params.details,
      },
    });
  }

  recent(limit: number): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }
}

export const auditRepository = new AuditRepository();

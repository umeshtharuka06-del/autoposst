"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobRepository = exports.JobRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
class JobRepository {
    // ===== platform_jobs =====
    createPlatformJob(params) {
        return prisma_1.prisma.platformJob.create({ data: params });
    }
    findPlatformJob(id) {
        return prisma_1.prisma.platformJob.findUnique({ where: { id } });
    }
    findPlatformJobsByPost(postId) {
        return prisma_1.prisma.platformJob.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } });
    }
    findFailedPlatformJobs(limit) {
        return prisma_1.prisma.platformJob.findMany({
            where: { status: { in: [client_1.PlatformJobStatus.FAILED, client_1.PlatformJobStatus.DEAD] } },
            orderBy: { updatedAt: 'desc' },
            take: limit,
        });
    }
    updatePlatformJob(id, data) {
        return prisma_1.prisma.platformJob.update({ where: { id }, data });
    }
    // ===== scheduled_jobs =====
    createScheduledJob(params) {
        return prisma_1.prisma.scheduledJob.create({ data: params });
    }
    findScheduledJob(id) {
        return prisma_1.prisma.scheduledJob.findUnique({ where: { id } });
    }
    findPendingScheduled() {
        return prisma_1.prisma.scheduledJob.findMany({
            where: { status: client_1.ScheduledJobStatus.PENDING },
            orderBy: { runAt: 'asc' },
        });
    }
    updateScheduledJob(id, data) {
        return prisma_1.prisma.scheduledJob.update({ where: { id }, data });
    }
    cancelScheduledForPost(postId) {
        return prisma_1.prisma.scheduledJob.updateMany({
            where: { postId, status: client_1.ScheduledJobStatus.PENDING },
            data: { status: client_1.ScheduledJobStatus.CANCELLED },
        });
    }
    // ===== job_logs =====
    log(params) {
        return prisma_1.prisma.jobLog.create({
            data: {
                queue: params.queue,
                bullJobId: params.bullJobId ?? null,
                platformJobId: params.platformJobId ?? null,
                level: params.level,
                message: params.message,
                data: params.data,
            },
        });
    }
    recentLogs(limit) {
        return prisma_1.prisma.jobLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    }
    // ===== failed_jobs (dead letter records) =====
    recordFailedJob(params) {
        return prisma_1.prisma.failedJob.create({ data: params });
    }
    unresolvedFailedJobs(limit) {
        return prisma_1.prisma.failedJob.findMany({
            where: { resolved: false },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    markFailedJobResolved(id) {
        return prisma_1.prisma.failedJob.update({ where: { id }, data: { resolved: true } });
    }
}
exports.JobRepository = JobRepository;
exports.jobRepository = new JobRepository();
//# sourceMappingURL=job.repository.js.map
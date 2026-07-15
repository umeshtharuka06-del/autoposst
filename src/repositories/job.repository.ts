import {
  FailedJob,
  JobLog,
  Language,
  LogLevel,
  Platform,
  PlatformJob,
  PlatformJobStatus,
  Prisma,
  ScheduledJob,
  ScheduledJobStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';

export class JobRepository {
  // ===== platform_jobs =====

  createPlatformJob(params: {
    postId: string;
    platform: Platform;
    targetId?: string | null;
    language: Language;
  }): Promise<PlatformJob> {
    return prisma.platformJob.create({ data: params });
  }

  findPlatformJob(id: string): Promise<PlatformJob | null> {
    return prisma.platformJob.findUnique({ where: { id } });
  }

  findPlatformJobsByPost(postId: string): Promise<PlatformJob[]> {
    return prisma.platformJob.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } });
  }

  findFailedPlatformJobs(limit: number): Promise<PlatformJob[]> {
    return prisma.platformJob.findMany({
      where: { status: { in: [PlatformJobStatus.FAILED, PlatformJobStatus.DEAD] } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  updatePlatformJob(id: string, data: Prisma.PlatformJobUpdateInput): Promise<PlatformJob> {
    return prisma.platformJob.update({ where: { id }, data });
  }

  // ===== scheduled_jobs =====

  createScheduledJob(params: { postId: string; runAt: Date }): Promise<ScheduledJob> {
    return prisma.scheduledJob.create({ data: params });
  }

  findScheduledJob(id: string): Promise<ScheduledJob | null> {
    return prisma.scheduledJob.findUnique({ where: { id } });
  }

  findPendingScheduled(): Promise<ScheduledJob[]> {
    return prisma.scheduledJob.findMany({
      where: { status: ScheduledJobStatus.PENDING },
      orderBy: { runAt: 'asc' },
    });
  }

  updateScheduledJob(id: string, data: Prisma.ScheduledJobUpdateInput): Promise<ScheduledJob> {
    return prisma.scheduledJob.update({ where: { id }, data });
  }

  cancelScheduledForPost(postId: string): Promise<Prisma.BatchPayload> {
    return prisma.scheduledJob.updateMany({
      where: { postId, status: ScheduledJobStatus.PENDING },
      data: { status: ScheduledJobStatus.CANCELLED },
    });
  }

  // ===== job_logs =====

  log(params: {
    queue: string;
    bullJobId?: string | null;
    platformJobId?: string | null;
    level: LogLevel;
    message: string;
    data?: Prisma.InputJsonValue;
  }): Promise<JobLog> {
    return prisma.jobLog.create({
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

  recentLogs(limit: number): Promise<JobLog[]> {
    return prisma.jobLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  // ===== failed_jobs (dead letter records) =====

  recordFailedJob(params: {
    queue: string;
    bullJobId?: string | null;
    name: string;
    data: Prisma.InputJsonValue;
    failedReason: string;
    stacktrace?: string | null;
    attemptsMade: number;
  }): Promise<FailedJob> {
    return prisma.failedJob.create({ data: params });
  }

  unresolvedFailedJobs(limit: number): Promise<FailedJob[]> {
    return prisma.failedJob.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  markFailedJobResolved(id: string): Promise<FailedJob> {
    return prisma.failedJob.update({ where: { id }, data: { resolved: true } });
  }
}

export const jobRepository = new JobRepository();

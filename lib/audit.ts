// lib/audit.ts
import { prisma } from './prisma'
import { AuditAction, Prisma } from '@prisma/client'

interface AuditOptions {
  table: string
  recordId: string
  action: AuditAction
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  userId: string
  ipAddress?: string
}

export async function createAuditLog(opts: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        table: opts.table,
        recordId: opts.recordId,
        action: opts.action,
        before: opts.before ?? Prisma.JsonNull,
        after: opts.after ?? Prisma.JsonNull,
        userId: opts.userId,
        ipAddress: opts.ipAddress,
      },
    })
  } catch (error) {
    console.error('AuditLog 기록 실패:', error)
  }
}

export async function getAuditLogs(options: {
  table?: string
  recordId?: string
  userId?: string
  action?: AuditAction
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}) {
  return prisma.auditLog.findMany({
    where: {
      ...(options.table && { table: options.table }),
      ...(options.recordId && { recordId: options.recordId }),
      ...(options.userId && { userId: options.userId }),
      ...(options.action && { action: options.action }),
      ...(options.from || options.to
        ? {
            createdAt: {
              ...(options.from && { gte: options.from }),
              ...(options.to && { lte: options.to }),
            },
          }
        : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: options.limit || 50,
    skip: options.offset || 0,
  })
}

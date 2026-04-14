// app/(app)/audit/page.tsx
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '감사 로그' }

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: '생성', color: 'var(--status-completed)' },
  UPDATE: { label: '수정', color: 'var(--status-issued)' },
  DELETE: { label: '삭제', color: 'var(--status-cancelled)' },
  STATUS_CHANGE: { label: '상태변경', color: 'var(--status-shipped)' },
  LOGIN: { label: '로그인', color: 'var(--text-muted)' },
  EXPORT: { label: '내보내기', color: 'var(--status-invoiced)' },
}

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          감사 로그
        </h1>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="erp-table">
          <thead>
            <tr>
              <th>시간</th>
              <th>사용자</th>
              <th>액션</th>
              <th>테이블</th>
              <th>레코드 ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const action = ACTION_LABELS[log.action] || { label: log.action, color: 'var(--text-muted)' }
              return (
                <tr key={log.id}>
                  <td className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {log.user.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{log.user.email}</div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: `${action.color}22`,
                      color: action.color,
                    }}>
                      {action.label}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                      {log.table}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs mono" style={{ color: 'var(--text-subtle)' }}>
                      {log.recordId.slice(0, 12)}...
                    </span>
                  </td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-subtle)' }}>
                  감사 로그가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

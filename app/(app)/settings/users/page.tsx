// app/(app)/settings/users/page.tsx
import { prisma } from '@/lib/prisma'
import { Users, Shield } from 'lucide-react'
import type { Metadata } from 'next'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: '사용자 관리' }

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '관리자',
  MANAGER: '매니저',
  OPERATOR: '운영자',
  VIEWER: '조회자',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'var(--accent)',
  MANAGER: 'var(--status-paid)',
  OPERATOR: 'var(--status-issued)',
  VIEWER: 'var(--text-muted)',
}

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { pos: true } } },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            사용자 관리
          </h1>
        </div>
        <button id="invite-user-btn" className="btn-gold flex items-center gap-2 text-sm">
          <Shield className="w-4 h-4" />
          초대 링크 발송
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="erp-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th>작성 PO</th>
              <th>가입일</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black"
                      style={{ background: 'var(--accent)' }}>
                      {user.name.charAt(0)}
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {user.name}
                    </span>
                  </div>
                </td>
                <td className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                <td>
                  <span className="badge" style={{
                    background: `${ROLE_COLORS[user.role]}22`,
                    color: ROLE_COLORS[user.role],
                  }}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="mono font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user._count.pos}건
                </td>
                <td style={{ color: 'var(--text-subtle)' }}>{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

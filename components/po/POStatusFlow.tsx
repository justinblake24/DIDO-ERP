// components/po/POStatusFlow.tsx
'use client'

import { POStatus } from '@prisma/client'
import { STATUS_FLOW, STATUS_LABELS } from '@/lib/utils'
import { CheckCircle2, Circle, XCircle } from 'lucide-react'

interface Props {
  status: POStatus
  compact?: boolean
}

export default function POStatusFlow({ status, compact = false }: Props) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="w-4 h-4" style={{ color: 'var(--status-cancelled)' }} />
        <span className="text-sm" style={{ color: 'var(--status-cancelled)' }}>취소됨</span>
      </div>
    )
  }

  const currentIdx = STATUS_FLOW.indexOf(status)

  if (compact) {
    const pct = (currentIdx / (STATUS_FLOW.length - 1)) * 100
    return (
      <div className="progress-bar" style={{ width: '80px' }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {STATUS_FLOW.map((s, idx) => {
        const done = idx <= currentIdx
        const isCurrent = idx === currentIdx

        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              {done ? (
                <CheckCircle2
                  className="w-4 h-4"
                  style={{ color: isCurrent ? 'var(--accent)' : 'var(--status-completed)' }}
                />
              ) : (
                <Circle className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
              )}
              {!compact && (
                <span className="text-xs whitespace-nowrap" style={{
                  color: isCurrent ? 'var(--accent)' : done ? 'var(--text-muted)' : 'var(--text-subtle)',
                  fontWeight: isCurrent ? '600' : '400',
                }}>
                  {STATUS_LABELS[s]}
                </span>
              )}
            </div>
            {idx < STATUS_FLOW.length - 1 && (
              <div style={{
                width: '24px',
                height: '1px',
                background: idx < currentIdx ? 'var(--status-completed)' : 'var(--border)',
                margin: compact ? '0 2px' : '0 4px',
                marginBottom: compact ? '0' : '16px',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

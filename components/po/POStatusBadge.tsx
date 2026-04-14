// components/po/POStatusBadge.tsx
import { POStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/utils'

interface Props {
  status: POStatus
  size?: 'sm' | 'md'
}

const badgeClass: Record<POStatus, string> = {
  DRAFT: 'badge-draft',
  ISSUED: 'badge-issued',
  PAID: 'badge-paid',
  SHIPPED: 'badge-shipped',
  INVOICED: 'badge-invoiced',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
}

export default function POStatusBadge({ status, size = 'md' }: Props) {
  return (
    <span
      className={`badge ${badgeClass[status]}`}
      style={{ fontSize: size === 'sm' ? '10px' : '11px' }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

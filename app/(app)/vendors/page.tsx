// app/(app)/vendors/page.tsx
import { prisma } from '@/lib/prisma'
import { getCountryFlag, formatDate } from '@/lib/utils'
import { Building2, Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '발주처 관리' }

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: {
      _count: { select: { pos: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            발주처 관리
          </h1>
        </div>
        <button id="new-vendor-btn" className="btn-gold flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          신규 발주처
        </button>
      </div>

      <div className="vendor-grid">
        {vendors.map((vendor) => (
          <div key={vendor.id} className="glass-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-2xl">{getCountryFlag(vendor.country)}</div>
              <span className={`badge ${vendor.active ? 'badge-completed' : 'badge-cancelled'}`}>
                {vendor.active ? '활성' : '비활성'}
              </span>
            </div>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {vendor.name}
            </h3>
            <div className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
              {vendor.country} · {vendor.currency}
            </div>
            <div className="flex items-center justify-between text-xs"
              style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <span style={{ color: 'var(--text-subtle)' }}>총 발주 건수</span>
              <span className="mono font-medium" style={{ color: 'var(--accent)' }}>
                {vendor._count.pos}건
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
              등록일: {formatDate(vendor.createdAt)}
            </div>
          </div>
        ))}
      </div>

      {vendors.length === 0 && (
        <div className="glass-card flex flex-col items-center py-16">
          <Building2 className="w-10 h-10 mb-4" style={{ color: 'var(--text-subtle)' }} />
          <p style={{ color: 'var(--text-muted)' }}>등록된 발주처가 없습니다</p>
        </div>
      )}
    </div>
  )
}

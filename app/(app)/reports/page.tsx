// app/(app)/reports/page.tsx
import { prisma } from '@/lib/prisma'
import { formatKRW, formatJPY } from '@/lib/utils'
import { BarChart3, Download } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '리포트' }

export default async function ReportsPage() {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const [allPOs, allItems] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { issueDate: { gte: yearStart } },
      include: { vendor: { select: { name: true, country: true } } },
    }),
    prisma.pOItem.findMany({
      where: { po: { issueDate: { gte: yearStart } } },
      select: { totalAmount: true, currency: true },
    }),
  ])

  const krwTotal = allItems.reduce((sum, i) =>
    i.currency === 'KRW' ? sum + Number(i.totalAmount) : sum, 0)

  const byStatus = allPOs.reduce<Record<string, number>>((acc, po) => {
    acc[po.status] = (acc[po.status] || 0) + 1
    return acc
  }, {})

  const byVendorCountry = allPOs.reduce<Record<string, number>>((acc, po) => {
    const key = po.vendor.country === 'KR' ? '🇰🇷 국내' : '🌏 해외'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const STATUS_KO: Record<string, string> = {
    DRAFT: '작성중', ISSUED: '발주완료', PAID: '결제완료',
    SHIPPED: '선적완료', INVOICED: '청구완료', COMPLETED: '입금완료', CANCELLED: '취소',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            리포트
          </h1>
        </div>
        <button id="download-report-btn" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <Download className="w-4 h-4" />
          PDF Export
        </button>
      </div>

      <div className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {now.getFullYear()}년 연간 리포트
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {/* 연간 발주액 */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            연간 발주액 (KRW)
          </h2>
          <div className="text-3xl font-bold mono" style={{ color: 'var(--accent)' }}>
            {formatKRW(krwTotal)}
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
            총 {allPOs.length}건 발주
          </div>
        </div>

        {/* 상태별 분포 */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            상태별 분포
          </h2>
          <div className="space-y-2">
            {Object.entries(byStatus).map(([status, count]) => {
              const pct = allPOs.length > 0 ? (count / allPOs.length) * 100 : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="text-xs w-20 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {STATUS_KO[status] || status}
                  </div>
                  <div className="flex-1 progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs mono w-12 text-right" style={{ color: 'var(--text-subtle)' }}>
                    {count}건
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 국내/해외 분포 */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            국내/해외 분포
          </h2>
          <div className="space-y-3">
            {Object.entries(byVendorCountry).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{type}</span>
                <span className="text-lg font-bold mono" style={{ color: 'var(--text-primary)' }}>
                  {count}건
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 완료율 */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            완료율
          </h2>
          <div className="text-3xl font-bold mono mb-2" style={{ color: 'var(--status-completed)' }}>
            {allPOs.length > 0
              ? Math.round(((byStatus['COMPLETED'] || 0) / allPOs.length) * 100)
              : 0}%
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            완료 {byStatus['COMPLETED'] || 0}건 / 전체 {allPOs.length}건
          </div>
        </div>
      </div>
    </div>
  )
}

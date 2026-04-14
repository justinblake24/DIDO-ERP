// app/(app)/invoices/page.tsx
import { prisma } from '@/lib/prisma'
import { formatDate, formatJPY } from '@/lib/utils'
import { ClipboardList } from 'lucide-react'
import Link from 'next/link'
import POStatusBadge from '@/components/po/POStatusBadge'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '청구 관리' }

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      po: { include: { vendor: { select: { name: true, country: true } } } },
      deposits: true,
    },
    orderBy: { invoiceDate: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          일본 청구 관리
        </h1>
      </div>

      {invoices.length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16">
          <ClipboardList className="w-10 h-10 mb-4" style={{ color: 'var(--text-subtle)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            청구 내역이 없습니다
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            SHIPPED 상태의 PO에서 청구서를 발행하세요
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="erp-table">
            <thead>
              <tr>
                <th>청구번호</th>
                <th>PO 번호</th>
                <th>발주처</th>
                <th>청구일</th>
                <th style={{ textAlign: 'right' }}>청구금액 (JPY)</th>
                <th>비율</th>
                <th>입금 상태</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const depositTotal = inv.deposits.reduce((sum, d) => sum + Number(d.amountJPY), 0)
                const depositRate = Number(inv.totalJPY) > 0 ? depositTotal / Number(inv.totalJPY) : 0
                return (
                  <tr key={inv.id}>
                    <td className="mono text-sm font-medium" style={{ color: 'var(--accent)' }}>
                      {inv.invoiceNo}
                    </td>
                    <td>
                      <Link href={`/purchase-orders/${inv.poId}`} className="mono text-sm hover:underline"
                        style={{ color: 'var(--status-issued)' }}>
                        {inv.po.poNumber}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{inv.po.vendor.name}</td>
                    <td style={{ color: 'var(--text-subtle)' }}>{formatDate(inv.invoiceDate)}</td>
                    <td className="mono font-semibold text-right" style={{ color: 'var(--text-primary)' }}>
                      {formatJPY(Number(inv.totalJPY))}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>
                      {(Number(inv.ratio) * 100).toFixed(0)}%
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar" style={{ width: '60px' }}>
                          <div className="progress-fill" style={{ width: `${depositRate * 100}%` }} />
                        </div>
                        <span className="text-xs mono" style={{ color: 'var(--text-subtle)' }}>
                          {(depositRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

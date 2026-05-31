// app/(app)/reports/page.tsx
import { prisma } from '@/lib/prisma'
import { formatKRW, formatJPY } from '@/lib/utils'
import { BarChart3, Download, Package } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '리포트' }

function safeParseJson(val: any): any {
  if (!val) return null
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

function calculateProductProfitability(tradeCases: any[]) {
  const products: any[] = []

  for (const tc of tradeCases) {
    const allItems: Array<{ docIndex: number; item: any }> = []
    tc.documents.forEach((d: any, i: number) => {
      const parsed = safeParseJson(d.parsedData)
      if (parsed && parsed.items) {
        parsed.items.forEach((it: any) => allItems.push({ docIndex: i, item: it }))
      }
    })

    const matchedRows: Array<Record<number, any>> = []
    const used = new Set<any>()

    for (const { docIndex, item } of allItems) {
      if (used.has(item)) continue

      const currentParsed = safeParseJson(tc.documents[docIndex].parsedData)
      const row: Record<number, any> = { [docIndex]: item }
      used.add(item)

      for (let i = 0; i < tc.documents.length; i++) {
        if (i === docIndex) continue

        const otherParsed = safeParseJson(tc.documents[i].parsedData)
        if (!otherParsed || !otherParsed.items) continue

        const match = otherParsed.items.find((other: any) => {
          if (used.has(other)) return false
          
          if (other.name?.toLowerCase() === item.name?.toLowerCase()) return true
          if (other.qty === item.qty && item.qty !== null && item.qty > 0) return true
          if (other.name?.toLowerCase().includes(item.name?.toLowerCase()) || item.name?.toLowerCase().includes(other.name?.toLowerCase())) return true
          
          // 단일 품목인 경우 무조건 매핑
          if (currentParsed?.items?.length === 1 && otherParsed.items.length === 1) return true

          return false
        })

        if (match) {
          row[i] = match
          used.add(match)
        }
      }
      matchedRows.push(row)
    }

    const exportIndices = new Set(tc.documents.map((d: any, i: number) => ['JP_PO', 'KR_PO_INTL'].includes(d.docType) ? i : -1).filter((i: number) => i !== -1))
    const domesticIndices = new Set(tc.documents.map((d: any, i: number) => ['KR_PO_LOCAL'].includes(d.docType) ? i : -1).filter((i: number) => i !== -1))
    const invoiceIndices = new Set(tc.documents.map((d: any, i: number) => ['INVOICE_NOAH'].includes(d.docType) ? i : -1).filter((i: number) => i !== -1))

    matchedRows.forEach(row => {
      let domItem: any = null
      let expItem: any = null
      let invItem: any = null

      Object.entries(row).forEach(([idxStr, item]: [string, any]) => {
        const idx = parseInt(idxStr, 10)
        if (domesticIndices.has(idx)) domItem = item
        if (exportIndices.has(idx)) expItem = item
        if (invoiceIndices.has(idx)) invItem = item
      })

      let name = 'Unknown Item'
      const firstItem = Object.values(row)[0]
      if (firstItem && (firstItem as any).name) {
        name = (firstItem as any).name
      }
      if (domItem?.name) name = domItem.name
      else if (expItem?.name) name = expItem.name
      else if (invItem?.name) name = invItem.name
      
      let costJPY = 0
      let costKRW = 0
      let purchaseQty = 0
      let purchaseUnit = 'EA'
      if (domItem) {
        purchaseQty = domItem.qty || 0
        purchaseUnit = domItem.unit || 'EA'
        const amt = domItem.amount || 0
        const cur = domItem.currency || 'KRW'
        if (cur === 'KRW') {
          costKRW = amt
          costJPY = amt / 9.5
        } else if (cur === 'JPY') {
          costJPY = amt
          costKRW = amt * 9.5
        } else if (cur === 'USD') {
          costJPY = (amt * 1350) / 9.5
          costKRW = amt * 1350
        }
      }

      let revenueJPY = 0
      let invoiceQty = 0
      let invoiceUnit = 'EA'
      if (invItem) {
        invoiceQty = invItem.qty || 0
        invoiceUnit = invItem.unit || 'EA'
        revenueJPY = invItem.amount || 0
      }

      const profitJPY = revenueJPY - costJPY
      const marginPct = costJPY > 0 && revenueJPY > 0 ? (profitJPY / revenueJPY) * 100 : (revenueJPY > 0 ? 100 : (costJPY > 0 ? -100 : 0))

      let status = 'DRAFT'
      let statusColor = 'var(--text-subtle)'
      let statusLabel = '대기'

      if (domItem && !invItem) {
        status = 'UNINVOICED'
        statusLabel = '미청구'
        statusColor = '#ef4444'
      } else if (domItem && invItem) {
        if (invoiceQty < purchaseQty) {
          status = 'PARTIAL'
          statusLabel = '부분 청구'
          statusColor = '#f59e0b'
        } else {
          status = 'COMPLETED'
          statusLabel = '청구 완료'
          statusColor = '#10b981'
        }
      } else if (!domItem && invItem) {
        status = 'OVERINVOICED'
        statusLabel = '추가 청구'
        statusColor = '#3b82f6'
      }

      products.push({
        name,
        caseName: tc.caseName,
        purchaseQty,
        purchaseUnit,
        costJPY: Math.round(costJPY),
        costKRW: Math.round(costKRW),
        invoiceQty,
        invoiceUnit,
        revenueJPY: Math.round(revenueJPY),
        profitJPY: Math.round(profitJPY),
        marginPct: Math.round(marginPct * 10) / 10,
        status,
        statusLabel,
        statusColor,
      })
    })
  }

  return products
}

export default async function ReportsPage() {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const [allPOs, allItems, tradeCases] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { issueDate: { gte: yearStart } },
      include: { vendor: { select: { name: true, country: true } } },
    }),
    prisma.pOItem.findMany({
      where: { po: { issueDate: { gte: yearStart } } },
      select: { totalAmount: true, currency: true },
    }),
    prisma.tradeCase.findMany({
      include: {
        documents: true,
        linkedPOs: {
          include: {
            items: true,
            vendor: true,
          },
        },
        linkedInvoices: {
          include: {
            deposits: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

  const profitProducts = calculateProductProfitability(tradeCases)

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

      {/* 품목별 수익성 및 청구 현황 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            품목별 수익성 및 청구 현황 (Product Profitability & Billing)
          </h2>
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--text-subtle)' }}>
          자동 품목 매핑 기능을 기반으로 집계된 품목별 실질 매입 비용, 청구 매출액 및 마진 정보입니다. (환율: JPY/KRW 9.5 기준)
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th className="pb-3 text-xs font-semibold text-[var(--text-subtle)] w-[30%]">제품명</th>
                <th className="pb-3 text-xs font-semibold text-[var(--text-subtle)] w-[15%]">무역 케이스</th>
                <th className="pb-3 text-xs font-semibold text-[var(--text-subtle)] text-right w-[15%]">국내 매입 (Cost)</th>
                <th className="pb-3 text-xs font-semibold text-[var(--text-subtle)] text-right w-[15%]">수출 청구 (Revenue)</th>
                <th className="pb-3 text-xs font-semibold text-[var(--text-subtle)] text-right w-[15%]">영업이익 (Profit)</th>
                <th className="pb-3 text-xs font-semibold text-[var(--text-subtle)] text-center w-[10%]">청구 상태</th>
              </tr>
            </thead>
            <tbody>
              {profitProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--text-subtle)' }}>
                    등록된 품목별 분석 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                profitProducts.map((p, idx) => {
                  const isPositive = p.profitJPY >= 0
                  return (
                    <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="py-3.5 pr-3 align-middle font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {p.name}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {p.caseName}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-right text-sm">
                        <div className="font-semibold mono" style={{ color: 'var(--text-primary)' }}>
                          {p.purchaseQty > 0 ? `${p.purchaseQty.toLocaleString()} ${p.purchaseUnit}` : '-'}
                        </div>
                        {p.costKRW > 0 && (
                          <div className="text-xs mt-0.5 mono" style={{ color: 'var(--text-subtle)' }}>
                            {formatKRW(p.costKRW)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-right text-sm">
                        <div className="font-semibold mono" style={{ color: 'var(--text-primary)' }}>
                          {p.invoiceQty > 0 ? `${p.invoiceQty.toLocaleString()} ${p.invoiceUnit}` : '-'}
                        </div>
                        {p.revenueJPY > 0 && (
                          <div className="text-xs mt-0.5 mono" style={{ color: 'var(--text-subtle)' }}>
                            {formatJPY(p.revenueJPY)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 align-middle text-right text-sm">
                        <div className="font-bold mono" style={{ color: isPositive ? '#10b981' : '#ef4444' }}>
                          {p.profitJPY !== 0 ? `${isPositive ? '+' : ''}${formatJPY(p.profitJPY)}` : '-'}
                        </div>
                        {p.profitJPY !== 0 && (
                          <div className="text-xs font-semibold mt-0.5" style={{ color: isPositive ? '#10b981' : '#ef4444' }}>
                            {p.marginPct}%
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 align-middle text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: `${p.statusColor}18`,
                            color: p.statusColor,
                            border: `1px solid ${p.statusColor}30`
                          }}>
                          {p.statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


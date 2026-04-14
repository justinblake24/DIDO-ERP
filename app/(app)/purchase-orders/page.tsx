// app/(app)/purchase-orders/page.tsx
import { prisma } from '@/lib/prisma'
import { formatDate, formatKRW, getCountryFlag } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Upload, Download, Search } from 'lucide-react'
import POStatusBadge from '@/components/po/POStatusBadge'
import POStatusFlow from '@/components/po/POStatusFlow'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'P/O 발행대장',
}

interface Props {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Number(params.page || 1)
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.search) {
    where.OR = [
      { poNumber: { contains: params.search, mode: 'insensitive' } },
      { vendor: { name: { contains: params.search, mode: 'insensitive' } } },
      { items: { some: { productName: { contains: params.search, mode: 'insensitive' } } } },
    ]
  }

  const [poList, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { name: true, country: true } },
        items: { select: { productName: true, totalAmount: true, currency: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { items: true, payments: true } },
      },
      orderBy: { issueDate: 'desc' },
      take: pageSize,
      skip,
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const STATUS_FILTERS = [
    { label: '전체', value: '' },
    { label: '작성중', value: 'DRAFT' },
    { label: '발주완료', value: 'ISSUED' },
    { label: '결제완료', value: 'PAID' },
    { label: '선적완료', value: 'SHIPPED' },
    { label: '청구완료', value: 'INVOICED' },
    { label: '입금완료', value: 'COMPLETED' },
    { label: '취소', value: 'CANCELLED' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        P/O 발행대장
      </h1>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1" style={{ minWidth: '200px', maxWidth: '320px' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-subtle)' }} />
          <form>
            <input
              name="search"
              defaultValue={params.search}
              type="text"
              placeholder="발주번호, 발주처, 제품명 검색..."
              className="erp-input pl-9"
              style={{ height: '36px', paddingTop: 0, paddingBottom: 0 }}
              aria-label="PO 검색"
            />
          </form>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/purchase-orders?status=${f.value}${params.search ? `&search=${params.search}` : ''}`}
            >
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                style={{
                  background: params.status === f.value || (!params.status && f.value === '')
                    ? 'rgba(255,192,0,0.15)' : 'rgba(255,255,255,0.04)',
                  color: params.status === f.value || (!params.status && f.value === '')
                    ? 'var(--accent)' : 'var(--text-muted)',
                  border: params.status === f.value || (!params.status && f.value === '')
                    ? '1px solid rgba(255,192,0,0.3)' : '1px solid var(--border)',
                }}
              >
                {f.label}
              </button>
            </Link>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <button
          id="export-button"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-150"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <Link href="/purchase-orders/import">
          <button
            id="import-button"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </Link>
        <Link href="/purchase-orders/new">
          <button id="new-po-button" className="btn-gold flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            신규 발주
          </button>
        </Link>
      </div>

      {/* Count */}
      <div className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        전체 <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{total}건</span>
        {params.search && (
          <span> · &ldquo;{params.search}&rdquo; 검색 결과</span>
        )}
      </div>

      {/* PO List */}
      {poList.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            발주가 없습니다
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            새 발주를 작성하거나 엑셀 파일을 Import하세요
          </p>
          <div className="flex gap-3">
            <Link href="/purchase-orders/new">
              <button className="btn-gold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />신규 발주
              </button>
            </Link>
            <Link href="/purchase-orders/import">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <Upload className="w-4 h-4" />Import
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {poList.map((po) => {
            const krwTotal = po.items.reduce((sum, item) =>
              item.currency === 'KRW' ? sum + Number(item.totalAmount) : sum, 0)

            return (
              <Link key={po.id} href={`/purchase-orders/${po.id}`}>
                <div className="glass-card p-4 flex items-center gap-4 cursor-pointer"
                  style={{ borderRadius: '12px' }}>
                  {/* PO Number */}
                  <div style={{ minWidth: '200px' }}>
                    <div className="mono text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      {po.poNumber}
                    </div>
                    <div className="text-xs mt-0.5 mono" style={{ color: 'var(--text-subtle)' }}>
                      {formatDate(po.issueDate)}
                    </div>
                  </div>

                  {/* Vendor */}
                  <div style={{ width: '200px' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getCountryFlag(po.vendor.country)}</span>
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {po.vendor.name}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ flex: 1 }}>
                    <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                      {po.items[0]?.productName}
                      {po._count.items > 1 && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-subtle)' }}>
                          외 {po._count.items - 1}건
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  {krwTotal > 0 && (
                    <div className="mono text-sm font-medium" style={{ color: 'var(--text-primary)', minWidth: '120px', textAlign: 'right' }}>
                      {formatKRW(krwTotal)}
                    </div>
                  )}

                  {/* Progress */}
                  <div style={{ width: '80px' }}>
                    <POStatusFlow status={po.status} compact />
                  </div>

                  {/* Status */}
                  <POStatusBadge status={po.status} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p}
              href={`/purchase-orders?page=${p}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}>
              <button
                className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: p === page ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                  color: p === page ? '#000' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}>
                {p}
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

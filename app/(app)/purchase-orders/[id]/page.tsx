// app/(app)/purchase-orders/[id]/page.tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, formatCurrency, formatKRW, getCountryFlag, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Edit, Package, CreditCard, FileText, Clock, ExternalLink } from 'lucide-react'
import POStatusBadge from '@/components/po/POStatusBadge'
import POStatusFlow from '@/components/po/POStatusFlow'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { poNumber: true } })
  return { title: po?.poNumber || 'PO 상세' }
}

export default async function PODetailPage({ params }: Props) {
  const { id } = await params

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { installment: 'asc' } },
      invoices: {
        include: { deposits: { orderBy: { depositDate: 'asc' } } },
        orderBy: { invoiceDate: 'asc' },
      },
      createdBy: { select: { name: true, email: true } },
    },
  })

  if (!po) notFound()

  const krwTotal = po.items.reduce((sum, i) =>
    i.currency === 'KRW' ? sum + Number(i.totalAmount) : sum, 0)
  const usdTotal = po.items.reduce((sum, i) =>
    i.currency === 'USD' ? sum + Number(i.totalAmount) : sum, 0)

  return (
    <div>
      {/* Back + Header - 모바일 세로 스택 */}
      <div className="mb-6">
        {/* 순 1: 목록버튼 + 수정버튼 */}
        <div className="flex items-center justify-between mb-3">
          <Link href="/purchase-orders">
            <button className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <ArrowLeft className="w-4 h-4" />
              <span className="btn-label-hide">목록으로</span>
            </button>
          </Link>
          <Link href={`/purchase-orders/${id}/edit`}>
            <button id="edit-po-button" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <Edit className="w-4 h-4" />
              수정
            </button>
          </Link>
        </div>
        {/* 순 2: PO 정보 */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold mono" style={{ color: 'var(--accent)' }}>
              {po.poNumber}
            </h1>
            <POStatusBadge status={po.status} />
          </div>
          <div className="text-sm mt-0.5" style={{ color: 'var(--text-subtle)' }}>
            {getCountryFlag(po.vendor.country)} {po.vendor.name} · {formatDate(po.issueDate)}
          </div>
        </div>
      </div>

      {/* Status Flow */}
      <div className="glass-card p-5 mb-5">
        <div className="text-xs font-medium mb-4" style={{ color: 'var(--text-subtle)' }}>
          진행 상태
        </div>
        <POStatusFlow status={po.status} />
      </div>

      <div className="detail-grid" style={{ marginBottom: '20px' }}>
        {/* PO Info */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              발주 정보
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { label: '발주번호', value: po.poNumber, mono: true },
              { label: '발행일', value: formatDate(po.issueDate) },
              { label: '발주처', value: `${getCountryFlag(po.vendor.country)} ${po.vendor.name}` },
              { label: '발주처 국가', value: po.vendor.country },
              { label: '통화', value: po.vendor.currency },
              { label: '작성자', value: po.createdBy.name },
              { label: '생성일', value: formatDate(po.createdAt) },
              { label: '최종 수정', value: formatDate(po.updatedAt) },
            ].map((field) => (
              <div key={field.label}>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{field.label}</div>
                <div className={`text-sm font-medium mt-0.5 ${field.mono ? 'mono' : ''}`}
                  style={{ color: 'var(--text-primary)' }}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
          {po.remarks && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>비고</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{po.remarks}</div>
            </div>
          )}
        </div>

        {/* Amount Summary */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              금액 요약
            </h2>
          </div>
          <div className="space-y-3">
            {krwTotal > 0 && (
              <div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>발주금액 (KRW)</div>
                <div className="text-xl font-bold mono mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  {formatKRW(krwTotal)}
                </div>
              </div>
            )}
            {usdTotal > 0 && (
              <div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>발주금액 (USD)</div>
                <div className="text-xl font-bold mono mt-0.5" style={{ color: 'var(--text-primary)' }}>
                  ${usdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>결제 건수</div>
              <div className="text-lg font-bold mono" style={{ color: 'var(--text-primary)' }}>
                {po.payments.length}건
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="glass-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            발주 품목 ({po.items.length}건)
          </h2>
        </div>
        <table className="erp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>제품명</th>
              <th>규격</th>
              <th style={{ textAlign: 'right' }}>수량</th>
              <th>단위</th>
              <th style={{ textAlign: 'right' }}>단가</th>
              <th>통화</th>
              <th style={{ textAlign: 'right' }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, idx) => (
              <tr key={item.id}>
                <td className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>{idx + 1}</td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.productName}</td>
                <td style={{ color: 'var(--text-muted)' }}>{item.specification || '-'}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                  {Number(item.quantity).toLocaleString()}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{item.unit}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                  {Number(item.unitPrice).toLocaleString()}
                </td>
                <td>
                  <span className="badge" style={{
                    background: item.currency === 'USD' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
                    color: item.currency === 'USD' ? 'var(--status-issued)' : 'var(--text-muted)',
                  }}>
                    {item.currency}
                  </span>
                </td>
                <td className="mono font-semibold" style={{ textAlign: 'right', color: 'var(--accent)' }}>
                  {formatCurrency(Number(item.totalAmount), item.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="text-right text-sm font-semibold py-3"
                style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                합계
              </td>
              <td className="mono font-bold text-right py-3"
                style={{ color: 'var(--accent)', borderTop: '1px solid var(--border)' }}>
                {krwTotal > 0 ? formatKRW(krwTotal) : ''}
                {usdTotal > 0 ? `$${usdTotal.toFixed(2)}` : ''}
              </td>
            </tr>
          </tfoot>
        </div>
        </div>
      </div>

      {/* Payments */}
      {po.payments.length > 0 && (
        <div className="glass-card p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4" style={{ color: 'var(--status-paid)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              결제 내역
            </h2>
          </div>
          <table className="erp-table">
            <thead>
              <tr>
                <th>회차</th>
                <th>비율</th>
                <th>결제일</th>
                <th style={{ textAlign: 'right' }}>금액</th>
                <th>통화</th>
                <th>세금계산서</th>
                <th>승인</th>
              </tr>
            </thead>
            <tbody>
              {po.payments.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ color: 'var(--text-primary)' }}>{p.installment}회차</td>
                  <td className="mono" style={{ color: 'var(--text-muted)' }}>{(Number(p.ratio) * 100).toFixed(0)}%</td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.payDate)}</td>
                  <td className="mono font-medium text-right" style={{ color: 'var(--text-primary)' }}>
                    {Number(p.amount).toLocaleString()}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.currency}</td>
                  <td className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>{p.taxInvoice || '-'}</td>
                  <td>
                    <span className={`badge ${p.approved ? 'badge-completed' : 'badge-draft'}`}>
                      {p.approved ? '승인' : '미승인'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit hint */}
      <div className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
        <Clock className="w-3 h-3 inline mr-1" />
        모든 변경 사항은 감사 로그에 자동 기록됩니다
      </div>
    </div>
  )
}

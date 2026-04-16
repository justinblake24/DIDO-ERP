'use client'
// app/(app)/invoices/page.tsx
import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, Upload, Truck, FlaskConical, FileText } from 'lucide-react'
import Link from 'next/link'
import InvoiceUploadModal from '@/components/invoice/InvoiceUploadModal'

type InvoiceType = 'REGULAR' | 'TRANSPORT' | 'SAMPLE'
type TabKey = 'ALL' | InvoiceType

interface Deposit { amountJPY: string }
interface Invoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  totalJPY: string
  ratio: string
  invoiceType: InvoiceType
  memo: string | null
  sourceFile: string | null
  po: { poNumber: string; vendor: { name: string; country: string } } | null
  deposits: Deposit[]
}

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
}
function formatJPY(n: number) { return `¥${n.toLocaleString()}` }
function getFlag(country: string) {
  return ({ KR: '🇰🇷', JP: '🇯🇵', CN: '🇨🇳', US: '🇺🇸' } as Record<string, string>)[country] || '🌐'
}

const TYPE_CONFIG: Record<InvoiceType, { label: string; color: string; bg: string; icon: string }> = {
  REGULAR:   { label: '일반',   color: 'var(--accent)',  bg: 'rgba(99,102,241,0.12)',  icon: '📄' },
  TRANSPORT: { label: '운송비', color: '#60a5fa',        bg: 'rgba(59,130,246,0.12)', icon: '🚢' },
  SAMPLE:    { label: '샘플',   color: '#c084fc',        bg: 'rgba(168,85,247,0.12)', icon: '🧪' },
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'ALL',       label: '전체',   icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: 'REGULAR',   label: '일반',   icon: <FileText      className="w-3.5 h-3.5" /> },
  { key: 'TRANSPORT', label: '운송비', icon: <Truck         className="w-3.5 h-3.5" /> },
  { key: 'SAMPLE',    label: '샘플',   icon: <FlaskConical  className="w-3.5 h-3.5" /> },
]

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('ALL')

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invoices')
      if (!res.ok) throw new Error('조회 실패')
      setInvoices(await res.json())
    } catch { /* 무시 */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const filtered = activeTab === 'ALL' ? invoices : invoices.filter(i => i.invoiceType === activeTab)

  const counts = {
    ALL:       invoices.length,
    REGULAR:   invoices.filter(i => i.invoiceType === 'REGULAR').length,
    TRANSPORT: invoices.filter(i => i.invoiceType === 'TRANSPORT').length,
    SAMPLE:    invoices.filter(i => i.invoiceType === 'SAMPLE').length,
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            일본 청구 관리
          </h1>
        </div>
        <button
          id="invoice-upload-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer' }}
        >
          <Upload className="w-4 h-4" />
          청구서 업로드
        </button>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', gap: '6px', marginBottom: '16px',
        padding: '5px', background: 'rgba(255,255,255,0.03)',
        borderRadius: '14px', border: '1px solid var(--border)',
        width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '10px', border: 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 400,
              background: activeTab === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            <span style={{
              fontSize: '11px', fontWeight: 700,
              padding: '1px 6px', borderRadius: '20px',
              background: activeTab === tab.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-subtle)',
            }}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="glass-card flex items-center justify-center py-16">
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>불러오는 중...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16">
          <ClipboardList className="w-10 h-10 mb-4" style={{ color: 'var(--text-subtle)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {activeTab === 'ALL' ? '청구 내역이 없습니다' : `${TYPE_CONFIG[activeTab as InvoiceType]?.label} 청구 내역이 없습니다`}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            청구서 이미지를 업로드하면 AI가 자동으로 등록합니다
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <Upload className="w-4 h-4" />
            청구서 업로드
          </button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="erp-table">
            <thead>
              <tr>
                <th>청구번호</th>
                <th>유형</th>
                <th>P/O 번호</th>
                <th>발주처</th>
                <th>청구일</th>
                <th style={{ textAlign: 'right' }}>합계 (JPY)</th>
                <th style={{ textAlign: 'right' }}>청구액 (JPY)</th>
                <th>비율</th>
                <th>입금</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const depositTotal = inv.deposits.reduce((s, d) => s + Number(d.amountJPY), 0)
                const depositRate = Number(inv.totalJPY) > 0 ? depositTotal / Number(inv.totalJPY) : 0
                const invoiceJPY = Math.round(Number(inv.totalJPY) * Number(inv.ratio))
                const cfg = TYPE_CONFIG[inv.invoiceType]

                return (
                  <tr key={inv.id}>
                    <td className="mono text-sm font-medium" style={{ color: 'var(--accent)' }}>
                      <div>{inv.invoiceNo}</div>
                      {inv.sourceFile && (
                        <div style={{ fontSize: '10px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          📎 {inv.sourceFile}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                        background: cfg.bg, color: cfg.color,
                      }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td>
                      {inv.po ? (
                        <Link href={`/purchase-orders/${inv.po.poNumber}`} className="mono text-sm hover:underline"
                          style={{ color: 'var(--status-issued)' }}>
                          {inv.po.poNumber}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {inv.po ? `${getFlag(inv.po.vendor.country)} ${inv.po.vendor.name}` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-subtle)' }}>{formatDate(inv.invoiceDate)}</td>
                    <td className="mono text-right" style={{ color: 'var(--text-muted)' }}>
                      {formatJPY(Number(inv.totalJPY))}
                    </td>
                    <td className="mono font-semibold text-right" style={{ color: 'var(--text-primary)' }}>
                      {formatJPY(invoiceJPY)}
                    </td>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>
                      {(Number(inv.ratio) * 100).toFixed(0)}%
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar" style={{ width: '50px' }}>
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

      {showModal && (
        <InvoiceUploadModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchInvoices() }}
        />
      )}
    </div>
  )
}

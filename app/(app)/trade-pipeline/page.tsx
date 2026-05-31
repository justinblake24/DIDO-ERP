'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Upload, CheckCircle, Package, FileText, DollarSign, Ship, TrendingUp, TrendingDown, BarChart2, Users } from 'lucide-react'

// ── 타입 ──────────────────────────────────────────────────────────────
interface TradeCase {
  id: string
  caseName: string
  nhDhNumber: string | null
  status: string
  createdAt: string
  summary: {
    docCount: number
    verifiedCount: number
    poCount: number
    invoiceCount: number
    totalInvoicedJPY: number
    totalDepositedJPY: number
    paymentComplete: boolean
  }
}

interface AnalyticsTotals {
  caseCount: number
  completedCount: number
  revenueJPY: number
  depositedJPY: number
  costJPY: number
  profitJPY: number
  revenueKRW: number
  costKRW: number
  profitKRW: number
  marginPct: number
  avgJpyKrw: number
}

interface AnalyticsVendor {
  name: string
  country: string
  caseCount: number
  revenueJPY: number
  costJPY: number
}

interface MonthlyTrend {
  month: number
  revenueJPY: number
  costJPY: number
  profitJPY: number
  caseCount: number
}

interface Analytics {
  totals: AnalyticsTotals
  vendors: AnalyticsVendor[]
  monthlyTrend: MonthlyTrend[]
}

// ── 상태 설정 ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; nextAction?: string; nextLabel?: string }> = {
  DOCUMENTS_UPLOADED: { label: '문서 업로드', color: '#6366f1', icon: '📁', nextAction: 'review', nextLabel: '검토 시작 →' },
  PARSED:             { label: '파싱 완료',   color: '#f59e0b', icon: '🔍', nextAction: 'review', nextLabel: '검토 시작 →' },
  REVIEWED:           { label: '검토 완료',   color: '#3b82f6', icon: '✅', nextAction: 'po',     nextLabel: '발주서 생성 →' },
  PO_CREATED:         { label: '발주서 생성', color: '#8b5cf6', icon: '📋', nextAction: 'ship',   nextLabel: '선적 입력 →' },
  SHIPPED:            { label: '선적 완료',   color: '#06b6d4', icon: '🚢', nextAction: 'invoice',nextLabel: '청구서 연결 →' },
  INVOICED:           { label: '청구 완료',   color: '#f59e0b', icon: '📄', nextAction: 'payment',nextLabel: '입금 확인 →' },
  PAYMENT_PENDING:    { label: '입금 대기',   color: '#ef4444', icon: '⏳', nextAction: 'payment',nextLabel: '입금 처리 →' },
  COMPLETED:          { label: '완료',        color: '#10b981', icon: '🎉' },
}

const PIPELINE_STEPS = [
  { key: 'upload',   label: '업로드', icon: Upload },
  { key: 'review',   label: '검토',   icon: CheckCircle },
  { key: 'po',       label: '발주',   icon: Package },
  { key: 'shipping', label: '선적',   icon: Ship },
  { key: 'invoice',  label: '청구',   icon: FileText },
  { key: 'payment',  label: '입금',   icon: DollarSign },
]

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    DOCUMENTS_UPLOADED: 0, PARSED: 0, REVIEWED: 1,
    PO_CREATED: 2, SHIPPED: 3, INVOICED: 4, PAYMENT_PENDING: 5, COMPLETED: 6,
  }
  return map[status] ?? 0
}

function fmtJPY(n: number) { return `¥${n.toLocaleString()}` }
function fmtKRW(n: number) { return `₩${Math.round(n / 1000).toLocaleString()}천` }

// ── 직원 뷰 ───────────────────────────────────────────────────────────
function StaffView({ cases, loading }: { cases: TradeCase[]; loading: boolean }) {
  const needsAction = cases.filter(c => c.status !== 'COMPLETED')
  const done = cases.filter(c => c.status === 'COMPLETED')
  const [showDone, setShowDone] = useState(false)

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-subtle)' }}>불러오는 중...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 액션 필요 섹션 */}
      <div>
        <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
            처리 필요 <span style={{ color: '#f59e0b' }}>({needsAction.length})</span>
          </h2>
        </div>
        {needsAction.length === 0 ? (
          <div className="erp-card" style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
            <div style={{ color: 'var(--text-muted)' }}>모든 거래가 완료되었습니다!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {needsAction.map(c => <CaseCard key={c.id} c={c} />)}
          </div>
        )}
      </div>

      {/* 완료 섹션 */}
      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span className="font-bold text-lg" style={{ color: 'var(--text-muted)' }}>
              완료된 거래 ({done.length}) {showDone ? '▲' : '▼'}
            </span>
          </button>
          {showDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {done.map(c => <CaseCard key={c.id} c={c} />)}
            </div>
          )}
        </div>
      )}

      {cases.length === 0 && (
        <div className="erp-card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>아직 거래 케이스가 없습니다</div>
          <Link href="/trade-pipeline/import">
            <button className="erp-btn-primary flex items-center gap-2 mx-auto mt-6" style={{ padding: '12px 24px' }}>
              <Upload className="w-4 h-4" /> 첫 거래 업로드
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}

function CaseCard({ c }: { c: TradeCase }) {
  const stepIdx = getStepIndex(c.status)
  const conf = STATUS_CONFIG[c.status] || { label: c.status, color: 'var(--text-muted)', icon: '•' }
  const pct = Math.round((stepIdx / 6) * 100)

  return (
    <Link href={`/trade-pipeline/${c.id}`} style={{ textDecoration: 'none' }}>
      <div className="erp-card" style={{ padding: '20px 24px', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: '18px' }}>{conf.icon}</span>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '16px' }}>{c.caseName}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${conf.color}22`, color: conf.color }}>
                {conf.label}
              </span>
            </div>
            {c.nhDhNumber && (
              <div className="text-sm mono mt-1" style={{ color: '#f59e0b' }}>{c.nhDhNumber}</div>
            )}
            {/* 진행바 */}
            <div style={{ marginTop: '12px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                <div className="flex items-center gap-1">
                  {PIPELINE_STEPS.map((step, i) => {
                    const Icon = step.icon
                    const done = i < stepIdx
                    const cur = i === stepIdx
                    return (
                      <div key={step.key} className="flex items-center gap-0.5">
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: done ? '#10b981' : cur ? conf.color : 'var(--bg-card-hover)',
                          border: `2px solid ${done ? '#10b981' : cur ? conf.color : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon style={{ width: '10px', height: '10px', color: done || cur ? 'white' : 'var(--text-subtle)' }} />
                        </div>
                        {i < PIPELINE_STEPS.length - 1 && (
                          <div style={{ width: '16px', height: '2px', background: i < stepIdx ? '#10b981' : 'var(--border)' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
                <span className="text-xs font-bold" style={{ color: conf.color }}>{pct}%</span>
              </div>
            </div>
          </div>
          {conf.nextLabel && (
            <div style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              background: `${conf.color}18`, color: conf.color, whiteSpace: 'nowrap', alignSelf: 'center',
            }}>
              {conf.nextLabel}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>문서 {c.summary.verifiedCount}/{c.summary.docCount}</span>
          {c.summary.totalInvoicedJPY > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {fmtJPY(c.summary.totalInvoicedJPY)}
              {c.summary.paymentComplete && <span style={{ color: '#10b981' }}> ✓ 입금완료</span>}
            </span>
          )}
          {c.summary.poCount > 0 && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>P/O {c.summary.poCount}건</span>}
          <span className="text-xs ml-auto" style={{ color: 'var(--text-subtle)' }}>
            {new Date(c.createdAt).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── 대표 뷰 ───────────────────────────────────────────────────────────
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function ExecView() {
  const now = new Date()
  const [period, setPeriod] = useState('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/trade-pipeline/analytics?period=${period}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [period, year, month])

  useEffect(() => { load() }, [load])

  const t = data?.totals
  const trend = data?.monthlyTrend || []
  const maxRev = Math.max(...trend.map(m => m.revenueJPY), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 기간 선택 */}
      <div className="erp-card" style={{ padding: '16px 20px' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>기간 선택</span>
          {(['monthly','quarterly','halfyear','yearly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: period === p ? 'var(--accent)' : 'var(--bg-card-hover)',
                color: period === p ? 'white' : 'var(--text-muted)',
              }}>
              {p === 'monthly' ? '월간' : p === 'quarterly' ? '분기' : p === 'halfyear' ? '반기' : '연간'}
            </button>
          ))}
          <select value={year} onChange={e => setYear(+e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          {period === 'monthly' && (
            <select value={month} onChange={e => setMonth(+e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-subtle)' }}>분석 데이터 로딩 중...</div>
      ) : (
        <>
          {/* KPI 카드 4개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { label: '총 매출액 (JPY)', value: fmtJPY(t?.revenueJPY ?? 0), sub: fmtKRW((t?.revenueKRW ?? 0)), icon: <BarChart2 className="w-5 h-5" />, color: '#6366f1' },
              { label: '총 원가 (JPY)',   value: fmtJPY(t?.costJPY ?? 0),    sub: fmtKRW((t?.costKRW ?? 0)),    icon: <Package className="w-5 h-5" />,  color: '#f59e0b' },
              { label: '영업이익 (JPY)',  value: fmtJPY(t?.profitJPY ?? 0),  sub: fmtKRW((t?.profitKRW ?? 0)),  icon: (t?.profitJPY ?? 0) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />, color: (t?.profitJPY ?? 0) >= 0 ? '#10b981' : '#ef4444' },
              { label: '이익률',          value: `${t?.marginPct ?? 0}%`,     sub: `${t?.caseCount ?? 0}건 / 완료 ${t?.completedCount ?? 0}건`, icon: <TrendingUp className="w-5 h-5" />, color: '#3b82f6' },
            ].map((kpi, i) => (
              <div key={i} className="erp-card" style={{ padding: '20px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>{kpi.label}</span>
                  <div style={{ color: kpi.color }}>{kpi.icon}</div>
                </div>
                <div className="font-black" style={{ fontSize: '22px', color: kpi.color }}>{kpi.value}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '4px' }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* 월별 트렌드 차트 */}
          <div className="erp-card" style={{ padding: '24px' }}>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>
              📊 {year}년 월별 매출 / 이익 트렌드
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px' }}>
              {trend.map((m) => {
                const revH = maxRev > 0 ? (m.revenueJPY / maxRev) * 130 : 0
                const profH = maxRev > 0 ? (Math.max(0, m.profitJPY) / maxRev) * 130 : 0
                const isProfit = m.profitJPY >= 0
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ position: 'relative', width: '100%', height: '130px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px' }}>
                      <div style={{ width: '45%', height: `${revH}px`, background: '#6366f120', borderRadius: '4px 4px 0 0', border: '1px solid #6366f140' }} title={`매출: ${fmtJPY(m.revenueJPY)}`} />
                      <div style={{ width: '45%', height: `${profH}px`, background: isProfit ? '#10b98140' : '#ef444440', borderRadius: '4px 4px 0 0', border: `1px solid ${isProfit ? '#10b98160' : '#ef444460'}` }} title={`이익: ${fmtJPY(m.profitJPY)}`} />
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>{m.month}월</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4" style={{ marginTop: '12px' }}>
              <div className="flex items-center gap-1"><div style={{ width: '12px', height: '12px', background: '#6366f120', border: '1px solid #6366f140', borderRadius: '2px' }} /><span className="text-xs" style={{ color: 'var(--text-subtle)' }}>매출</span></div>
              <div className="flex items-center gap-1"><div style={{ width: '12px', height: '12px', background: '#10b98140', border: '1px solid #10b98160', borderRadius: '2px' }} /><span className="text-xs" style={{ color: 'var(--text-subtle)' }}>이익</span></div>
            </div>
          </div>

          {/* 업체별 거래 현황 */}
          {(data?.vendors?.length ?? 0) > 0 && (
            <div className="erp-card" style={{ padding: '24px' }}>
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
                <Users className="w-4 h-4" /> 업체별 거래 현황
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data!.vendors.map((v, i) => (
                  <div key={i} className="flex items-center gap-4" style={{ padding: '12px 16px', background: 'var(--bg-card-hover)', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{v.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-subtle)' }}>{v.country}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '2px' }}>{v.caseCount}건</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{fmtJPY(v.costJPY)}</div>
                      <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>원가</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────
export default function TradePipelinePage() {
  const [view, setView] = useState<'staff' | 'exec'>('staff')
  const [cases, setCases] = useState<TradeCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trade-pipeline')
      .then(r => r.json())
      .then(d => setCases(d.cases || []))
      .finally(() => setLoading(false))
  }, [])

  const active = cases.filter(c => c.status !== 'COMPLETED').length
  const done = cases.filter(c => c.status === 'COMPLETED').length

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>🚢 무역 파이프라인</h1>
          <p style={{ color: 'var(--text-subtle)', marginTop: '4px', fontSize: '14px' }}>일본 → 한국 → 중국 거래 흐름 추적</p>
        </div>
        <Link href="/trade-pipeline/import">
          <button className="erp-btn-primary flex items-center gap-2" style={{ padding: '10px 20px' }}>
            <Plus className="w-4 h-4" /> 새 거래 업로드
          </button>
        </Link>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-2" style={{ marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {([
          { key: 'staff', label: '👷 직원 뷰', sub: `진행 ${active}건` },
          { key: 'exec',  label: '📊 대표 뷰', sub: `완료 ${done}건` },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
              background: 'none', position: 'relative', bottom: '-2px',
              color: view === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: view === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
            {tab.label}
            <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-subtle)' }}>({tab.sub})</span>
          </button>
        ))}
      </div>

      {/* 뷰 콘텐츠 */}
      {view === 'staff' ? (
        <StaffView cases={cases} loading={loading} />
      ) : (
        <ExecView />
      )}
    </div>
  )
}

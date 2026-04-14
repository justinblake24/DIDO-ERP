// app/(app)/page.tsx
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { formatKRW, formatJPY, formatDate, getCountryFlag, STATUS_LABELS } from '@/lib/utils'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Package, DollarSign,
  AlertTriangle, Users, ArrowRight, FileText, Upload, BarChart3,
  CheckCircle2, Clock, Zap
} from 'lucide-react'
import POStatusBadge from '@/components/po/POStatusBadge'
import DashboardCharts from './DashboardCharts'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { email: authUser.email || '' },
  })

  // KPI 데이터
  const now = new Date()
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const prevQuarterStart = new Date(quarterStart)
  prevQuarterStart.setMonth(prevQuarterStart.getMonth() - 3)

  const [
    totalPOs,
    activePOs,
    completedPOs,
    cancelledPOs,
    recentPOs,
    vendors,
    poItems,
  ] = await Promise.all([
    prisma.purchaseOrder.count(),
    prisma.purchaseOrder.count({
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    }),
    prisma.purchaseOrder.count({
      where: { status: 'COMPLETED' },
    }),
    prisma.purchaseOrder.count({
      where: { status: 'CANCELLED' },
    }),
    prisma.purchaseOrder.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { name: true, country: true } },
        items: { take: 1, select: { productName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.vendor.count({ where: { active: true } }),
    prisma.pOItem.findMany({
      where: {
        po: { issueDate: { gte: quarterStart } },
        currency: 'KRW',
      },
      select: { totalAmount: true },
    }),
  ])

  // AuditLog는 컬럼 불일치 가능성 있어 별도 try/catch
  const recentAuditLogs = await prisma.auditLog.findMany({
    take: 4,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  }).catch(() => [])

  const quarterRevenue = poItems.reduce((sum, i) => sum + Number(i.totalAmount), 0)

  const actionLabels: Record<string, string> = {
    CREATE: '생성',
    UPDATE: '수정',
    DELETE: '삭제',
    STATUS_CHANGE: '상태 변경',
    LOGIN: '로그인',
    EXPORT: '내보내기',
  }

  const greeting = () => {
    const h = now.getHours()
    if (h < 12) return '좋은 아침이에요'
    if (h < 18) return '좋은 오후예요'
    return '좋은 저녁이에요'
  }

  const formatDateTimeKR = (d: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const yy = String(d.getFullYear()).slice(2)
    const mo = d.getMonth() + 1
    const dd = d.getDate()
    const day = days[d.getDay()]
    const h = d.getHours()
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${yy}년 ${mo}월 ${dd}일(${day}) ${ampm} ${h12}:${mm}`
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div className="glass-card p-6 mb-6" style={{ background: 'rgba(255,192,0,0.05)', borderColor: 'rgba(255,192,0,0.2)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              {formatDateTimeKR(now)}
            </p>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {greeting()}, {dbUser?.name ?? ''},님 👋
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              현재 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{activePOs}건</span>의 발주가 진행 중입니다.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
            <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span>{formatDate(now)} 기준</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* 이번 분기 발주액 */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              이번 분기 발주액
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,192,0,0.15)' }}>
              <DollarSign className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <div className="text-2xl font-bold mono mb-1" style={{ color: 'var(--text-primary)' }}>
            {formatKRW(quarterRevenue)}
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--status-completed)' }}>
            <TrendingUp className="w-3 h-3" />
            <span>이번 분기</span>
          </div>
        </div>

        {/* 총 PO 건수 */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              총 PO 건수
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.15)' }}>
              <FileText className="w-4 h-4" style={{ color: 'var(--status-issued)' }} />
            </div>
          </div>
          <div className="text-2xl font-bold mono mb-1" style={{ color: 'var(--text-primary)' }}>
            {totalPOs}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            진행중 <span style={{ color: 'var(--status-issued)', fontWeight: 600 }}>{activePOs}건</span>
          </div>
        </div>

        {/* 활성 발주처 */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              활성 발주처
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.15)' }}>
              <Users className="w-4 h-4" style={{ color: 'var(--status-paid)' }} />
            </div>
          </div>
          <div className="text-2xl font-bold mono mb-1" style={{ color: 'var(--text-primary)' }}>
            {vendors}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            국내 + 해외 발주처
          </div>
        </div>

        {/* 완료율 */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              완료율
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--status-completed)' }} />
            </div>
          </div>
          <div className="text-2xl font-bold mono mb-1" style={{ color: 'var(--text-primary)' }}>
            {totalPOs > 0 ? Math.round((completedPOs / totalPOs) * 100) : 0}%
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs" style={{ color: 'var(--status-completed)' }}>
              ✓ 완료 {completedPOs}건
            </div>
            <div className="text-xs" style={{ color: 'var(--status-cancelled)' }}>
              ✕ 취소 {cancelledPOs}건
            </div>
          </div>
        </div>
      </div>

      {/* Charts + Recent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <DashboardCharts />

        {/* Recent Audit Logs */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              최근 활동
            </h2>
            <Link href="/audit" className="text-xs" style={{ color: 'var(--accent)' }}>
              전체 보기
            </Link>
          </div>
          <div className="space-y-3">
            {recentAuditLogs.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-subtle)' }}>
                활동 내역이 없습니다
              </p>
            )}
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  {log.user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {log.user.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-subtle)' }}>
                    {log.table} · {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent POs */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            최근 발주
          </h2>
          <Link href="/purchase-orders"
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--accent)' }}>
            전체 보기 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {recentPOs.map((po) => (
            <Link key={po.id} href={`/purchase-orders/${po.id}`}>
              <div className="flex items-center gap-4 p-3 rounded-xl transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                {/* PO Number */}
                <div className="mono text-sm font-medium" style={{ color: 'var(--accent)', minWidth: '200px' }}>
                  {po.poNumber}
                </div>
                {/* Vendor */}
                <div className="flex items-center gap-2 flex-1">
                  <span>{getCountryFlag(po.vendor.country)}</span>
                  <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {po.vendor.name}
                  </span>
                </div>
                {/* Product */}
                <div className="text-sm truncate" style={{ color: 'var(--text-subtle)', flex: 1 }}>
                  {po.items[0]?.productName}
                  {po._count.items > 1 && ` 외 ${po._count.items - 1}건`}
                </div>
                {/* Date */}
                <div className="text-xs mono" style={{ color: 'var(--text-subtle)' }}>
                  {formatDate(po.issueDate)}
                </div>
                {/* Status */}
                <POStatusBadge status={po.status} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Link href="/purchase-orders/new">
          <div className="glass-card p-4 flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-dim)' }}>
              <FileText className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                신규 발주
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                새 P/O 작성
              </div>
            </div>
          </div>
        </Link>
        <Link href="/purchase-orders/import">
          <div className="glass-card p-4 flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Upload className="w-5 h-5" style={{ color: 'var(--status-issued)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                엑셀 Import
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                기존 양식 업로드
              </div>
            </div>
          </div>
        </Link>
        <Link href="/reports">
          <div className="glass-card p-4 flex items-center gap-3 cursor-pointer">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)' }}>
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--status-completed)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                리포트
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                분기/월별 리포트
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

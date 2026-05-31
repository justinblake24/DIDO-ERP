'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Package, Ship, DollarSign,
  CheckCircle, Clock, AlertTriangle, Edit3, Save, X, Plus, Trash2, Link as LinkIcon, Layers, ArrowRight, Database,
  ChevronDown, ChevronUp
} from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'DOCUMENTS_UPLOADED', label: '📁 문서 업로드' },
  { value: 'PARSED',             label: '🔍 파싱 완료' },
  { value: 'REVIEWED',           label: '✅ 검토 완료' },
  { value: 'PO_CREATED',         label: '📋 발주서 생성' },
  { value: 'SHIPPED',            label: '🚢 선적 완료' },
  { value: 'INVOICED',           label: '📄 청구 완료' },
  { value: 'PAYMENT_PENDING',    label: '⏳ 입금 대기' },
  { value: 'COMPLETED',          label: '🎉 완료' },
]

const STATUS_COLOR: Record<string, string> = {
  DOCUMENTS_UPLOADED: '#6366f1', PARSED: '#f59e0b', REVIEWED: '#3b82f6',
  PO_CREATED: '#8b5cf6', SHIPPED: '#06b6d4', INVOICED: '#f59e0b',
  PAYMENT_PENDING: '#ef4444', COMPLETED: '#10b981',
}

const DOC_TYPE_LABEL: Record<string, string> = {
  JP_PO: '🇯🇵 일본 発注書', KR_PO_INTL: '🌍 해외 발주서',
  KR_PO_LOCAL: '🇰🇷 국내 발주서', INVOICE_NOAH: '📄 請求書',
  SHIPPING_DOC: '📦 선적서류',
}

const PIPELINE_STAGES = [
  { id: 'DOMESTIC_PO', title: '1. 국내 발주', icon: '🇰🇷', docTypes: ['KR_PO_LOCAL'] },
  { id: 'EXPORT_PO', title: '2. 해외 발주', icon: '🌍', docTypes: ['JP_PO', 'KR_PO_INTL'] },
  { id: 'SHIPPING', title: '3. 선적', icon: '🚢', docTypes: ['SHIPPING_DOC'] },
  { id: 'INVOICE', title: '4. 청구/입금', icon: '💰', docTypes: ['INVOICE_NOAH'] },
]

interface TradeCase {
  id: string
  caseName: string
  nhDhNumber: string | null
  status: string
  memo: string | null
  createdAt: string
  updatedAt: string
  documents: Array<{
    id: string; docType: string; docNumber: string | null
    fileName: string; confidence: number; verified: boolean
    parsedData: Record<string, unknown>; createdAt: string
  }>
  shippingInfo: {
    portOfLoading: string; portOfDischarge: string
    carrier: string | null; containerNos: string[]
    incoterms: string | null; etd: string | null; eta: string | null
  } | null
  linkedPOs: Array<{
    id: string; poNumber: string; status: string
    vendor: { name: string } | null; issueDate: string
    items: Array<{ totalAmount: number }>
  }>
  linkedInvoices: Array<{
    id: string; invoiceNo: string; totalJPY: number; invoiceDate: string
    deposits: Array<{ id: string; amountJPY: number; depositDate: string }>
  }>
  summary: {
    docCount: number; verifiedCount: number; poCount: number; invoiceCount: number
    totalPOJPY: number; totalInvoicedJPY: number; totalDepositedJPY: number
    remainingJPY: number; paymentComplete: boolean
  }
}

export default function TradeCaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tc, setTc] = useState<TradeCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMemo, setEditMemo] = useState(false)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'items'>('overview')

  // PO Modal state
  const [showPOModal, setShowPOModal] = useState(false)
  const [availablePOs, setAvailablePOs] = useState<any[]>([])
  
  // Invoice Modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([])
  
  // Accordion state
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
  const toggleRow = (idx: number) => {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }))
  }
  const [itemFilter, setItemFilter] = useState<'all' | 'warning' | 'progress' | 'completed'>('all')

  // Shipping Edit state
  const [editShipping, setEditShipping] = useState(false)
  const [shippingForm, setShippingForm] = useState({
    portOfLoading: '', portOfDischarge: '', carrier: '',
    incoterms: '', etd: '', eta: '', containerNos: ''
  })

  function loadData() {
    fetch(`/api/trade-pipeline/${id}`)
      .then(r => r.json())
      .then(d => { setTc(d); setMemo(d.memo || '') })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [id])

  // --- Item Auto-Matching Logic ---
  const matchedRows = useMemo(() => {
    if (!tc) return []

    const allItems: Array<{ docIndex: number; item: any }> = []
    tc.documents.forEach((d, i) => {
      const parsed = d.parsedData as any
      if (parsed && parsed.items) {
        parsed.items.forEach((it: any) => allItems.push({ docIndex: i, item: it }))
      }
    })

    const rows: Array<Record<number, any>> = []
    const used = new Set<any>()

    for (const { docIndex, item } of allItems) {
      if (used.has(item)) continue

      const currentParsed = tc.documents[docIndex].parsedData as any
      const row: Record<number, any> = { [docIndex]: item }
      used.add(item)

      for (let i = 0; i < tc.documents.length; i++) {
        if (i === docIndex) continue

        const otherParsed = tc.documents[i].parsedData as any
        if (!otherParsed || !otherParsed.items) continue

        const match = otherParsed.items.find((other: any) => {
          if (used.has(other)) return false
          
          if (other.name?.toLowerCase() === item.name?.toLowerCase()) return true
          if (other.qty === item.qty && item.qty !== null && item.qty > 0) return true
          if (other.name?.toLowerCase().includes(item.name?.toLowerCase()) || item.name?.toLowerCase().includes(other.name?.toLowerCase())) return true
          
          // 단일 품목인 경우 무조건 매핑 (이름/수량이 달라도)
          if (currentParsed?.items?.length === 1 && otherParsed.items.length === 1) return true

          return false
        })

        if (match) {
          row[i] = match
          used.add(match)
        }
      }
      rows.push(row)
    }

    return rows
  }, [tc])

  // --- Processed Rows with Anomalies & Filters ---
  const processedRows = useMemo(() => {
    return matchedRows.map((row, rIdx) => {
      const getStageItem = (stageDocTypes: string[]) => {
        if (!tc) return null
        for (let i = 0; i < tc.documents.length; i++) {
          if (stageDocTypes.includes(tc.documents[i].docType) && row[i]) {
            return row[i]
          }
        }
        return null
      }

      const domItem = getStageItem(PIPELINE_STAGES[0].docTypes)
      const expItem = getStageItem(PIPELINE_STAGES[1].docTypes)
      const shipItem = getStageItem(PIPELINE_STAGES[2].docTypes)
      const invItem = getStageItem(PIPELINE_STAGES[3].docTypes)

      let name = 'Unknown Item'
      const firstItem = Object.values(row)[0]
      if (firstItem && (firstItem as any).name) {
        name = (firstItem as any).name
      }
      if (domItem?.name) name = domItem.name
      else if (expItem?.name) name = expItem.name
      else if (invItem?.name) name = invItem.name

      const step1_matched = !!domItem
      const step2_matched = !!expItem
      const step3_matched = !!shipItem
      const step4_matched = !!invItem
      const matchedCount = (step1_matched ? 1 : 0) + (step2_matched ? 1 : 0) + (step3_matched ? 1 : 0) + (step4_matched ? 1 : 0)

      // 이상 징후 분석
      const isMissingCost = (step3_matched || step4_matched) && !step1_matched // 국내 발주(매입) 누락
      const isMissingOrder = step4_matched && !step2_matched // 해외 수주 누락
      const isMissingShipment = step4_matched && !step3_matched // 선적 누락
      const isAnomaly = isMissingCost || isMissingOrder || isMissingShipment

      let statusGroup: 'completed' | 'progress' | 'warning' = 'progress'
      if (isAnomaly) {
        statusGroup = 'warning'
      } else if (matchedCount === 4) {
        statusGroup = 'completed'
      }

      return {
        row,
        rIdx,
        name,
        domItem,
        expItem,
        shipItem,
        invItem,
        step1_matched,
        step2_matched,
        step3_matched,
        step4_matched,
        matchedCount,
        isMissingCost,
        isMissingOrder,
        isMissingShipment,
        isAnomaly,
        statusGroup
      }
    })
  }, [matchedRows, tc])

  const counts = useMemo(() => {
    let all = processedRows.length
    let warning = 0
    let progress = 0
    let completed = 0

    processedRows.forEach(item => {
      if (item.statusGroup === 'warning') warning++
      else if (item.statusGroup === 'completed') completed++
      else progress++
    })

    return { all, warning, progress, completed }
  }, [processedRows])

  const filteredRows = useMemo(() => {
    if (itemFilter === 'all') return processedRows
    if (itemFilter === 'warning') return processedRows.filter(r => r.statusGroup === 'warning')
    if (itemFilter === 'progress') return processedRows.filter(r => r.statusGroup === 'progress')
    if (itemFilter === 'completed') return processedRows.filter(r => r.statusGroup === 'completed')
    return processedRows
  }, [processedRows, itemFilter])

  // --- Incidental Costs Auto-Matching Logic ---
  const incidentalRows = useMemo(() => {
    if (!tc) return []

    const allCosts: Array<{ docIndex: number; item: any }> = []
    tc.documents.forEach((d, i) => {
      const parsed = d.parsedData as any
      if (parsed && parsed.incidentalCosts) {
        parsed.incidentalCosts.forEach((it: any) => allCosts.push({ docIndex: i, item: it }))
      }
    })

    const rows: Array<Record<number, any>> = []
    const used = new Set<any>()

    for (const { docIndex, item } of allCosts) {
      if (used.has(item)) continue

      const row: Record<number, any> = { [docIndex]: item }
      used.add(item)

      for (let i = 0; i < tc.documents.length; i++) {
        if (i === docIndex) continue

        const otherParsed = tc.documents[i].parsedData as any
        if (!otherParsed || !otherParsed.incidentalCosts) continue

        const match = otherParsed.incidentalCosts.find((other: any) => 
          !used.has(other) && 
          (
            (other.name?.toLowerCase() === item.name?.toLowerCase()) || 
            (other.name?.toLowerCase().includes(item.name?.toLowerCase()) || item.name?.toLowerCase().includes(other.name?.toLowerCase()))
          )
        )

        if (match) {
          row[i] = match
          used.add(match)
        }
      }
      rows.push(row)
    }

    return rows
  }, [tc])

  // --- Total Calculation based on Matched Items ---
  const matchedTotals = useMemo(() => {
    if (!tc) return { 
      exportTotal: { amount: 0, currency: 'KRW' }, 
      invoiceTotal: { amount: 0, currency: 'JPY' }, 
      domesticTotal: { amount: 0, currency: 'KRW' } 
    }
    
    let exportAmount = 0
    let invoiceAmount = 0
    let domesticAmount = 0
    
    let exportCurrency = 'KRW'
    let invoiceCurrency = 'JPY'
    let domesticCurrency = 'KRW'

    const exportIndices = new Set(tc.documents.map((d, i) => ['JP_PO', 'KR_PO_INTL'].includes(d.docType) ? i : -1).filter(i => i !== -1))
    const domesticIndices = new Set(tc.documents.map((d, i) => ['KR_PO_LOCAL'].includes(d.docType) ? i : -1).filter(i => i !== -1))
    const invoiceIndices = new Set(tc.documents.map((d, i) => ['INVOICE_NOAH'].includes(d.docType) ? i : -1).filter(i => i !== -1))

    matchedRows.forEach(row => {
      let rowExp = 0, rowDom = 0, rowInv = 0
      
      Object.entries(row).forEach(([idxStr, item]: [string, any]) => {
        const idx = parseInt(idxStr, 10)
        const amt = item.amount || 0
        const cur = item.currency || null

        if (exportIndices.has(idx)) {
          if (amt > rowExp || rowExp === 0) {
            rowExp = amt
            if (cur && cur !== 'UNKNOWN' && cur !== 'KRW') exportCurrency = cur // JPY/USD 우선
          }
        }
        if (domesticIndices.has(idx)) {
          if (amt > rowDom || rowDom === 0) {
            rowDom = amt
            if (cur && cur !== 'UNKNOWN') domesticCurrency = cur
          }
        }
        if (invoiceIndices.has(idx)) {
          if (amt > rowInv || rowInv === 0) {
            rowInv = amt
            if (cur && cur !== 'UNKNOWN' && cur !== 'KRW') invoiceCurrency = cur // JPY/USD 우선
          }
        }
      })

      exportAmount += rowExp
      domesticAmount += rowDom
      invoiceAmount += rowInv
    })

    incidentalRows.forEach(row => {
      let rowExp = 0, rowDom = 0, rowInv = 0
      
      Object.entries(row).forEach(([idxStr, item]: [string, any]) => {
        const idx = parseInt(idxStr, 10)
        const amt = item.amount || 0
        const cur = item.currency || null

        if (exportIndices.has(idx)) {
          if (amt > rowExp || rowExp === 0) {
            rowExp = amt
            if (cur && cur !== 'UNKNOWN') exportCurrency = cur
          }
        }
        if (domesticIndices.has(idx)) {
          if (amt > rowDom || rowDom === 0) {
            rowDom = amt
            if (cur && cur !== 'UNKNOWN') domesticCurrency = cur
          }
        }
        if (invoiceIndices.has(idx)) {
          if (amt > rowInv || rowInv === 0) {
            rowInv = amt
            if (cur && cur !== 'UNKNOWN') invoiceCurrency = cur
          }
        }
      })

      exportAmount += rowExp
      domesticAmount += rowDom
      invoiceAmount += rowInv
    })

    return { 
      exportTotal: { amount: exportAmount, currency: exportCurrency }, 
      domesticTotal: { amount: domesticAmount, currency: domesticCurrency }, 
      invoiceTotal: { amount: invoiceAmount, currency: invoiceCurrency } 
    }
  }, [tc, matchedRows, incidentalRows])

  const getCurrencySymbol = (currency: string) => {
    switch (currency?.toUpperCase()) {
      case 'USD': return '$'
      case 'JPY': return '¥'
      case 'KRW': return '₩'
      default: return currency ? `${currency} ` : ''
    }
  }

  function fmt(n: number, currency: string = 'JPY') {
    return `${getCurrencySymbol(currency)}${n.toLocaleString()}`
  }

  const getSummaryBriefing = () => {
    const exportAmt = matchedTotals.exportTotal.amount
    const invoiceAmt = matchedTotals.invoiceTotal.amount
    const domesticAmt = matchedTotals.domesticTotal.amount
    const exportCurr = matchedTotals.exportTotal.currency
    const invoiceCurr = matchedTotals.invoiceTotal.currency
    const domesticCurr = matchedTotals.domesticTotal.currency
    const invoiceCount = tc?.linkedInvoices?.length || 0

    const ratio = exportAmt > 0 ? (invoiceAmt / exportAmt) * 100 : 0
    
    let text = `이번 거래는 국내에서 약 ${fmt(domesticAmt, domesticCurr)} 상당의 제품을 매입하여, 해외 바이어측에 총 ${fmt(exportAmt, exportCurr)} 규모의 수출을 진행하는 건입니다. `
    
    if (ratio > 0) {
      if (Math.abs(ratio - 100) < 0.1) {
        text += `발주된 모든 물량이 일시에 선적 및 청구되어 정상 완료되었습니다.`
      } else if (ratio < 99) {
        text += `현재 발주 총액의 약 ${ratio.toFixed(1)}% 분량(${fmt(invoiceAmt, invoiceCurr)})만 먼저 선적하여 총 ${invoiceCount}건의 청구서로 나누어 청구한 '부분 선적(Partial Shipment)' 건입니다.`
      } else {
        text += `발주액 대비 초과 청구(${ratio.toFixed(1)}%)가 발생했습니다. 상세 내역을 점검해 주세요.`
      }
    } else {
      text += `아직 해외 청구(인보이스) 내역이 매핑되지 않아 거래가 대기 중인 상태입니다.`
    }
    return text
  }

  async function saveStatus(status: string) {
    setStatusChanging(true)
    const res = await fetch(`/api/trade-pipeline/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (data.success) {
      loadData()
    }
    setStatusChanging(false)
  }

  async function saveMemo() {
    setSaving(true)
    await fetch(`/api/trade-pipeline/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo }),
    })
    setTc(prev => prev ? { ...prev, memo } : prev)
    setEditMemo(false)
    setSaving(false)
  }

  // --- Actions ---

  async function openPOModal() {
    setShowPOModal(true)
    const res = await fetch('/api/purchase-orders')
    const data = await res.json()
    const poList = Array.isArray(data) ? data : (data.pos || [])
    setAvailablePOs(poList.filter((po: any) => !po.tradeCaseId))
  }

  async function handleLinkPO(poId: string) {
    await fetch(`/api/trade-pipeline/${id}/link-po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId }),
    })
    setShowPOModal(false)
    loadData()
  }

  async function handleUnlinkPO(poId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('발주서 연결을 해제하시겠습니까?')) return
    await fetch(`/api/trade-pipeline/${id}/link-po`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId }),
    })
    loadData()
  }

  async function openInvoiceModal() {
    setShowInvoiceModal(true)
    const res = await fetch('/api/invoices')
    const data = await res.json()
    setAvailableInvoices(data.filter((inv: any) => !inv.tradeCaseId))
  }

  async function handleLinkInvoice(invoiceId: string) {
    await fetch(`/api/trade-pipeline/${id}/link-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    })
    setShowInvoiceModal(false)
    loadData()
  }

  async function handleUnlinkInvoice(invoiceId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('청구서 연결을 해제하시겠습니까?')) return
    await fetch(`/api/trade-pipeline/${id}/link-invoice`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    })
    loadData()
  }

  function startEditShipping() {
    setShippingForm({
      portOfLoading: tc?.shippingInfo?.portOfLoading || '',
      portOfDischarge: tc?.shippingInfo?.portOfDischarge || '',
      carrier: tc?.shippingInfo?.carrier || '',
      incoterms: tc?.shippingInfo?.incoterms || '',
      etd: tc?.shippingInfo?.etd ? tc.shippingInfo.etd.substring(0, 10) : '',
      eta: tc?.shippingInfo?.eta ? tc.shippingInfo.eta.substring(0, 10) : '',
      containerNos: tc?.shippingInfo?.containerNos ? tc.shippingInfo.containerNos.join(', ') : ''
    })
    setEditShipping(true)
  }

  async function saveShipping() {
    setSaving(true)
    const payload = {
      ...shippingForm,
      containerNos: shippingForm.containerNos.split(',').map(s => s.trim()).filter(Boolean)
    }
    await fetch(`/api/trade-pipeline/${id}/shipping`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setEditShipping(false)
    setSaving(false)
    loadData()
  }

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-subtle)' }}>
      불러오는 중...
    </div>
  )

  if (!tc) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>
      케이스를 찾을 수 없습니다.{' '}
      <Link href="/trade-pipeline" style={{ color: 'var(--accent)' }}>목록으로</Link>
    </div>
  )

  const statusColor = STATUS_COLOR[tc.status] || 'var(--text-muted)'

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.push('/trade-pipeline')}
          className="flex items-center gap-2 hover:text-[var(--text-primary)] transition-colors"
          style={{ color: 'var(--text-subtle)', fontSize: 14, marginBottom: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {tc.caseName}
            </h1>
            {tc.nhDhNumber && (
              <div className="mono text-sm mt-1" style={{ color: '#f59e0b' }}>
                {tc.nhDhNumber}
              </div>
            )}
            <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
              생성 {new Date(tc.createdAt).toLocaleDateString('ko-KR')} · 수정 {new Date(tc.updatedAt).toLocaleDateString('ko-KR')}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={tc.status}
              disabled={statusChanging}
              onChange={e => saveStatus(e.target.value)}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: `${statusColor}18`, color: statusColor,
                border: `1.5px solid ${statusColor}40`, cursor: 'pointer',
                appearance: 'auto',
              }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 🚀 상단 동적 브리핑 대시보드 카드 */}
      <div 
        className="erp-card bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
        style={{ padding: '24px', marginBottom: '24px', borderRadius: '16px' }}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold mb-1.5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              📢 한눈에 보는 거래 브리핑
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {getSummaryBriefing()}
            </p>
          </div>
        </div>
      </div>

      {/* 📑 탭 레이아웃 선택 바 */}
      <div className="flex gap-2 border-b border-[var(--border)] mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className="pb-3 px-4 text-sm font-semibold transition-all border-b-2"
          style={{
            borderBottomColor: activeTab === 'overview' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'overview' ? 'var(--accent)' : 'var(--text-subtle)',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer'
          }}
        >
          📊 거래 현황 (Overview)
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className="pb-3 px-4 text-sm font-semibold transition-all border-b-2"
          style={{
            borderBottomColor: activeTab === 'items' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'items' ? 'var(--accent)' : 'var(--text-subtle)',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer'
          }}
        >
          📦 제품 및 비용 매핑 (Item Matching)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {activeTab === 'overview' && (
            <>
              {/* ─── 파이프라인 흐름 시각화 ────────────────────────────────────────────── */}
              <div className="erp-card" style={{ padding: '24px' }}>
                <h2 className="font-semibold text-lg flex items-center gap-2 mb-6">
                  <Layers className="w-5 h-5 text-[var(--accent)]" /> 문서 파이프라인
                </h2>

                <div className="flex gap-4 overflow-x-auto pb-2">
                  {PIPELINE_STAGES.map((stage, stageIdx) => {
                    const stageDocs = tc.documents.filter(d => stage.docTypes.includes(d.docType))
                    
                    return (
                      <div key={stage.id} className="flex-1 min-w-[220px] flex flex-col relative">
                        {/* Stage Header */}
                        <div className="flex items-center gap-2 mb-3 px-2">
                          <span className="text-xl">{stage.icon}</span>
                          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{stage.title}</h3>
                        </div>

                        {/* Stage Documents */}
                        <div className="flex flex-col gap-3 flex-1">
                          {stageDocs.length === 0 ? (
                            <div className="flex-1 border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center p-6 text-xs text-[var(--text-subtle)] text-center bg-[var(--bg-card)] opacity-60">
                              해당 단계 문서 없음
                            </div>
                          ) : (
                            stageDocs.map((doc) => {
                              const confColor = doc.confidence >= 80 ? '#10b981' : doc.confidence >= 60 ? '#f59e0b' : '#ef4444'

                              return (
                                <div key={doc.id} className="relative rounded-xl overflow-hidden transition-all duration-200"
                                     style={{ 
                                       border: `1px solid var(--border)`, 
                                       background: 'var(--bg-card)' 
                                     }}>
                                  <div className="p-3">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                      <div className="font-semibold text-sm line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                        {doc.fileName}
                                      </div>
                                    </div>
                                    {doc.docNumber && (
                                      <div className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{doc.docNumber}</div>
                                    )}
                                    <div className="mt-2 flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 flex-1">
                                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width: `${doc.confidence}%`, background: confColor }} />
                                        </div>
                                        <span className="text-[10px] font-bold" style={{ color: confColor }}>{doc.confidence}%</span>
                                      </div>
                                      {doc.verified && (
                                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981', marginLeft: 8 }}>
                                          ✅ 확인됨
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>

                        {/* Arrow between stages */}
                        {stageIdx < PIPELINE_STAGES.length - 1 && (
                          <div className="absolute right-[-16px] top-[50%] -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-body)] border border-[var(--border)] shadow-sm">
                            <ArrowRight className="w-4 h-4 text-[var(--text-subtle)]" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                {/* 선적 정보 */}
                <div className="erp-card flex flex-col" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Ship className="w-4 h-4" /> 선적 정보
                    </h2>
                    {!editShipping ? (
                      <button onClick={startEditShipping}
                        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Edit3 className="w-3 h-3" /> 수정
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={saveShipping} disabled={saving}
                          className="flex items-center gap-1 text-xs text-[#10b981] hover:underline"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Save className="w-3 h-3" /> 저장
                        </button>
                        <button onClick={() => setEditShipping(false)}
                          className="flex items-center gap-1 text-xs text-[var(--text-subtle)] hover:underline"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <X className="w-3 h-3" /> 취소
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {editShipping ? (
                     <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                       <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">선적항 (POL)</label>
                           <input type="text" value={shippingForm.portOfLoading} onChange={e=>setShippingForm({...shippingForm, portOfLoading: e.target.value})} className="erp-input w-full" />
                         </div>
                         <div>
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">도착항 (POD)</label>
                           <input type="text" value={shippingForm.portOfDischarge} onChange={e=>setShippingForm({...shippingForm, portOfDischarge: e.target.value})} className="erp-input w-full" />
                         </div>
                         <div>
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">선사 (Carrier)</label>
                           <input type="text" value={shippingForm.carrier} onChange={e=>setShippingForm({...shippingForm, carrier: e.target.value})} className="erp-input w-full" />
                         </div>
                         <div>
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">INCOTERMS</label>
                           <input type="text" value={shippingForm.incoterms} onChange={e=>setShippingForm({...shippingForm, incoterms: e.target.value})} className="erp-input w-full" />
                         </div>
                         <div>
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">ETD</label>
                           <input type="date" value={shippingForm.etd} onChange={e=>setShippingForm({...shippingForm, etd: e.target.value})} className="erp-input w-full" />
                         </div>
                         <div>
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">ETA</label>
                           <input type="date" value={shippingForm.eta} onChange={e=>setShippingForm({...shippingForm, eta: e.target.value})} className="erp-input w-full" />
                         </div>
                         <div className="col-span-2">
                           <label className="text-xs text-[var(--text-subtle)] mb-1 block">컨테이너 (쉼표 구분)</label>
                           <input type="text" value={shippingForm.containerNos} onChange={e=>setShippingForm({...shippingForm, containerNos: e.target.value})} className="erp-input w-full" />
                         </div>
                       </div>
                     </div>
                  ) : tc.shippingInfo ? (
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: '선적항', value: tc.shippingInfo.portOfLoading },
                        { label: '도착항', value: tc.shippingInfo.portOfDischarge },
                        { label: '선사', value: tc.shippingInfo.carrier },
                        { label: 'INCOTERMS', value: tc.shippingInfo.incoterms },
                        { label: 'ETD', value: tc.shippingInfo.etd ? new Date(tc.shippingInfo.etd).toLocaleDateString('ko-KR') : null },
                        { label: 'ETA', value: tc.shippingInfo.eta ? new Date(tc.shippingInfo.eta).toLocaleDateString('ko-KR') : null },
                        { label: '컨테이너', value: tc.shippingInfo.containerNos?.join(', ') || null },
                      ].map((row, i) => row.value ? (
                        <div key={i} className="flex justify-between">
                          <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>{row.label}</span>
                          <span className="text-sm font-medium mono" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
                        </div>
                      ) : null)}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ padding: 32, color: 'var(--text-subtle)' }}>
                      <Ship className="w-8 h-8 opacity-20" />
                      <div className="text-sm">선적 정보 없음</div>
                      <button onClick={startEditShipping} className="mt-2 btn-primary text-xs flex items-center gap-1">
                        <Plus className="w-3 h-3" /> 선적 정보 입력
                      </button>
                    </div>
                  )}
                </div>

                {/* 메모 */}
                <div className="erp-card flex flex-col" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Edit3 className="w-4 h-4" /> 메모
                    </h2>
                    {!editMemo ? (
                      <button onClick={() => setEditMemo(true)}
                        style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        수정
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={saveMemo} disabled={saving}
                          className="flex items-center gap-1"
                          style={{ fontSize: 12, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Save className="w-3 h-3" /> 저장
                        </button>
                        <button onClick={() => { setEditMemo(false); setMemo(tc.memo || '') }}
                          style={{ fontSize: 12, color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '16px 20px', flex: 1 }}>
                    {editMemo ? (
                      <textarea
                        value={memo}
                        onChange={e => setMemo(e.target.value)}
                        rows={6}
                        placeholder="메모를 입력하세요..."
                        style={{
                          width: '100%', height: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
                          background: 'var(--bg-input)', border: '1px solid var(--border)',
                          color: 'var(--text-primary)', resize: 'none',
                        }}
                      />
                    ) : (
                      <p style={{ color: tc.memo ? 'var(--text-primary)' : 'var(--text-subtle)', fontSize: 14, whiteSpace: 'pre-wrap' }}>
                        {tc.memo || '메모 없음. 수정 버튼을 눌러 추가하세요.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* 연결된 발주서 */}
                <div className="erp-card flex flex-col" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Package className="w-4 h-4" /> 시스템 발주서 ({tc.linkedPOs.length})
                    </h2>
                    <button onClick={openPOModal} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <LinkIcon className="w-3 h-3" /> 연결 추가
                    </button>
                  </div>
                  {tc.linkedPOs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: 32, color: 'var(--text-subtle)' }}>
                      <div className="text-sm">연결된 발주서 없음</div>
                    </div>
                  ) : (
                    <div>
                      {tc.linkedPOs.map(po => (
                        <Link key={po.id} href={`/purchase-orders/${po.id}`}>
                          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            className="hover:bg-[var(--bg-card-hover)] relative group">
                            <div className="flex justify-between items-start pr-6">
                              <div>
                                <div className="font-medium mono text-sm" style={{ color: 'var(--accent)' }}>{po.poNumber}</div>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{po.vendor?.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                  {fmt(po.items.reduce((s, i) => s + Number(i.totalAmount), 0), 'KRW')}
                                </div>
                                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                                  {new Date(po.issueDate).toLocaleDateString('ko-KR')}
                                </div>
                              </div>
                            </div>
                            {/* 연결 해제 버튼 */}
                            <button 
                              onClick={(e) => handleUnlinkPO(po.id, e)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/10 text-red-500 transition-all"
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              title="연결 해제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* 연결된 청구서 + 입금 */}
                <div className="erp-card flex flex-col" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <DollarSign className="w-4 h-4" /> 시스템 청구서 ({tc.linkedInvoices.length})
                    </h2>
                    <button onClick={openInvoiceModal} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <LinkIcon className="w-3 h-3" /> 연결 추가
                    </button>
                  </div>
                  {tc.linkedInvoices.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: 32, color: 'var(--text-subtle)' }}>
                      <div className="text-sm">연결된 청구서 없음</div>
                    </div>
                  ) : (
                    <div>
                      {tc.linkedInvoices.map(inv => {
                        const deposited = inv.deposits.reduce((s, d) => s + Number(d.amountJPY), 0)
                        const remaining = Number(inv.totalJPY) - deposited
                        const paid = remaining <= 0
                        return (
                          <div key={inv.id} className="relative group" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                            <div className="flex justify-between items-start pr-6">
                              <div>
                                <div className="font-medium mono text-sm" style={{ color: 'var(--accent)' }}>{inv.invoiceNo}</div>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                                  {new Date(inv.invoiceDate).toLocaleDateString('ko-KR')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(Number(inv.totalJPY), 'JPY')}</div>
                                <div className="text-xs mt-0.5" style={{ color: paid ? '#10b981' : '#ef4444' }}>
                                  {paid ? '✅ 완납' : `미수 ${fmt(remaining, 'JPY')}`}
                                </div>
                              </div>
                            </div>
                            {inv.deposits.length > 0 && (
                              <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                                {inv.deposits.map(dep => (
                                  <div key={dep.id} className="flex justify-between text-xs" style={{ color: 'var(--text-subtle)', marginTop: 4 }}>
                                    <span>{new Date(dep.depositDate).toLocaleDateString('ko-KR')}</span>
                                    <span className="font-medium" style={{ color: '#10b981' }}>{fmt(Number(dep.amountJPY), 'JPY')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* 연결 해제 버튼 */}
                            <button 
                              onClick={(e) => handleUnlinkInvoice(inv.id, e)}
                              className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/10 text-red-500 transition-all"
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              title="연결 해제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'items' && (
            <>
              {/* ─── 품목별 매핑 (Item-Level Matching) ────────────────────────────────────────────── */}
              <div className="erp-card" style={{ padding: '24px' }}>
                <h2 className="font-semibold text-lg flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-[var(--accent)]" /> 제품(Item) 자동 매핑 내역
                </h2>
                <p className="text-sm text-[var(--text-subtle)] mb-6">
                  각 단계 서류에서 추출된 제품 항목들을 이름과 수량을 기반으로 비교한 결과입니다. 카드를 클릭하면 상세 타임라인이 열립니다.
                </p>

                {/* 📂 하위 필터 탭 바 */}
                <div className="flex flex-wrap gap-2 mb-6 p-1 bg-[var(--bg-body)] rounded-xl border border-[var(--border)] max-w-max">
                  {[
                    { key: 'all', label: '전체', count: counts.all, color: 'var(--text-primary)' },
                    { key: 'warning', label: '🚨 이상 징후', count: counts.warning, color: '#ef4444', isAlert: true },
                    { key: 'progress', label: '진행 중', count: counts.progress, color: '#f59e0b' },
                    { key: 'completed', label: '완료', count: counts.completed, color: '#10b981' },
                  ].map((tab) => {
                    const isActive = itemFilter === tab.key
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setItemFilter(tab.key as any)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          isActive 
                            ? tab.isAlert 
                              ? 'bg-red-500/10 border-red-500/30 text-red-500'
                              : 'bg-[var(--accent)] border-[var(--accent)] text-white'
                            : 'bg-transparent border-transparent text-[var(--text-subtle)] hover:bg-[var(--bg-card-hover)]'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>{tab.label}</span>
                        <span 
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? tab.isAlert 
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-white/20 text-white'
                              : tab.isAlert && tab.count > 0
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-[var(--border)] text-[var(--text-subtle)]'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-4">
                  {filteredRows.length === 0 ? (
                    <div className="text-center p-12 text-sm text-[var(--text-subtle)] border-2 border-dashed rounded-2xl bg-[var(--bg-card)]">
                      이 필터에 해당하는 품목이 없습니다.
                    </div>
                  ) : (
                    filteredRows.map(({
                      row,
                      rIdx,
                      name,
                      domItem,
                      expItem,
                      shipItem,
                      invItem,
                      step1_matched,
                      step2_matched,
                      step3_matched,
                      step4_matched,
                      matchedCount,
                      isMissingCost,
                      isMissingOrder,
                      isMissingShipment,
                      isAnomaly,
                      statusGroup
                    }) => {
                      const isExpanded = !!expandedRows[rIdx]

                      return (
                        <div key={rIdx} className="rounded-2xl border transition-all duration-200"
                             style={{ 
                               borderColor: isAnomaly
                                 ? 'rgba(239, 68, 68, 0.4)' 
                                 : isExpanded ? 'var(--accent)' : 'var(--border)',
                               background: 'var(--bg-card)',
                               boxShadow: isAnomaly
                                 ? '0 10px 30px -10px rgba(239, 68, 68, 0.08)'
                                 : isExpanded ? '0 10px 30px -10px rgba(99,102,241,0.15)' : 'none'
                             }}>
                          {/* 요약 카드 헤더 (클릭 시 접고 펴짐) */}
                          <div 
                            onClick={() => toggleRow(rIdx)}
                            className="flex items-center justify-between p-5 cursor-pointer select-none hover:bg-[var(--bg-card-hover)] transition-colors rounded-2xl"
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xl">📦</span>
                                <h3 className="font-bold text-base line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                                  {name}
                                </h3>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1"
                                  style={{
                                    background: isAnomaly 
                                      ? 'rgba(239,68,68,0.12)' 
                                      : matchedCount === 4 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                    color: isAnomaly 
                                      ? '#ef4444' 
                                      : matchedCount === 4 ? '#10b981' : '#f59e0b'
                                  }}
                                >
                                  {isAnomaly ? '🚨 흐름 모순' : `${matchedCount}/4 단계 매치`}
                                </span>

                                {/* 이상 징후 배지 상세 노출 */}
                                {isMissingCost && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-bold border border-red-500/20">
                                    ⚠️ 매입원가 누락
                                  </span>
                                )}
                                {isMissingOrder && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-bold border border-red-500/20">
                                    ⚠️ 수주계약 누락
                                  </span>
                                )}
                                {isMissingShipment && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-bold border border-red-500/20">
                                    ⚠️ 선적누락
                                  </span>
                                )}
                              </div>
                              
                              {/* 가격/수량 요약 설명 */}
                              <div className="flex gap-4 text-xs text-[var(--text-subtle)] flex-wrap">
                                {domItem && (
                                  <span>매입: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{domItem.qty?.toLocaleString()} {domItem.unit || 'EA'}</strong></span>
                                )}
                                {invItem && (
                                  <span>청구: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{invItem.qty?.toLocaleString()} {invItem.unit || 'EA'} ({invItem.currency || 'JPY'} {invItem.amount?.toLocaleString()})</strong></span>
                                )}
                              </div>
                            </div>

                            {/* 진행 상태 불빛 칩 (Status Dots) */}
                            <div className="flex items-center gap-6">
                              <div className="hidden md:flex items-center gap-3">
                                {[
                                  { label: '국내발주', matched: step1_matched },
                                  { label: '해외발주', matched: step2_matched },
                                  { label: '선적', matched: step3_matched },
                                  { label: '청구/입금', matched: step4_matched },
                                ].map((st, sIdx) => {
                                  let dotColor = st.matched ? '#10b981' : '#d1d5db'
                                  let shadow = st.matched ? '0 0 6px #10b981' : 'none'
                                  
                                  // 국내발주 누락 경고 상태 시각화
                                  if (sIdx === 0 && !step1_matched && (step3_matched || step4_matched)) {
                                    dotColor = '#ef4444'
                                    shadow = '0 0 6px #ef4444'
                                  }
                                  
                                  return (
                                    <div key={sIdx} className="flex items-center gap-1.5">
                                      <span className="w-2 rounded-full h-2" 
                                        style={{ 
                                          background: dotColor, 
                                          boxShadow: shadow
                                        }} 
                                      />
                                      <span className="text-[11px] font-semibold" style={{ color: st.matched ? 'var(--text-primary)' : 'var(--text-subtle)' }}>
                                        {st.label}
                                      </span>
                                      {sIdx < 3 && <span className="text-[10px] text-gray-300 ml-1">→</span>}
                                    </div>
                                  )
                                })}
                              </div>
                              
                              <div className="text-[var(--text-subtle)]">
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </div>
                            </div>
                          </div>

                          {/* 펼쳐지는 타임라인 영역 */}
                          {isExpanded && (
                            <div className="border-t p-6" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                              <div className="relative border-l-2 pl-6 ml-3 space-y-6" style={{ borderColor: 'var(--border)' }}>
                                {[
                                  { 
                                    title: '1. 국내 발주 (Domestic Purchase)', 
                                    icon: '🇰🇷',
                                    matched: step1_matched, 
                                    item: domItem, 
                                    desc: '국내 공급업체로부터 물품을 매입하는 계약서 정보입니다.',
                                    emptyMsg: isMissingCost ? '🚨 매입 발주가 누락되어 매출 원가가 잡히지 않고 있습니다!' : '연결된 국내 발주서(KR_PO_LOCAL)가 없습니다.'
                                  },
                                  { 
                                    title: '2. 해외 발주 (Export Order)', 
                                    icon: '🌍',
                                    matched: step2_matched, 
                                    item: expItem, 
                                    desc: '일본 바이어로부터 전달받은 수주 계약서(NH-DH) 정보입니다.',
                                    emptyMsg: isMissingOrder ? '🚨 수주 계약서가 누락되어 정식 계약 없이 청구가 진행되었습니다!' : '연결된 해외 발주서(JP_PO / KR_PO_INTL)가 없습니다.'
                                  },
                                  { 
                                    title: '3. 선적 (Shipping / PL)', 
                                    icon: '🚢',
                                    matched: step3_matched, 
                                    item: shipItem, 
                                    desc: '수출 선적서류(Packing List)에 기재된 화물 포장 명세서 정보입니다.',
                                    emptyMsg: isMissingShipment ? '🚨 선적 증빙(PL)이 누락된 채 청구서만 발행되었습니다!' : '연결된 선적 서류(SHIPPING_DOC)가 없습니다.'
                                  },
                                  { 
                                    title: '4. 청구/입금 (Commercial Invoice)', 
                                    icon: '💰',
                                    matched: step4_matched, 
                                    item: invItem, 
                                    desc: '바이어 측에 최종 발행된 상업 청구서(Invoice) 정보입니다.',
                                    emptyMsg: '연결된 청구서(INVOICE_NOAH)가 없습니다.'
                                  },
                                ].map((stage, sIdx) => (
                                  <div key={sIdx} className="relative">
                                    {/* 타임라인 불빛 노드 */}
                                    <span className="absolute left-[-32px] top-1 flex items-center justify-center w-4 h-4 rounded-full border bg-[var(--bg-body)]"
                                      style={{
                                        borderColor: stage.matched ? '#10b981' : (sIdx === 0 && isMissingCost) || (sIdx === 1 && isMissingOrder) || (sIdx === 2 && isMissingShipment) ? '#ef4444' : 'var(--border)'
                                      }}
                                    >
                                      <span className="w-2 h-2 rounded-full" 
                                        style={{ 
                                          background: stage.matched ? '#10b981' : (sIdx === 0 && isMissingCost) || (sIdx === 1 && isMissingOrder) || (sIdx === 2 && isMissingShipment) ? '#ef4444' : '#d1d5db'
                                        }} 
                                      />
                                    </span>

                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h4 className="font-bold text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                          <span>{stage.icon}</span> {stage.title}
                                        </h4>
                                        <p className="text-xs text-[var(--text-subtle)] mt-0.5">{stage.desc}</p>
                                      </div>
                                      
                                      <div className="lg:w-[60%] flex-shrink-0">
                                        {stage.matched ? (
                                          <div className="p-3.5 rounded-xl border" style={{ background: 'var(--bg-card-hover)', borderColor: 'var(--border)' }}>
                                            <div className="font-bold text-sm line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
                                              {stage.item.name}
                                            </div>
                                            <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}>
                                              <span>수량: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{stage.item.qty?.toLocaleString()} {stage.item.unit || 'EA'}</strong></span>
                                              {stage.item.amount && (
                                                <span>금액: <strong className="mono font-semibold" style={{ color: 'var(--accent)' }}>{stage.item.currency} {stage.item.amount?.toLocaleString()}</strong></span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-3.5 rounded-xl border border-dashed flex items-center gap-2 text-xs" 
                                               style={{ 
                                                 background: (sIdx === 0 && isMissingCost) || (sIdx === 1 && isMissingOrder) || (sIdx === 2 && isMissingShipment) ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)', 
                                                 borderColor: (sIdx === 0 && isMissingCost) || (sIdx === 1 && isMissingOrder) || (sIdx === 2 && isMissingShipment) ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)', 
                                                 color: '#ef4444' 
                                               }}>
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                            <span>{stage.emptyMsg}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {incidentalRows.length > 0 && (
                <div className="erp-card mt-6" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <Database className="w-5 h-5 text-[var(--accent)]" /> 부대비용(Incidental Costs) 자동 매핑 내역
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr>
                          <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">국내 발주 (비용)</th>
                          <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">해외 발주 (비용)</th>
                          <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">선적 (비용)</th>
                          <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">청구 (비용)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incidentalRows.map((row, rIdx) => {
                          const getStageItem = (stageDocTypes: string[]) => {
                            for (let i = 0; i < tc.documents.length; i++) {
                              if (stageDocTypes.includes(tc.documents[i].docType) && row[i]) {
                                return row[i]
                              }
                            }
                            return null
                          }

                          const domItem = getStageItem(PIPELINE_STAGES[0].docTypes)
                          const expItem = getStageItem(PIPELINE_STAGES[1].docTypes)
                          const shipItem = getStageItem(PIPELINE_STAGES[2].docTypes)
                          const invItem = getStageItem(PIPELINE_STAGES[3].docTypes)

                          const renderCell = (item: any) => {
                            if (!item) return <div className="text-[var(--text-muted)] text-xs italic opacity-50 px-2 py-1">-</div>
                            return (
                              <div className="bg-[var(--bg-card-hover)] p-2.5 rounded-lg border border-[var(--border)]">
                                <div className="text-sm font-semibold text-[var(--text-primary)] mb-1 line-clamp-2">{item.name}</div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {item.amount && (
                                    <span className="font-mono font-medium text-[var(--accent)]">{item.currency} {item.amount.toLocaleString()}</span>
                                  )}
                                </div>
                              </div>
                            )
                          }

                          return (
                            <tr key={`inc-${rIdx}`} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors">
                              <td className="p-3 align-top">{renderCell(domItem)}</td>
                              <td className="p-3 align-top">{renderCell(expItem)}</td>
                              <td className="p-3 align-top">{renderCell(shipItem)}</td>
                              <td className="p-3 align-top">{renderCell(invItem)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* ─── 오른쪽: 요약 패널 ────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 정제된 재무 요약 */}
          <div className="erp-card" style={{ padding: '20px' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              💰 파이프라인 매핑 요약
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs text-[var(--text-subtle)] mb-1">총 해외 발주액 (매핑 기준)</div>
                <div className="text-xl font-bold mono" style={{ color: '#3b82f6' }}>
                  {fmt(matchedTotals.exportTotal.amount, matchedTotals.exportTotal.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-subtle)] mb-1">총 청구액 (매핑 기준)</div>
                <div className="text-xl font-bold mono" style={{ color: '#10b981' }}>
                  {fmt(matchedTotals.invoiceTotal.amount, matchedTotals.invoiceTotal.currency)}
                </div>
              </div>
              <div className="border-t border-[var(--border)] pt-4 mt-1">
                <div className="text-xs text-[var(--text-subtle)] mb-1">총 국내 매입가액 (추정)</div>
                <div className="text-lg font-semibold mono" style={{ color: 'var(--text-primary)' }}>
                  {fmt(matchedTotals.domesticTotal.amount, matchedTotals.domesticTotal.currency)}
                </div>
              </div>
            </div>
          </div>

          {/* NH-DH 핵심 키 */}
          {tc.nhDhNumber && (
            <div className="erp-card" style={{ padding: '16px 20px' }}>
              <div className="text-xs" style={{ color: 'var(--text-subtle)', marginBottom: '4px' }}>핵심 연결 번호 (NH-DH)</div>
              <div className="font-black mono text-lg" style={{ color: '#f59e0b' }}>
                {tc.nhDhNumber}
              </div>
            </div>
          )}

          <div className="erp-card" style={{ padding: '16px 20px' }}>
             <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-subtle)' }}>문서 요약</h3>
             <div className="flex justify-between items-center mb-2">
               <span className="text-sm">전체 문서</span>
               <span className="font-bold text-[var(--accent)]">{tc.summary.docCount}건</span>
             </div>
             <div className="flex justify-between items-center mb-2">
               <span className="text-sm">시스템 발주서</span>
               <span className="font-bold" style={{ color: '#8b5cf6' }}>{tc.summary.poCount}건</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-sm">시스템 청구서</span>
               <span className="font-bold" style={{ color: '#f59e0b' }}>{tc.summary.invoiceCount}건</span>
             </div>
          </div>

        </div>
      </div>

      {/* 모달스 */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="erp-card w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)]">시스템 발주서 연결</h3>
              <button onClick={() => setShowPOModal(false)} className="p-1 hover:bg-[var(--bg-card-hover)] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-0 overflow-y-auto" style={{ flex: 1 }}>
              {availablePOs.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-subtle)]">
                  연결 가능한 발주서가 없습니다.
                </div>
              ) : (
                availablePOs.map(po => (
                  <div key={po.id} className="p-4 border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] flex justify-between items-center cursor-pointer transition-colors"
                    onClick={() => handleLinkPO(po.id)}>
                    <div>
                      <div className="font-bold mono text-[var(--accent)]">{po.poNumber}</div>
                      <div className="text-xs text-[var(--text-subtle)] mt-1">{po.vendor?.name || '공급업체 미지정'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{fmt(po.items?.reduce((s:any, i:any) => s + Number(i.totalAmount), 0) || 0, 'KRW')}</div>
                      <div className="text-xs text-[var(--text-subtle)] mt-1">{new Date(po.issueDate).toLocaleDateString('ko-KR')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="erp-card w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-[var(--text-primary)]">시스템 청구서 연결</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="p-1 hover:bg-[var(--bg-card-hover)] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-0 overflow-y-auto" style={{ flex: 1 }}>
              {availableInvoices.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-subtle)]">
                  연결 가능한 청구서가 없습니다.
                </div>
              ) : (
                availableInvoices.map(inv => (
                  <div key={inv.id} className="p-4 border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] flex justify-between items-center cursor-pointer transition-colors"
                    onClick={() => handleLinkInvoice(inv.id)}>
                    <div>
                      <div className="font-bold mono text-[var(--accent)]">{inv.invoiceNo}</div>
                      <div className="text-xs text-[var(--text-subtle)] mt-1">{inv.vendor?.name || '공급업체 미지정'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{fmt(Number(inv.totalJPY), 'JPY')}</div>
                      <div className="text-xs text-[var(--text-subtle)] mt-1">{new Date(inv.invoiceDate).toLocaleDateString('ko-KR')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

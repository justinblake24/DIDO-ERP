'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, AlertTriangle, ChevronRight, Save,
  FileText, Package, Ship, DollarSign, Edit3, X, ArrowRight, Layers
} from 'lucide-react'
import { toast } from 'sonner'

interface ParsedDoc {
  fileName: string
  filePath: string
  docType: string
  docNumber: string | null
  numbers: {
    nhDh: string | null
    dhpo: string | null
    dhpoLocal: string | null
    dhpi: string | null
    invNo: string | null
  }
  parties: { buyer: string | null; seller: string | null }
  items: Array<{ name: string; qty: number | null; unit: string | null; unitPrice: number | null; currency: string | null; amount: number | null }>
  incidentalCosts: Array<{ name: string; amount: number; currency: string }>
  shipping: { portOfLoading: string | null; portOfDischarge: string | null; carrier: string | null; containerNos: string[]; incoterms: string | null; etd: string | null }
  amounts: { total: number | null; currency: string | null }
  confidence: number
  warnings: string[]
}

interface ParseResult {
  caseName: string
  nhDhNumber: string | null
  linkScore: { score: number; level: string; matchedOn: string[]; warnings: string[] }
  documents: ParsedDoc[]
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  JP_PO:        { label: '일본 발주서 (Export)', color: '#f59e0b', emoji: '🇯🇵' },
  KR_PO_INTL:   { label: '해외 발주서 (Export)', color: '#3b82f6', emoji: '🌍' },
  KR_PO_LOCAL:  { label: '국내 발주서 (Domestic)', color: '#8b5cf6', emoji: '🇰🇷' },
  INVOICE_NOAH: { label: '청구서 (Invoice)', color: '#10b981', emoji: '📄' },
  SHIPPING_DOC: { label: '선적서류 (Shipping)', color: '#6366f1', emoji: '📦' },
}

const PIPELINE_STAGES = [
  { id: 'DOMESTIC_PO', title: '1. 국내 발주', icon: '🇰🇷', docTypes: ['KR_PO_LOCAL'] },
  { id: 'EXPORT_PO', title: '2. 해외 발주', icon: '🌍', docTypes: ['JP_PO', 'KR_PO_INTL'] },
  { id: 'SHIPPING', title: '3. 선적', icon: '🚢', docTypes: ['SHIPPING_DOC'] },
  { id: 'INVOICE', title: '4. 청구/입금', icon: '💰', docTypes: ['INVOICE_NOAH'] },
]

export default function TradePipelineReviewPage() {
  const router = useRouter()
  const [result, setResult] = useState<ParseResult | null>(null)
  const [checkedDocs, setCheckedDocs] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [editingCaseName, setEditingCaseName] = useState(false)
  const [caseName, setCaseName] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('tradeParseResult')
    if (!stored) { router.push('/trade-pipeline/import'); return }
    const data: ParseResult = JSON.parse(stored)
    setResult(data)
    setCaseName(data.caseName)
  }, [router])

  function toggleDoc(idx: number) {
    setCheckedDocs(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function checkAll() {
    if (!result) return
    if (checkedDocs.size === result.documents.length) {
      setCheckedDocs(new Set())
    } else {
      setCheckedDocs(new Set(result.documents.map((_, i) => i)))
    }
  }

  // --- Item Auto-Matching Logic ---
  const matchedRows = useMemo(() => {
    if (!result) return []

    const allItems: Array<{ docIndex: number; item: any }> = []
    result.documents.forEach((d, i) => {
      d.items.forEach(it => allItems.push({ docIndex: i, item: it }))
    })

    const rows: Array<Record<number, any>> = []
    const used = new Set<any>()

    for (const { docIndex, item } of allItems) {
      if (used.has(item)) continue

      const row: Record<number, any> = { [docIndex]: item }
      used.add(item)

      // Try to find matching items in other documents
      for (let i = 0; i < result.documents.length; i++) {
        if (i === docIndex) continue

        const match = result.documents[i].items.find(other => 
          !used.has(other) && 
          (
            (other.name.toLowerCase() === item.name.toLowerCase()) || 
            (other.qty === item.qty && item.qty !== null && item.qty > 0) ||
            (other.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(other.name.toLowerCase()))
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
  }, [result])

  // --- Total Calculation based on Matched Items ---
  const matchedTotals = useMemo(() => {
    if (!result) return { 
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

    // Identify which document is which type
    const exportIndices = new Set(result.documents.map((d, i) => ['JP_PO', 'KR_PO_INTL'].includes(d.docType) ? i : -1).filter(i => i !== -1))
    const domesticIndices = new Set(result.documents.map((d, i) => ['KR_PO_LOCAL'].includes(d.docType) ? i : -1).filter(i => i !== -1))
    const invoiceIndices = new Set(result.documents.map((d, i) => ['INVOICE_NOAH'].includes(d.docType) ? i : -1).filter(i => i !== -1))

    matchedRows.forEach(row => {
      // Sum up amounts for each category from the matched row
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
  }, [result, matchedRows])

  const getCurrencySymbol = (currency: string) => {
    switch (currency?.toUpperCase()) {
      case 'USD': return '$'
      case 'JPY': return '¥'
      case 'KRW': return '₩'
      default: return currency ? `${currency} ` : ''
    }
  }


  async function handleConfirm() {
    if (!result) return

    const unverified = result.documents.filter((_, i) => !checkedDocs.has(i))
    if (unverified.length > 0) {
      toast.error(`아직 ${unverified.length}개 문서를 확인하지 않았습니다. 모두 체크 후 저장해주세요.`)
      return
    }

    setSaving(true)
    try {
      const shippingDoc = result.documents.find(d => d.docType === 'SHIPPING_DOC')
      const hasShippingData = shippingDoc?.shipping.portOfLoading || 
                              shippingDoc?.shipping.portOfDischarge || 
                              (shippingDoc?.shipping.containerNos && shippingDoc.shipping.containerNos.length > 0) ||
                              shippingDoc?.shipping.incoterms || 
                              shippingDoc?.shipping.etd;
      const shippingInfo = hasShippingData
        ? {
            portOfLoading: shippingDoc.shipping.portOfLoading || '',
            portOfDischarge: shippingDoc.shipping.portOfDischarge || '',
            carrier: shippingDoc.shipping.carrier || '',
            containerNos: shippingDoc.shipping.containerNos || [],
            incoterms: shippingDoc.shipping.incoterms || '',
            etd: shippingDoc.shipping.etd || null,
            eta: null,
          }
        : null

      const payload = {
        caseName,
        nhDhNumber: result.nhDhNumber,
        linkScore: result.linkScore.score,
        // Send matched items metadata to backend if needed in future
        matchedTotals, 
        documents: result.documents.map((doc, i) => ({
          fileName: doc.fileName,
          filePath: doc.filePath,
          docType: doc.docType,
          docNumber: doc.docNumber,
          numbers: doc.numbers,
          parsedData: doc,
          confidence: doc.confidence,
          verified: checkedDocs.has(i),
        })),
        shippingInfo,
      }

      const res = await fetch('/api/trade-pipeline/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      toast.success(`✅ "${caseName}" 저장 완료!`)
      sessionStorage.removeItem('tradeParseResult')
      router.push('/trade-pipeline')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!result) return null

  const allChecked = checkedDocs.size === result.documents.length
  const scoreColor = result.linkScore.level === 'HIGH' ? '#10b981'
    : result.linkScore.level === 'MEDIUM' ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ─── 헤더 ────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)', marginBottom: '8px' }}>
          <span>무역 파이프라인</span>
          <ChevronRight className="w-3 h-3" />
          <span>검토 및 확정</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {editingCaseName ? (
              <div className="flex items-center gap-2">
                <input
                  value={caseName}
                  onChange={e => setCaseName(e.target.value)}
                  className="erp-input text-xl font-bold"
                  style={{ maxWidth: '400px' }}
                  autoFocus
                  onBlur={() => setEditingCaseName(false)}
                />
                <button onClick={() => setEditingCaseName(false)}>
                  <X className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  🔍 {caseName}
                </h1>
                <button onClick={() => setEditingCaseName(true)}>
                  <Edit3 className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                </button>
              </div>
            )}
            <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '14px' }}>
              문서와 자동 매핑된 품목을 꼼꼼히 확인하고, [전체 확인] 후 저장해주세요.
            </p>
          </div>

          <div style={{
            padding: '12px 20px', borderRadius: '12px',
            background: `${scoreColor}15`, border: `1px solid ${scoreColor}40`,
            textAlign: 'center', minWidth: '120px',
          }}>
            <div className="text-2xl font-black" style={{ color: scoreColor }}>{result.linkScore.score}점</div>
            <div className="text-xs font-medium" style={{ color: scoreColor }}>전체 연결 신뢰도</div>
          </div>
        </div>
      </div>

      {/* 부대비용 앵커 뱃지 */}
      {(() => {
        const costCount = result.documents.reduce((acc, d) => acc + (d.incidentalCosts?.length || 0), 0)
        if (costCount > 0) {
          return (
            <div className="mb-6 flex justify-end">
              <button 
                onClick={() => document.getElementById('incidental-costs-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors text-sm font-semibold cursor-pointer animate-pulse shadow-sm"
              >
                <DollarSign className="w-4 h-4" />
                기타 부대비용 (T/C 등) {costCount}건 확인 필요 ↓
              </button>
            </div>
          )
        }
        return null
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* ─── 파이프라인 흐름 시각화 ────────────────────────────────────────────── */}
          <div className="erp-card" style={{ padding: '24px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--accent)]" /> 문서 파이프라인 매핑
              </h2>
              <button onClick={checkAll} className="text-sm font-semibold px-4 py-1.5 rounded-full" 
                      style={{ background: allChecked ? '#10b98120' : 'var(--bg-card-hover)', color: allChecked ? '#10b981' : 'var(--text-primary)', transition: 'all 0.2s' }}>
                {allChecked ? '✓ 전체 확인 해제' : '✓ 전체 확인'}
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {PIPELINE_STAGES.map((stage, stageIdx) => {
                const stageDocs = result.documents.map((d, i) => ({ doc: d, index: i })).filter(d => stage.docTypes.includes(d.doc.docType))
                
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
                        stageDocs.map(({ doc, index }) => {
                          const checked = checkedDocs.has(index)
                          const confColor = doc.confidence >= 80 ? '#10b981' : doc.confidence >= 60 ? '#f59e0b' : '#ef4444'

                          return (
                            <div key={index} className="relative rounded-xl overflow-hidden transition-all duration-200"
                                 style={{ 
                                   border: `2px solid ${checked ? '#10b981' : 'var(--border)'}`, 
                                   background: checked ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)' 
                                 }}>
                              <div className="p-3">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <div className="font-semibold text-sm line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                    {doc.fileName}
                                  </div>
                                  <button onClick={() => toggleDoc(index)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                                          style={{ background: checked ? '#10b981' : 'var(--bg-card-hover)', color: checked ? 'white' : 'var(--border)' }}>
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                </div>
                                {doc.docNumber && (
                                  <div className="text-xs font-mono font-medium" style={{ color: 'var(--accent)' }}>{doc.docNumber}</div>
                                )}
                                <div className="mt-2 flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${doc.confidence}%`, background: confColor }} />
                                  </div>
                                  <span className="text-[10px] font-bold" style={{ color: confColor }}>{doc.confidence}%</span>
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

          {/* ─── 품목별 매핑 (Item-Level Matching) ────────────────────────────────────────────── */}
          <div className="erp-card" style={{ padding: '24px' }}>
            <h2 className="font-semibold text-lg flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-[var(--accent)]" /> 제품(Item) 자동 매핑
            </h2>
            <p className="text-sm text-[var(--text-subtle)] mb-6">
              각 문서에서 추출된 제품 항목들을 이름과 수량을 기반으로 자동 매핑합니다. 
              금액 요약은 실제 거래에 포함된(매핑된) 제품들만을 기준으로 산정됩니다.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">국내 발주 (품목)</th>
                    <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">해외 발주 (품목)</th>
                    <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">선적 (품목)</th>
                    <th className="p-3 border-b-2 border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/4">청구 (품목)</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedRows.length === 0 ? (
                    <tr><td colSpan={4} className="text-center p-8 text-sm text-[var(--text-subtle)]">추출된 품목이 없습니다.</td></tr>
                  ) : (
                    matchedRows.map((row, rIdx) => {
                      // Get items for each stage
                      const getStageItem = (stageDocTypes: string[]) => {
                        for (let i = 0; i < result.documents.length; i++) {
                          if (stageDocTypes.includes(result.documents[i].docType) && row[i]) {
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
                              <span className="text-[var(--text-subtle)]">{item.qty || 0} {item.unit || 'EA'}</span>
                              {item.amount && (
                                <span className="font-mono font-medium text-[var(--accent)]">{item.currency} {item.amount.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <tr key={rIdx} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors">
                          <td className="p-3 align-top">{renderCell(domItem)}</td>
                          <td className="p-3 align-top">{renderCell(expItem)}</td>
                          <td className="p-3 align-top">{renderCell(shipItem)}</td>
                          <td className="p-3 align-top">{renderCell(invItem)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 부대비용 테이블 */}
            <div id="incidental-costs-section" className="mt-8">
              <h3 className="font-semibold text-md flex items-center gap-2 mb-3 text-[var(--text-primary)]">
                <DollarSign className="w-4 h-4 text-[var(--accent)]" /> 
                기타 부대비용 (Incidental Costs)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr>
                      <th className="p-2 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/3">문서</th>
                      <th className="p-2 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] w-1/3">비용 종류</th>
                      <th className="p-2 border-b border-[var(--border)] text-xs font-semibold text-[var(--text-subtle)] text-right">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allCosts: Array<{ docType: string, fileName: string, cost: { name: string, amount: number, currency: string } }> = []
                      result.documents.forEach(d => {
                        if (d.incidentalCosts && d.incidentalCosts.length > 0) {
                          d.incidentalCosts.forEach(cost => allCosts.push({ docType: d.docType, fileName: d.fileName, cost }))
                        }
                      })
                      
                      if (allCosts.length === 0) {
                        return <tr><td colSpan={3} className="text-center p-4 text-xs text-[var(--text-subtle)]">추출된 부대비용이 없습니다.</td></tr>
                      }

                      return allCosts.map((c, idx) => (
                        <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors">
                          <td className="p-2 align-middle">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}>
                              {DOC_TYPE_LABELS[c.docType]?.label || c.docType}
                            </span>
                            <div className="text-[10px] text-[var(--text-subtle)] mt-1 truncate max-w-[200px]">{c.fileName}</div>
                          </td>
                          <td className="p-2 align-middle text-sm font-semibold text-[var(--text-primary)]">{c.cost.name}</td>
                          <td className="p-2 align-middle text-right">
                            <span className="font-mono font-medium text-[var(--accent)]">
                              {getCurrencySymbol(c.cost.currency)}{c.cost.amount.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
        </div>

        {/* ─── 오른쪽: 요약 패널 ────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 정제된 재무 요약 */}
          <div className="erp-card" style={{ padding: '20px' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              💰 이번 거래 실 매핑 금액
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs text-[var(--text-subtle)] mb-1">총 해외 발주액 (매핑 기준)</div>
                <div className="text-xl font-bold mono" style={{ color: '#3b82f6' }}>
                  {getCurrencySymbol(matchedTotals.exportTotal.currency)}{matchedTotals.exportTotal.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-subtle)] mb-1">총 청구액 (매핑 기준)</div>
                <div className="text-xl font-bold mono" style={{ color: '#10b981' }}>
                  {getCurrencySymbol(matchedTotals.invoiceTotal.currency)}{matchedTotals.invoiceTotal.amount.toLocaleString()}
                </div>
              </div>
              <div className="border-t border-[var(--border)] pt-4 mt-1">
                <div className="text-xs text-[var(--text-subtle)] mb-1">총 국내 매입가액 (추정)</div>
                <div className="text-lg font-semibold mono" style={{ color: 'var(--text-primary)' }}>
                  {getCurrencySymbol(matchedTotals.domesticTotal.currency)}{matchedTotals.domesticTotal.amount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* NH-DH 핵심 키 */}
          {result.nhDhNumber && (
            <div className="erp-card" style={{ padding: '16px 20px' }}>
              <div className="text-xs" style={{ color: 'var(--text-subtle)', marginBottom: '4px' }}>핵심 연결 번호 (NH-DH)</div>
              <div className="font-black mono text-lg" style={{ color: '#f59e0b' }}>
                {result.nhDhNumber}
              </div>
            </div>
          )}

          {/* 확정 저장 버튼 */}
          <button
            onClick={handleConfirm}
            disabled={saving || !allChecked}
            className="erp-btn-primary flex items-center justify-center gap-2"
            style={{
              padding: '16px', fontSize: '15px', fontWeight: 700,
              opacity: allChecked ? 1 : 0.5,
              marginTop: '8px'
            }}
          >
            {saving
              ? '저장 중...'
              : allChecked
              ? <><Save className="w-5 h-5" /> 무역 파이프라인 확정</>
              : <><CheckCircle className="w-5 h-5" /> 전체 문서를 확인해주세요</>
            }
          </button>

          {!allChecked && (
            <div className="p-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-[var(--text-muted)]">
                미확인 문서: <strong className="text-[var(--text-primary)]">{result.documents.length - checkedDocs.size}건</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

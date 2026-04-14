'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Save, ArrowLeft, AlertTriangle } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  country: string
  currency: string
}

interface FormItem {
  productName: string
  specification: string
  quantity: string
  unit: string
  unitPrice: string
  currency: string
}

const EMPTY_ITEM: FormItem = {
  productName: '',
  specification: '',
  quantity: '',
  unit: 'EA',
  unitPrice: '',
  currency: 'KRW',
}

const UNITS = ['EA', 'Bags', 'Cartons', 'Boxes', 'Case', 'Set']
const CURRENCIES = ['KRW', 'USD', 'JPY']

export default function NewPOPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [items, setItems] = useState<FormItem[]>([{ ...EMPTY_ITEM }])
  const [poPreview, setPoPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingVendors, setLoadingVendors] = useState(true)

  useEffect(() => {
    fetch('/api/vendors')
      .then((r) => r.json())
      .then((data) => { setVendors(data); setLoadingVendors(false) })
      .catch(() => setLoadingVendors(false))
  }, [])

  useEffect(() => {
    const vendor = vendors.find((v) => v.id === selectedVendorId)
    if (!vendor || !issueDate) { setPoPreview(''); return }

    const date = new Date(issueDate)
    const yy = String(date.getFullYear()).slice(2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const isImport = vendor.country !== 'KR'
    const preview = isImport
      ? `DHPO-(I)${yy}${mm}${dd}M-XXX`
      : `DHPO-${yy}${mm}${dd}-XXX®`
    setPoPreview(preview)

    // 기본 통화 설정
    setItems((prev) => prev.map((item) => ({ ...item, currency: vendor.currency })))
  }, [selectedVendorId, issueDate, vendors])

  function addItem() {
    const vendor = vendors.find((v) => v.id === selectedVendorId)
    setItems((prev) => [...prev, { ...EMPTY_ITEM, currency: vendor?.currency || 'KRW' }])
  }

  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof FormItem, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function calcTotal(item: FormItem): number {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    return qty * price
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedVendorId) { toast.error('발주처를 선택하세요'); return }
    if (items.some((i) => !i.productName)) { toast.error('모든 품목에 제품명을 입력하세요'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          issueDate,
          remarks,
          items: items.map((item) => ({
            productName: item.productName,
            specification: item.specification,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            unitPrice: parseFloat(item.unitPrice) || 0,
            currency: item.currency,
            totalAmount: calcTotal(item),
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || '저장 실패')
      }

      const data = await res.json()
      toast.success(`${data.poNumber} 발주가 저장되었습니다!`)
      router.push(`/purchase-orders/${data.id}`)
    } catch (err: any) {
      toast.error(err.message || '저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const grandTotal = items.reduce((sum, item) => {
    const t = calcTotal(item)
    return item.currency === 'KRW' ? sum + t : sum
  }, 0)

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-4 mb-6">
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />
          뒤로
        </button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          신규 발주 작성
        </h1>
        <div className="flex-1" />
        <button
          id="save-po-button"
          type="submit"
          disabled={loading}
          className="btn-gold flex items-center gap-2 text-sm"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          저장
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left: Main Form */}
        <div className="space-y-5">
          {/* Basic Info */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              기본 정보
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Vendor */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  발주처 *
                </label>
                {loadingVendors ? (
                  <div className="skeleton h-10 rounded-xl" />
                ) : (
                  <select
                    id="vendor-select"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    required
                    className="erp-select w-full"
                  >
                    <option value="">발주처 선택...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.country !== 'KR' ? '🌏' : '🇰🇷'} {v.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Issue Date */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  발행일 *
                </label>
                <input
                  id="issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="erp-input"
                />
              </div>

              {/* PO Number Preview */}
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  발주번호 미리보기
                </label>
                <div className="p-3 rounded-xl mono text-sm font-semibold"
                  style={{
                    background: 'rgba(255,192,0,0.08)',
                    border: '1px solid rgba(255,192,0,0.2)',
                    color: poPreview ? 'var(--accent)' : 'var(--text-subtle)',
                  }}>
                  {poPreview || '발주처와 날짜를 선택하면 자동 생성됩니다'}
                </div>
              </div>

              {/* Remarks */}
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  비고 (Remarks)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="비고 사항을 입력하세요..."
                  rows={2}
                  className="erp-input"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                발주 품목
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(255,192,0,0.2)',
                }}
              >
                <Plus className="w-3 h-3" />
                품목 추가
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium mono" style={{ color: 'var(--text-subtle)' }}>
                      #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className="p-1 rounded-lg transition-colors"
                        style={{ color: 'var(--status-cancelled)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="제품명 *"
                      value={item.productName}
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                      required
                      className="erp-input"
                    />
                    <input
                      type="text"
                      placeholder="규격 (선택)"
                      value={item.specification}
                      onChange={(e) => updateItem(idx, 'specification', e.target.value)}
                      className="erp-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                    <input
                      type="number"
                      placeholder="수량"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      required
                      min="0"
                      className="erp-input mono text-right"
                    />
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      className="erp-select"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="단가"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                      step="0.01"
                      min="0"
                      className="erp-input mono text-right"
                    />
                    <select
                      value={item.currency}
                      onChange={(e) => updateItem(idx, 'currency', e.target.value)}
                      className="erp-select"
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Total */}
                  {calcTotal(item) > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>합계 </span>
                      <span className="mono text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                        {calcTotal(item).toLocaleString()} {item.currency}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div>
          <div className="glass-card p-5 sticky top-20">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              발주 요약
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>품목 수</span>
                <span className="mono" style={{ color: 'var(--text-primary)' }}>{items.length}개</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>총 수량</span>
                <span className="mono" style={{ color: 'var(--text-primary)' }}>
                  {items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0).toLocaleString()}
                </span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>KRW 합계</span>
                  <span className="mono font-bold" style={{ color: 'var(--accent)' }}>
                    ₩{grandTotal.toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>

            {items.some((i) => !i.productName || !i.quantity) && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <p className="text-xs" style={{ color: '#f59e0b' }}>
                  일부 품목에 필수 정보가 없습니다
                </p>
              </div>
            )}

            <button
              id="save-po-bottom"
              type="submit"
              disabled={loading}
              className="btn-gold w-full mt-5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  발주 저장
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

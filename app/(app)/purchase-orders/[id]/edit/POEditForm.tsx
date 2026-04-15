'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'

interface Vendor { id: string; name: string; country: string; currency: string }
interface Item {
  id?: string; productName: string; specification: string
  quantity: string; unit: string; unitPrice: string; currency: string
}

const UNITS = ['EA', 'Bags', 'Cartons', 'Boxes', 'Case', 'Set']
const CURRENCIES = ['KRW', 'USD', 'JPY']

export default function POEditForm({ po, vendors }: { po: any; vendors: Vendor[] }) {
  const router = useRouter()
  const [selectedVendorId, setSelectedVendorId] = useState(po.vendorId)
  const [issueDate, setIssueDate] = useState(String(po.issueDate).slice(0, 10))
  const [remarks, setRemarks] = useState(po.remarks || '')
  const [items, setItems] = useState<Item[]>(
    po.items.map((i: any) => ({
      id: i.id,
      productName: i.productName,
      specification: i.specification || '',
      quantity: String(i.quantity),
      unit: i.unit,
      unitPrice: String(i.unitPrice),
      currency: i.currency,
    }))
  )
  const [loading, setLoading] = useState(false)

  function addItem() {
    const vendor = vendors.find((v) => v.id === selectedVendorId)
    setItems((prev) => [...prev, {
      productName: '', specification: '', quantity: '', unit: 'EA',
      unitPrice: '', currency: vendor?.currency || 'KRW',
    }])
  }
  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          issueDate,
          remarks,
          items: items.map((item, idx) => ({
            id: item.id,
            productName: item.productName,
            specification: item.specification,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            unitPrice: parseFloat(item.unitPrice) || 0,
            currency: item.currency,
            totalAmount: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
            sortOrder: idx,
          })),
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.message) }
      toast.success('발주가 수정되었습니다!')
      router.push(`/purchase-orders/${po.id}`)
    } catch (err: any) {
      toast.error(err.message || '수정 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-4 mb-6">
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <ArrowLeft className="w-4 h-4" />뒤로
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>발주 수정</h1>
          <div className="mono text-sm" style={{ color: 'var(--accent)' }}>{po.poNumber}</div>
        </div>
        <div className="flex-1" />
        <button type="submit" disabled={loading} className="btn-gold flex items-center gap-2 text-sm">
          {loading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          저장
        </button>
      </div>

      <div className="glass-card p-5 mb-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>기본 정보</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>발주처</label>
            <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="erp-select w-full">
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>발행일</label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="erp-input" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>비고</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="erp-input" />
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>발주 품목</h2>
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(255,192,0,0.2)' }}>
            <Plus className="w-3 h-3" />품목 추가
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between mb-3">
                <span className="text-xs mono" style={{ color: 'var(--text-subtle)' }}>#{idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} style={{ color: 'var(--status-cancelled)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input type="text" placeholder="제품명" value={item.productName} onChange={(e) => updateItem(idx, 'productName', e.target.value)} className="erp-input" />
                <input type="text" placeholder="규격" value={item.specification} onChange={(e) => updateItem(idx, 'specification', e.target.value)} className="erp-input" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                <input type="number" placeholder="수량" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="erp-input mono text-right" />
                <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="erp-select">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="단가" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} step="0.01" className="erp-input mono text-right" />
                <select value={item.currency} onChange={(e) => updateItem(idx, 'currency', e.target.value)} className="erp-select">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}

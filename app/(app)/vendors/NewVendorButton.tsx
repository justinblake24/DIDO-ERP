'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X, Building2 } from 'lucide-react'

const COUNTRIES = [
  { code: 'KR', label: '🇰🇷 한국 (KR)' },
  { code: 'CN', label: '🇨🇳 중국 (CN)' },
  { code: 'JP', label: '🇯🇵 일본 (JP)' },
  { code: 'US', label: '🇺🇸 미국 (US)' },
  { code: 'VN', label: '🇻🇳 베트남 (VN)' },
  { code: 'TH', label: '🇹🇭 태국 (TH)' },
  { code: 'DE', label: '🇩🇪 독일 (DE)' },
  { code: 'IT', label: '🇮🇹 이탈리아 (IT)' },
]
const CURRENCIES = ['KRW', 'USD', 'JPY', 'CNY', 'EUR', 'VND']

export default function NewVendorButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', country: 'KR', currency: 'KRW',
    contact: '', email: '', memo: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('발주처명을 입력해주세요'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message)
      }
      toast.success('발주처가 등록되었습니다!')
      setOpen(false)
      setForm({ name: '', country: 'KR', currency: 'KRW', contact: '', email: '', memo: '' })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || '등록 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 버튼 */}
      <button
        id="new-vendor-btn"
        className="btn-gold flex items-center gap-2 text-sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-4 h-4" />
        신규 발주처
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="glass-card w-full max-w-md p-6"
            style={{ borderRadius: '20px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Building2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                </div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  신규 발주처 등록
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 발주처명 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  발주처명 <span style={{ color: 'var(--accent)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="예: 대한무역(주)"
                  className="erp-input w-full"
                  autoFocus
                />
              </div>

              {/* 국가 + 통화 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>국가</label>
                  <select
                    value={form.country}
                    onChange={(e) => set('country', e.target.value)}
                    className="erp-select w-full"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>통화</label>
                  <select
                    value={form.currency}
                    onChange={(e) => set('currency', e.target.value)}
                    className="erp-select w-full"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 담당자 + 이메일 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>담당자</label>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={(e) => set('contact', e.target.value)}
                    placeholder="홍길동"
                    className="erp-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>이메일</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="example@company.com"
                    className="erp-input w-full"
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => set('memo', e.target.value)}
                  rows={2}
                  placeholder="특이사항 등..."
                  className="erp-input w-full"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-gold flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

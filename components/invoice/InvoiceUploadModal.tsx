'use client'
// components/invoice/InvoiceUploadModal.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, Loader2, CheckCircle, AlertCircle, FileText, Link2, Edit3 } from 'lucide-react'

interface OcrResult {
  invoiceNo: string
  invoiceDate: string
  totalJPY: number
  invoiceJPY: number
  ratio: number
  unitPriceJPY: number
  poRef: string
  vendorName: string
  productSummary: string
}

interface MatchedPo {
  id: string
  poNumber: string
  status: string
  vendor: { name: string; country: string }
}

interface OcrResponse {
  ocr: OcrResult
  invoiceType: 'REGULAR' | 'TRANSPORT' | 'SAMPLE'
  needsPo: boolean
  matchedPo: MatchedPo | null
  duplicate: { id: string; invoiceNo: string } | null
  fileName: string
}

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type Step = 'upload' | 'loading' | 'confirm' | 'done'

// ─── PO 검색 드롭다운 ─────────────────────────────────────────────
interface PoOption { id: string; poNumber: string; vendorName: string }

function POSearchDropdown({ value, onChange, hint }: {
  value: string
  onChange: (id: string) => void
  hint?: string
}) {
  const [query, setQuery] = useState(hint || '')
  const [options, setOptions] = useState<PoOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders?search=${encodeURIComponent(q)}&pageSize=20`)
      const data = await res.json()
      setOptions((data.pos || []).map((p: { id: string; poNumber: string; vendor: { name: string } }) => ({
        id: p.id,
        poNumber: p.poNumber,
        vendorName: p.vendor.name,
      })))
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hint) search(hint)
  }, [hint, search])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={selectedLabel || query}
          placeholder="PO 번호로 검색…"
          onChange={e => {
            setQuery(e.target.value)
            setSelectedLabel('')
            onChange('')
            if (e.target.value.length >= 2) search(e.target.value)
            else setOpen(false)
          }}
          onFocus={() => { if (options.length > 0) setOpen(true) }}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${value ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`,
            color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {loading && (
          <Loader2 style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            width: 14, height: 14, color: 'var(--text-subtle)',
            animation: 'spin 1s linear infinite',
          }} />
        )}
      </div>

      {/* 결과 드롭다운 — open 상태일 때만 */}
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          zIndex: 9999,
          background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', maxHeight: '180px', overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        }}>
          {options.map(opt => (
            <div
              key={opt.id}
              onMouseDown={(e) => {          // onClick → onMouseDown (blur 전 선택)
                e.preventDefault()
                onChange(opt.id)
                setSelectedLabel(`${opt.poNumber} — ${opt.vendorName}`)
                setOpen(false)
              }}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: value === opt.id ? 'rgba(99,102,241,0.15)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = value === opt.id ? 'rgba(99,102,241,0.15)' : 'transparent')}
            >
              <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{opt.poNumber}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>{opt.vendorName}</span>
            </div>
          ))}
        </div>
      )}

      {/* 검색 결과 없음 — 드롭다운 아닌 인라인 텍스트 */}
      {open && options.length === 0 && !loading && (
        <p style={{
          margin: '6px 0 0 4px', fontSize: '12px',
          color: 'var(--text-subtle)',
        }}>
          검색 결과 없음
        </p>
      )}
    </div>
  )
}


export default function InvoiceUploadModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [ocrData, setOcrData] = useState<OcrResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 수정 가능한 폼 상태
  const [form, setForm] = useState({
    invoiceNo: '',
    invoiceDate: '',
    totalJPY: 0,
    invoiceJPY: 0,
    ratio: 0,
    unitPriceJPY: 0,
    poId: '',
    memo: '',
    invoiceType: 'REGULAR' as 'REGULAR' | 'TRANSPORT' | 'SAMPLE',
  })

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setStep('loading')

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/invoices/ocr', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'OCR 실패')
      if (data.duplicate) {
        setError(`이미 등록된 청구서입니다: ${data.duplicate.invoiceNo}`)
        setStep('upload')
        return
      }

      setOcrData(data)
      setForm({
        invoiceNo: data.ocr.invoiceNo,
        invoiceDate: data.ocr.invoiceDate,
        totalJPY: Math.round(data.ocr.totalJPY),
        invoiceJPY: Math.round(data.ocr.invoiceJPY),
        ratio: Math.round(data.ocr.ratio * 10000) / 10000,   // 소수점 4자리
        unitPriceJPY: Math.round(data.ocr.unitPriceJPY),
        poId: data.matchedPo?.id || '',
        memo: '',
        invoiceType: data.invoiceType || 'REGULAR',
      })
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR 처리 중 오류 발생')
      setStep('upload')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleSave = async () => {
    if (!form.poId) { setError('PO를 선택해주세요'); return }
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: form.poId || undefined,
          invoiceNo: form.invoiceNo,
          invoiceDate: form.invoiceDate,
          totalJPY: form.totalJPY,
          invoiceJPY: form.invoiceJPY,
          ratio: form.ratio,
          unitPriceJPY: form.unitPriceJPY,
          invoiceType: form.invoiceType,
          memo: form.memo,
          sourceFile: ocrData?.fileName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류 발생')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => `¥${n.toLocaleString()}`

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText style={{ color: 'var(--accent)', width: 18, height: 18 }} />
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              청구서 OCR 등록
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: '4px' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* STEP 1: 업로드 */}
          {step === 'upload' && (
            <div>
              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '16px', color: '#ef4444', fontSize: '13px',
                }}>
                  <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {error}
                </div>
              )}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '16px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                }}
              >
                <Upload style={{
                  width: 40, height: 40, margin: '0 auto 16px',
                  color: dragOver ? 'var(--accent)' : 'var(--text-subtle)',
                }} />
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                  이미지 또는 PDF 드래그 & 드롭
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                  JPG, PNG, WebP, PDF 지원
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 20px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
                  fontSize: '13px', fontWeight: 600,
                }}>
                  파일 선택
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              <p style={{ color: 'var(--text-subtle)', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>
                Gemini AI가 자동으로 데이터를 읽어서 P/O와 매핑합니다
              </p>
            </div>
          )}

          {/* STEP 2: OCR 로딩 */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Loader2 style={{
                width: 48, height: 48, margin: '0 auto 20px',
                color: 'var(--accent)', animation: 'spin 1s linear infinite',
              }} />
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '8px' }}>
                AI가 청구서를 분석 중...
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                문서에서 데이터를 자동 추출하고 P/O와 매핑 중입니다
              </div>
            </div>
          )}

          {/* STEP 3: 확인 및 수정 */}
          {step === 'confirm' && ocrData && (
            <div>
              {/* 청구 유형 뱃지 (TRANSPORT/SAMPLE) */}
              {form.invoiceType !== 'REGULAR' && (
                <div style={{
                  background: form.invoiceType === 'TRANSPORT' ? 'rgba(59,130,246,0.08)' : 'rgba(168,85,247,0.08)',
                  border: `1px solid ${form.invoiceType === 'TRANSPORT' ? 'rgba(59,130,246,0.3)' : 'rgba(168,85,247,0.3)'}`,
                  borderRadius: '12px', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  marginBottom: '20px',
                }}>
                  <span style={{ fontSize: '20px' }}>{form.invoiceType === 'TRANSPORT' ? '🚢' : '🧪'}</span>
                  <div>
                    <div style={{
                      fontWeight: 700, fontSize: '13px',
                      color: form.invoiceType === 'TRANSPORT' ? '#60a5fa' : '#c084fc',
                    }}>
                      {form.invoiceType === 'TRANSPORT' ? '운송비 청구서 T(N)' : '샘플 대금 청구서 S(N)'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>
                      P/O 없이 독립 청구서로 등록됩니다
                    </div>
                  </div>
                </div>
              )}

              {/* PO 매핑 완료 (REGULAR + 매핑 성공) */}
              {form.invoiceType === 'REGULAR' && ocrData.matchedPo && (
                <div style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: '12px', padding: '14px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  marginBottom: '20px',
                }}>
                  <Link2 style={{ width: 16, height: 16, flexShrink: 0, marginTop: '2px', color: '#22c55e' }} />
                  <div>
                    <div style={{ color: '#22c55e', fontWeight: 600, fontSize: '13px' }}>
                      P/O 자동 매핑 완료
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                      {ocrData.matchedPo.poNumber} — {ocrData.matchedPo.vendor.name}
                    </div>
                  </div>
                </div>
              )}

              {/* PO 없음 알럿 (REGULAR + 매핑 실패) */}
              {form.invoiceType === 'REGULAR' && !ocrData.matchedPo && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: '14px', padding: '18px 20px',
                  marginBottom: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                    <AlertCircle style={{ width: 20, height: 20, color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                        해당 P/O가 시스템에 없습니다
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                        OCR이 읽은 Ref.No: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{ocrData.ocr.poRef || '없음'}</span>
                        <br />
                        청구서를 등록하려면 먼저 <strong>P/O 발행대장</strong>에서 해당 발주를 등록해주세요.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a href="/purchase-orders/new" target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '9px 16px', borderRadius: '10px',
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                      color: '#ef4444', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                    }}>
                      ＋ 신규 P/O 등록하러 가기 ↗
                    </a>
                    <a href="/purchase-orders" target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '9px 16px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none',
                    }}>
                      P/O 발행대장 조회 ↗
                    </a>
                  </div>
                  <div style={{
                    marginTop: '14px', paddingTop: '14px',
                    borderTop: '1px solid rgba(239,68,68,0.2)',
                    fontSize: '12px', color: 'var(--text-subtle)',
                  }}>
                    💡 P/O 등록 후 모달을 닫지 않고 아래에서 직접 검색해 연결할 수도 있습니다.
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <POSearchDropdown
                      value={form.poId}
                      onChange={(id) => setForm(f => ({ ...f, poId: id }))}
                      hint={ocrData.ocr.poRef}
                    />
                  </div>
                </div>
              )}


              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '16px', color: '#ef4444', fontSize: '13px',
                }}>
                  <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <Edit3 style={{ width: 13, height: 13, color: 'var(--text-subtle)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                  OCR 결과를 확인하고 필요시 수정하세요
                </span>
              </div>

              {/* 폼 */}
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  { label: '청구서 번호', key: 'invoiceNo', type: 'text' },
                  { label: '청구일', key: 'invoiceDate', type: 'date' },
                  { label: '합계 금액 (JPY)', key: 'totalJPY', type: 'number' },
                  { label: '실 청구액 (JPY)', key: 'invoiceJPY', type: 'number' },
                  { label: '비율 (0~1)', key: 'ratio', type: 'number' },
                  { label: '단가 (JPY)', key: 'unitPriceJPY', type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '5px' }}>
                      {label}
                    </label>
                    <input
                      type={type}
                      step={type === 'number' && key === 'ratio' ? '0.01' : '1'}
                      value={(form as Record<string, string | number>)[key]}
                      onChange={e => setForm(f => ({
                        ...f,
                        [key]: type === 'number' ? Number(e.target.value) : e.target.value
                      }))}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}

                {/* PO 선택 (매핑 안된 경우 검색 드롭다운) */}
                {!ocrData.matchedPo && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '5px' }}>
                      P/O 선택 <span style={{ color: '#f59e0b' }}>*</span>
                    </label>
                    <POSearchDropdown
                      value={form.poId}
                      onChange={(id) => setForm(f => ({ ...f, poId: id }))}
                      hint={ocrData.ocr.poRef}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-subtle)', marginBottom: '5px' }}>
                    비고 (선택)
                  </label>
                  <input
                    type="text"
                    placeholder="메모를 입력하세요"
                    value={form.memo}
                    onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* 요약 금액 */}
              <div style={{
                marginTop: '16px', padding: '14px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>합계</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {fmt(form.totalJPY)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>이번 청구액 ({(form.ratio * 100).toFixed(0)}%)</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, color: 'var(--accent)' }}>
                    {fmt(form.invoiceJPY)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => { setStep('upload'); setError(null) }}
                  style={{
                    flex: 1, padding: '11px', borderRadius: '12px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: '14px',
                  }}
                >
                  다시 업로드
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 2, padding: '11px', borderRadius: '12px', cursor: 'pointer',
                    background: saving ? 'rgba(99,102,241,0.4)' : 'var(--accent)',
                    border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {saving && <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />}
                  {saving ? '저장 중...' : '청구서 등록'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: 완료 */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <CheckCircle style={{
                width: 56, height: 56, margin: '0 auto 20px',
                color: '#22c55e',
              }} />
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>
                청구서 등록 완료!
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '28px' }}>
                {form.invoiceNo} — {fmt(form.invoiceJPY)}
              </div>
              <button
                onClick={onSuccess}
                style={{
                  padding: '11px 32px', borderRadius: '12px', cursor: 'pointer',
                  background: 'var(--accent)', border: 'none',
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                }}
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

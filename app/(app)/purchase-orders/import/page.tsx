'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, Loader2, X, ChevronDown, ChevronUp,
  Building2, Plus, Search, Check
} from 'lucide-react'

/* ─── 타입 ─── */
interface ParsedItem {
  productName: string; quantity: number; unit: string
  unitPrice: number; currency: string; totalAmount: number
}
interface ParsedPO {
  poNumber: string; issueDate: string; vendorName: string
  status: string; remarks: string; items: ParsedItem[]
  errors: string[]; rowIndex: number; sheetName: string
}
interface ExistingVendor { id: string; name: string; country: string; currency: string }

type VendorMode = 'select' | 'create'
interface VendorInput {
  poNumber: string; rowIndex: number
  mode: VendorMode
  // select 모드
  selectedVendor: ExistingVendor | null
  search: string
  dropdownOpen: boolean
  // create 모드
  newName: string; newCountry: string; newCurrency: string
}

type Step = 'upload' | 'parsing' | 'preview' | 'saving' | 'done'

const COUNTRY_OPTIONS = [
  { value: 'KR', label: '🇰🇷 한국 (KR)' }, { value: 'CN', label: '🇨🇳 중국 (CN)' },
  { value: 'JP', label: '🇯🇵 일본 (JP)' }, { value: 'US', label: '🇺🇸 미국 (US)' },
  { value: 'VN', label: '🇻🇳 베트남 (VN)' }, { value: 'TH', label: '🇹🇭 태국 (TH)' },
]
const CURRENCY_OPTIONS = ['KRW', 'USD', 'JPY', 'EUR', 'CNY', 'VND']

/* ─── VendorSelect 컴포넌트 ─── */
function VendorSelect({
  input, existingVendors, onChange,
}: {
  input: VendorInput
  existingVendors: ExistingVendor[]
  onChange: (updated: Partial<VendorInput>) => void
}) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onChange({ dropdownOpen: false })
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onChange])

  const filtered = existingVendors.filter((v) =>
    v.name.toLowerCase().includes(input.search.toLowerCase())
  )

  if (input.mode === 'create') {
    return (
      <div className="flex-1 flex gap-2 items-center flex-wrap">
        <input
          type="text"
          value={input.newName}
          onChange={(e) => onChange({ newName: e.target.value })}
          placeholder="신규 발주처명 입력"
          className="erp-input flex-1"
          style={{ height: '38px', fontSize: '14px', minWidth: '140px' }}
          autoFocus
        />
        <select
          value={input.newCountry}
          onChange={(e) => onChange({ newCountry: e.target.value })}
          className="erp-input"
          style={{ height: '38px', fontSize: '13px', minWidth: '130px' }}
        >
          {COUNTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={input.newCurrency}
          onChange={(e) => onChange({ newCurrency: e.target.value })}
          className="erp-input"
          style={{ height: '38px', fontSize: '13px', minWidth: '90px' }}
        >
          {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* 기존 선택으로 돌아가기 */}
        <button
          type="button"
          onClick={() => onChange({ mode: 'select', newName: '', dropdownOpen: false })}
          className="px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}
        >
          취소
        </button>
      </div>
    )
  }

  // select 모드
  return (
    <div className="flex-1 flex gap-2 items-center">
      {/* 검색 드롭다운 */}
      <div className="relative flex-1" ref={dropdownRef}>
        <div
          className="erp-input flex items-center gap-2 cursor-pointer"
          style={{ height: '38px', fontSize: '14px', paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
          onClick={() => onChange({ dropdownOpen: !input.dropdownOpen })}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
          {input.selectedVendor ? (
            <span style={{ color: 'var(--text-primary)', flex: 1 }}>{input.selectedVendor.name}</span>
          ) : (
            <input
              type="text"
              value={input.search}
              onChange={(e) => onChange({ search: e.target.value, dropdownOpen: true })}
              onClick={(e) => { e.stopPropagation(); onChange({ dropdownOpen: true }) }}
              placeholder="기존 발주처 검색..."
              className="flex-1 bg-transparent outline-none"
              style={{ color: 'var(--text-primary)', fontSize: '14px' }}
            />
          )}
          {input.selectedVendor
            ? <button type="button" onClick={(e) => { e.stopPropagation(); onChange({ selectedVendor: null, search: '', dropdownOpen: true }) }}>
                <X className="w-3.5 h-3.5" style={{ color: 'var(--text-subtle)' }} />
              </button>
            : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
          }
        </div>

        {/* 드롭다운 목록 */}
        {input.dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-50 overflow-hidden"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-subtle)' }}>
                검색 결과가 없습니다
              </div>
            ) : (
              filtered.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all"
                  style={{
                    background: input.selectedVendor?.id === v.id ? 'var(--accent-dim)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background =
                    input.selectedVendor?.id === v.id ? 'var(--accent-dim)' : 'transparent')}
                  onClick={() => onChange({ selectedVendor: v, search: '', dropdownOpen: false })}
                >
                  <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{v.country} · {v.currency}</div>
                  </div>
                  {input.selectedVendor?.id === v.id && (
                    <Check className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* + 신규 등록 버튼 */}
      <button
        type="button"
        onClick={() => onChange({ mode: 'create', dropdownOpen: false, newCountry: 'KR', newCurrency: 'KRW' })}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
        title="신규 발주처 등록"
        style={{
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          border: '1px solid rgba(255,192,0,0.3)',
          height: '38px',
        }}
      >
        <Plus className="w-4 h-4" />
        신규
      </button>
    </div>
  )
}

/* ─── 메인 페이지 ─── */
export default function ImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [parseResult, setParseResult] = useState<{ pos: ParsedPO[]; totalItems: number } | null>(null)
  const [expandedPO, setExpandedPO] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  // 기존 발주처 목록
  const [existingVendors, setExistingVendors] = useState<ExistingVendor[]>([])
  // 빈 발주처 PO 입력
  const [vendorInputs, setVendorInputs] = useState<VendorInput[]>([])
  const [registering, setRegistering] = useState(false)
  const [vendorsApplied, setVendorsApplied] = useState(false)

  // 기존 발주처 로드
  useEffect(() => {
    fetch('/api/vendors')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setExistingVendors(data) : null)
      .catch(() => {})
  }, [])

  // parseResult 변경 시 빈 발주처 PO 추출
  useEffect(() => {
    if (!parseResult) return
    const emptyPOs = parseResult.pos.filter((p) => !p.vendorName)
    setVendorInputs(emptyPOs.map((p) => ({
      poNumber: p.poNumber,
      rowIndex: p.rowIndex,
      mode: 'select',
      selectedVendor: null,
      search: '',
      dropdownOpen: false,
      newName: '',
      newCountry: 'KR',
      newCurrency: 'KRW',
    })))
    setVendorsApplied(false)
  }, [parseResult])

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return
    const f = accepted[0]
    if (!f.name.match(/\.(xlsx|xls)$/i)) { toast.error('xlsx 또는 xls 파일만 지원합니다'); return }
    setFile(f); setStep('parsing'); setProgress(0)

    const formData = new FormData()
    formData.append('file', f)
    const interval = setInterval(() => setProgress((p) => Math.min(p + 10, 80)), 200)

    try {
      const res = await fetch('/api/purchase-orders/import/parse', { method: 'POST', body: formData })
      clearInterval(interval); setProgress(100)
      if (!res.ok) throw new Error((await res.json()).message || '파싱 실패')
      const data = await res.json()
      setParseResult(data)
      setStep('preview')
    } catch (err: any) {
      clearInterval(interval)
      toast.error(err.message || '파일 파싱 중 오류가 발생했습니다')
      setStep('upload')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  })

  function updateVendorInput(idx: number, partial: Partial<VendorInput>) {
    setVendorInputs((prev) => prev.map((v, i) => i === idx ? { ...v, ...partial } : v))
  }

  // 완료된 입력 수
  const completedCount = vendorInputs.filter((v) =>
    v.mode === 'select' ? !!v.selectedVendor : !!v.newName.trim()
  ).length

  async function handleApplyVendors() {
    if (!parseResult) return
    setRegistering(true)
    try {
      // 1. 신규 등록 발주처 생성
      const toCreate = vendorInputs
        .filter((v) => v.mode === 'create' && v.newName.trim())
        .map((v) => ({ name: v.newName.trim(), country: v.newCountry, currency: v.newCurrency }))

      if (toCreate.length > 0) {
        const res = await fetch('/api/vendors/bulk-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendors: toCreate }),
        })
        const data = await res.json()
        if (data.created > 0) {
          // 기존 발주처 목록 갱신
          const refreshed = await fetch('/api/vendors').then((r) => r.json())
          if (Array.isArray(refreshed)) setExistingVendors(refreshed)
          toast.success(`${data.created}개 발주처가 새로 등록되었습니다!`)
        }
      }

      // 2. parseResult 업데이트 (vendorName 채우기)
      const updatedPos = parseResult.pos.map((po) => {
        if (po.vendorName) return po
        const input = vendorInputs.find(
          (v) => v.poNumber === po.poNumber && v.rowIndex === po.rowIndex
        )
        if (!input) return po
        const name = input.mode === 'select'
          ? (input.selectedVendor?.name || '')
          : input.newName.trim()
        if (!name) return po
        return {
          ...po,
          vendorName: name,
          errors: po.errors.filter((e) => !e.includes('발주처')),
        }
      })
      setParseResult({ ...parseResult, pos: updatedPos })
      setVendorInputs([])
      setVendorsApplied(true)
      toast.success('발주처가 적용되었습니다')
    } catch {
      toast.error('발주처 적용 중 오류가 발생했습니다')
    } finally {
      setRegistering(false)
    }
  }

  async function handleSave() {
    if (!parseResult) return
    setStep('saving')
    try {
      const res = await fetch('/api/purchase-orders/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos: parseResult.pos }),
      })
      if (!res.ok) throw new Error((await res.json()).message || '저장 실패')
      const data = await res.json()
      setSavedCount(data.saved); setStep('done')
      toast.success(`${data.saved}개 발주가 저장되었습니다!`)
    } catch (err: any) {
      toast.error(err.message || '저장 중 오류가 발생했습니다')
      setStep('preview')
    }
  }

  const errorCount = parseResult?.pos.filter((p) => p.errors.length > 0).length || 0
  const validCount = (parseResult?.pos.length || 0) - errorCount

  function resetAll() {
    setStep('upload'); setParseResult(null); setFile(null)
    setVendorInputs([]); setVendorsApplied(false)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>엑셀 Import</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        기존 P/O 발행대장 엑셀 파일을 업로드하면 자동으로 DB에 저장됩니다
      </p>

      {/* Step Indicator */}
      <div className="flex items-center gap-3 mb-8">
        {(['upload', 'preview', 'done'] as const).map((s, idx) => {
          const labels = ['파일 업로드', '내용 확인', '완료']
          const done = step === 'done' || (step === 'preview' && idx === 0) || (step === 'saving' && idx <= 1)
          const current = ((step === 'upload' || step === 'parsing') && idx === 0) ||
            ((step === 'preview' || step === 'saving') && idx === 1) || (step === 'done' && idx === 2)
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: done || current ? 'var(--accent)' : 'rgba(128,128,128,0.2)', color: done || current ? '#000' : 'var(--text-subtle)' }}>
                  {done && !current ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span className="text-sm" style={{ color: current ? 'var(--accent)' : done ? 'var(--text-muted)' : 'var(--text-subtle)', fontWeight: current ? 600 : 400 }}>
                  {labels[idx]}
                </span>
              </div>
              {idx < 2 && <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />}
            </div>
          )
        })}
      </div>

      {/* Upload Step */}
      {(step === 'upload' || step === 'parsing') && (
        <div {...getRootProps()} className="glass-card flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
          style={{ padding: '64px 32px', borderStyle: 'dashed', borderWidth: '2px', borderColor: isDragActive ? 'var(--accent)' : 'var(--border)', background: isDragActive ? 'rgba(255,192,0,0.05)' : 'var(--bg-card)' }}>
          <input {...getInputProps()} id="file-upload-input" />
          {step === 'parsing' ? (
            <>
              <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: 'var(--accent)' }} />
              <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>파싱 중...</div>
              <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{file?.name}</div>
              <div className="w-full max-w-xs">
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%`, transition: 'width 0.2s ease' }} /></div>
                <div className="text-xs text-right mt-1 mono" style={{ color: 'var(--text-subtle)' }}>{progress}%</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: isDragActive ? 'var(--accent-dim)' : 'rgba(128,128,128,0.1)' }}>
                <FileSpreadsheet className="w-8 h-8" style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-subtle)' }} />
              </div>
              <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {isDragActive ? '파일을 여기에 놓으세요!' : '엑셀 파일을 드래그 & 드롭'}
              </div>
              <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>또는 클릭하여 파일 선택</div>
              <div className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--text-subtle)' }}>
                .xlsx, .xls 지원 (P/O 발행대장 양식)
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview Step */}
      {(step === 'preview' || step === 'saving') && parseResult && (
        <div className="space-y-5">

          {/* ===== 발주처 미입력 패널 ===== */}
          {vendorInputs.length > 0 && (
            <div className="glass-card p-5" style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.03)' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" style={{ color: '#f59e0b' }} />
                  <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>
                    발주처 미입력 {vendorInputs.length}건
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {completedCount}/{vendorInputs.length} 완료
                </span>
              </div>
              <p className="text-xs mb-5 ml-7" style={{ color: 'var(--text-subtle)' }}>
                기존 발주처를 검색하거나, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+ 신규</span> 버튼으로 새 발주처를 등록하세요
              </p>

              <div className="space-y-3">
                {vendorInputs.map((input, idx) => {
                  const isDone = input.mode === 'select' ? !!input.selectedVendor : !!input.newName.trim()
                  return (
                    <div key={`${input.poNumber}-${input.rowIndex}`}
                      className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--bg-card)', border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'var(--border)'}` }}>
                      {/* 완료 여부 아이콘 */}
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1.5"
                        style={{ background: isDone ? 'rgba(16,185,129,0.2)' : 'rgba(128,128,128,0.1)' }}>
                        {isDone
                          ? <Check className="w-3 h-3" style={{ color: 'var(--status-completed)' }} />
                          : <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{idx + 1}</span>
                        }
                      </div>
                      {/* PO 번호 */}
                      <div className="mono text-sm font-semibold flex-shrink-0 pt-1.5"
                        style={{ color: 'var(--accent)', minWidth: '160px' }}>
                        {input.poNumber}
                      </div>
                      {/* VendorSelect */}
                      <VendorSelect
                        input={input}
                        existingVendors={existingVendors}
                        onChange={(partial) => updateVendorInput(idx, partial)}
                      />
                    </div>
                  )
                })}
              </div>

              {/* 적용 버튼 */}
              <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  미완료 항목은 오류로 처리됩니다
                </span>
                <button
                  onClick={handleApplyVendors}
                  disabled={registering || completedCount === 0}
                  className="btn-gold flex items-center gap-2 text-sm"
                  style={{ opacity: completedCount === 0 ? 0.4 : 1 }}
                >
                  {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {registering ? '처리 중...' : `발주처 ${completedCount}건 적용`}
                </button>
              </div>
            </div>
          )}

          {/* 적용 완료 알림 */}
          {vendorsApplied && (
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--status-completed)' }} />
              <span className="text-sm" style={{ color: 'var(--status-completed)' }}>발주처 적용 완료! 이제 저장할 수 있습니다.</span>
            </div>
          )}

          {/* Summary */}
          <div className="glass-card p-5">
            <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>파싱 결과 요약</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {[
                { n: parseResult.pos.length, label: '발주 건수', color: 'var(--status-completed)', bg: 'rgba(16,185,129,0.1)' },
                { n: parseResult.totalItems, label: '품목 건수', color: 'var(--status-issued)', bg: 'rgba(59,130,246,0.1)' },
                { n: errorCount, label: '오류 건수', color: errorCount > 0 ? 'var(--status-cancelled)' : 'var(--status-completed)', bg: errorCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' },
              ].map(({ n, label, color, bg }) => (
                <div key={label} className="text-center p-3 rounded-xl" style={{ background: bg }}>
                  <div className="text-2xl font-bold mono" style={{ color }}>{n}</div>
                  <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* PO List Preview */}
          <div className="glass-card p-5">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>발주 목록 미리보기</div>
            <div className="space-y-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {parseResult.pos.map((po, idx) => (
                <div key={`${po.poNumber}-${idx}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                    style={{ background: po.errors.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)', border: `1px solid ${po.errors.length > 0 ? 'rgba(239,68,68,0.2)' : 'var(--border)'}` }}
                    onClick={() => setExpandedPO(expandedPO === `${po.poNumber}-${idx}` ? null : `${po.poNumber}-${idx}`)}>
                    {po.errors.length > 0
                      ? <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-cancelled)' }} />
                      : <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-completed)' }} />}
                    <div className="mono text-sm font-medium" style={{ color: 'var(--accent)', minWidth: '200px' }}>{po.poNumber}</div>
                    <div className="text-sm truncate flex-1" style={{ color: po.vendorName ? 'var(--text-muted)' : 'var(--status-cancelled)' }}>
                      {po.vendorName || '⚠ 발주처 미입력'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>품목 {po.items.length}건</div>
                    {expandedPO === `${po.poNumber}-${idx}`
                      ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
                      : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />}
                  </div>
                  {expandedPO === `${po.poNumber}-${idx}` && (
                    <div className="mt-1 p-3 rounded-xl" style={{ background: 'var(--bg-card)', marginLeft: '8px', border: '1px solid var(--border)' }}>
                      {po.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--status-cancelled)' }}>
                          <XCircle className="w-3 h-3" /> {err}
                        </div>
                      ))}
                      {po.items.map((item, i) => (
                        <div key={i} className="text-xs py-1.5" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{item.productName}</span>
                          {' '}{item.quantity.toLocaleString()} {item.unit}
                          {' '}<span style={{ color: 'var(--accent)' }}>@ {item.unitPrice} {item.currency}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={resetAll} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <X className="w-4 h-4" /> 취소
            </button>
            <div className="flex-1" />
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#f59e0b' }}>
                <AlertTriangle className="w-4 h-4" /> 오류 {errorCount}건 제외 후 저장
              </div>
            )}
            <button id="import-save-button" onClick={handleSave}
              disabled={step === 'saving' || validCount === 0}
              className="btn-gold flex items-center gap-2 text-sm">
              {step === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {validCount}건 DB에 저장
            </button>
          </div>
        </div>
      )}

      {/* Done Step */}
      {step === 'done' && (
        <div className="glass-card flex flex-col items-center p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.2)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--status-completed)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Import 완료!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            <span className="mono font-bold" style={{ color: 'var(--accent)' }}>{savedCount}개</span>의 발주가 성공적으로 저장되었습니다
          </p>
          <button id="go-to-list-button" onClick={() => router.push('/purchase-orders')} className="btn-gold flex items-center gap-2">
            발행대장 보기 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

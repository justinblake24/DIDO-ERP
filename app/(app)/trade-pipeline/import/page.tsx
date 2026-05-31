'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import {
  Upload, FileText, FileSpreadsheet, X, AlertTriangle,
  CheckCircle, Loader2, ChevronRight, FolderOpen
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
  success: boolean
  caseName: string
  nhDhNumber: string | null
  linkScore: {
    score: number
    level: 'HIGH' | 'MEDIUM' | 'LOW'
    matchedOn: string[]
    warnings: string[]
  }
  documents: ParsedDoc[]
}

const DOC_TYPE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  JP_PO:        { label: '일본 発注書',    color: '#f59e0b', emoji: '🇯🇵' },
  KR_PO_INTL:   { label: '해외 발주서',    color: '#3b82f6', emoji: '🌍' },
  KR_PO_LOCAL:  { label: '국내 발주서',    color: '#8b5cf6', emoji: '🇰🇷' },
  INVOICE_NOAH: { label: '請求書 (NOAH)',  color: '#10b981', emoji: '📄' },
  SHIPPING_DOC: { label: '선적서류',       color: '#6366f1', emoji: '📦' },
}

const SCORE_CONFIG = {
  HIGH:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '높음 — 자동 연결' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '보통 — 수동 확인 필요' },
  LOW:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: '낮음 — 연결 불가' },
}

export default function TradePipelineImportPage() {
  const router = useRouter()
  const [caseName, setCaseName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...accepted.filter(f => !names.has(f.name))]
    })
    setResult(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: true,
  })

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name))
    setResult(null)
  }

  async function handleParse() {
    if (!files.length) { toast.error('파일을 먼저 업로드하세요'); return }
    if (!caseName.trim()) { toast.error('거래 케이스 이름을 입력하세요'); return }

    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('caseName', caseName.trim())
      files.forEach(f => fd.append('files', f))

      const res = await fetch('/api/trade-pipeline/upload', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || '파싱 오류')
      setResult(data)
      toast.success('파싱 완료! 결과를 확인하세요')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setParsing(false)
    }
  }

  function handleReview() {
    if (!result) return
    // 파싱 결과를 sessionStorage에 저장 후 검토 페이지로
    sessionStorage.setItem('tradeParseResult', JSON.stringify(result))
    router.push('/trade-pipeline/review')
  }

  const scoreConf = result ? SCORE_CONFIG[result.linkScore.level] : null

  return (
    <div style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '32px' }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)', marginBottom: '8px' }}>
          <span>무역 파이프라인</span>
          <ChevronRight className="w-3 h-3" />
          <span>문서 업로드</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          🚢 무역 문서 업로드
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '6px', fontSize: '14px' }}>
          거래 폴더 안의 PDF / Excel 파일을 모두 올려주세요. 자동으로 분류하고 연결합니다.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* 케이스 이름 */}
        <div className="erp-card" style={{ padding: '24px' }}>
          <label className="block text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
            거래 케이스 이름 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={caseName}
            onChange={e => setCaseName(e.target.value)}
            placeholder="예: C-12_두바이쫀득쿠키"
            className="erp-input"
            style={{ maxWidth: '480px' }}
          />
          <p className="text-xs" style={{ color: 'var(--text-subtle)', marginTop: '6px' }}>
            폴더명을 그대로 사용하는 것을 권장합니다
          </p>
        </div>

        {/* 드래그앤드롭 영역 */}
        <div className="erp-card" style={{ padding: '24px' }}>
          <label className="block text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
            파일 업로드
          </label>
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragActive ? 'var(--accent-dim)' : 'var(--bg-card)',
              transition: 'all 0.2s ease',
            }}
          >
            <input {...getInputProps()} />
            <FolderOpen className="w-10 h-10 mx-auto mb-3" style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-subtle)' }} />
            {isDragActive ? (
              <p style={{ color: 'var(--accent)', fontWeight: 600 }}>파일을 여기에 놓으세요!</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  파일을 드래그하거나 클릭하여 선택
                </p>
                <p className="text-sm" style={{ color: 'var(--text-subtle)', marginTop: '4px' }}>
                  PDF, XLSX 지원 · 여러 파일 동시 업로드 가능
                </p>
              </>
            )}
          </div>

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map(f => (
                <div key={f.name} className="flex items-center gap-3"
                  style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  {f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
                    ? <FileSpreadsheet className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                    : <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#3b82f6' }} />
                  }
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {(f.size / 1024).toFixed(0)}KB
                  </span>
                  <button onClick={() => removeFile(f.name)} style={{ color: 'var(--text-subtle)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 파싱 버튼 */}
        <button
          onClick={handleParse}
          disabled={parsing || !files.length || !caseName.trim()}
          className="erp-btn-primary flex items-center justify-center gap-2"
          style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 600 }}
        >
          {parsing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> 파싱 중...</>
            : <><Upload className="w-4 h-4" /> 자동 파싱 시작</>
          }
        </button>

        {/* 파싱 결과 */}
        {result && (
          <div className="erp-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              📊 파싱 결과
            </h2>

            {/* 연결 점수 */}
            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: scoreConf?.bg,
              border: `1px solid ${scoreConf?.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: scoreConf?.color }}>
                  연결 신뢰도: {result.linkScore.score}점 — {scoreConf?.label}
                </div>
                {result.linkScore.matchedOn.map((m, i) => (
                  <div key={i} className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                    ✓ {m}
                  </div>
                ))}
              </div>
              <div className="text-3xl font-black" style={{ color: scoreConf?.color }}>
                {result.linkScore.score}
              </div>
            </div>

            {/* 경고 */}
            {result.linkScore.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2" style={{
                padding: '12px 16px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
              }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <span className="text-sm" style={{ color: '#f59e0b' }}>{w}</span>
              </div>
            ))}

            {/* 문서별 결과 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.documents.map((doc, i) => {
                const typeConf = DOC_TYPE_LABELS[doc.docType] || { label: doc.docType, color: 'var(--text-muted)', emoji: '📄' }
                return (
                  <div key={i} style={{
                    padding: '14px 16px', borderRadius: '10px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                  }}>
                    <span style={{ fontSize: '20px' }}>{typeConf.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {doc.fileName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${typeConf.color}20`, color: typeConf.color }}>
                          {typeConf.label}
                        </span>
                        {doc.docNumber && (
                          <span className="text-xs mono" style={{ color: 'var(--text-subtle)' }}>
                            {doc.docNumber}
                          </span>
                        )}
                      </div>

                      {/* 추출된 번호들 */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {doc.numbers.nhDh && (
                          <span className="text-xs" style={{ color: '#f59e0b' }}>NH-DH: {doc.numbers.nhDh}</span>
                        )}
                        {doc.numbers.dhpo && (
                          <span className="text-xs" style={{ color: '#3b82f6' }}>DHPO: {doc.numbers.dhpo}</span>
                        )}
                        {doc.numbers.invNo && (
                          <span className="text-xs" style={{ color: '#10b981' }}>INV: {doc.numbers.invNo}</span>
                        )}
                      </div>

                      {/* 경고 */}
                      {doc.warnings.map((w, wi) => (
                        <div key={wi} className="text-xs mt-1" style={{ color: '#f59e0b' }}>
                          ⚠ {w}
                        </div>
                      ))}
                    </div>

                    {/* 신뢰도 */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold" style={{
                        color: doc.confidence >= 80 ? '#10b981' : doc.confidence >= 60 ? '#f59e0b' : '#ef4444'
                      }}>
                        {doc.confidence}점
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 검토 화면으로 이동 */}
            <button
              onClick={handleReview}
              disabled={result.linkScore.level === 'LOW'}
              className="erp-btn-primary flex items-center justify-center gap-2"
              style={{ padding: '14px 32px', fontSize: '15px', fontWeight: 600 }}
            >
              <CheckCircle className="w-4 h-4" />
              검토 화면으로 이동 →
            </button>
            {result.linkScore.level === 'LOW' && (
              <p className="text-sm text-center" style={{ color: '#ef4444' }}>
                연결 신뢰도가 너무 낮습니다. 파일을 다시 확인해주세요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * app/api/trade-pipeline/upload/route.ts
 * 
 * 파일 업로드 + 텍스트 추출 + 파싱 API
 * PDF → pdftotext, Excel → exceljs
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { parseTradeDocument, calculateLinkScore, ParsedDocument } from '@/lib/trade-pipeline/parser'

const execAsync = promisify(exec)
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'trade-pipeline')

// ─── 텍스트 추출 ─────────────────────────────────────────────────

async function extractPdfText(filePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`pdftotext -layout "${filePath}" -`)
    return stdout
  } catch {
    return ''
  }
}

async function extractExcelText(filePath: string): Promise<string> {
  try {
    const ExcelJS = await import('exceljs')
    const wb = new ExcelJS.default.Workbook()
    await wb.xlsx.readFile(filePath)

    const lines: string[] = []
    wb.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        const vals = (row.values as any[])
          .slice(1)
          .map(v => {
            if (v && typeof v === 'object') {
              if (v instanceof Date) return v.toISOString()
              if ('result' in v) return String(v.result).trim()
              if ('richText' in v && Array.isArray(v.richText)) {
                return v.richText.map((rt: any) => rt.text).join('').trim()
              }
              if ('text' in v) return String(v.text).trim()
            }
            return v !== null && v !== undefined ? String(v).trim() : ''
          })
          .filter(v => v !== '')
        if (vals.length > 0) lines.push(vals.join('\t'))
      })
    })
    return lines.join('\n')
  } catch {
    return ''
  }
}

// ─── POST 핸들러 ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const caseName = (formData.get('caseName') as string) || 'Unnamed Case'
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    }

    // 업로드 디렉토리 생성
    const caseDir = join(UPLOAD_DIR, caseName.replace(/[^\w가-힣\-_]/g, '_'))
    await mkdir(caseDir, { recursive: true })

    const parsedDocs: (ParsedDocument & { fileName: string; filePath: string })[] = []

    for (const file of files) {
      const fileName = file.name
      const filePath = join(caseDir, fileName)

      // 파일 저장
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      // 텍스트 추출
      let text = ''
      if (fileName.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(filePath)
      } else if (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) {
        text = await extractExcelText(filePath)
      }

      if (!text.trim()) {
        parsedDocs.push({
          ...(parseTradeDocument('', fileName)),
          fileName,
          filePath,
          confidence: 0,
          warnings: ['텍스트를 추출할 수 없습니다 — 스캔 이미지이거나 손상된 파일일 수 있습니다'],
        })
        continue
      }

      const parsed = parseTradeDocument(text, fileName)
      parsedDocs.push({ ...parsed, fileName, filePath })
    }

    // 전체 거래 연결 점수 계산
    const linkScore = calculateLinkScore(parsedDocs)

    // NH-DH 번호 추출 (請求書에서 가장 신뢰도 높음)
    const invoiceDoc = parsedDocs.find(d => d.docType === 'INVOICE_NOAH')
    const nhDhNumber = invoiceDoc?.numbers.nhDh
      ?? parsedDocs.find(d => d.numbers.nhDh)?.numbers.nhDh
      ?? null

    return NextResponse.json({
      success: true,
      caseName,
      nhDhNumber,
      linkScore,
      documents: parsedDocs.map(d => ({
        fileName: d.fileName,
        filePath: d.filePath,
        docType: d.docType,
        docNumber: d.docNumber,
        numbers: d.numbers,
        parties: d.parties,
        items: d.items,
        incidentalCosts: d.incidentalCosts,
        shipping: d.shipping,
        amounts: d.amounts,
        confidence: d.confidence,
        warnings: d.warnings,
      })),
    })
  } catch (err) {
    console.error('[trade-pipeline/upload]', err)
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다', detail: String(err) },
      { status: 500 }
    )
  }
}

// lib/excel-parser.ts
/**
 * 엑셀 Import 파서
 * 기존 2026_P_O_발행대장_양식.xlsx 형식 지원
 * 29컬럼 × multi-sheet 구조
 */

export interface ParsedPOItem {
  productName: string
  specification?: string
  quantity: number
  unit: string
  unitPrice: number
  currency: string
  totalAmount: number
}

export interface ParsedPayment {
  installment: number
  ratio: number
  payDate: Date | null
  currency: string
  amount: number
}

export interface ParsedPO {
  poNumber: string
  issueDate: Date | null
  vendorName: string
  status: string
  remarks: string
  items: ParsedPOItem[]
  payments: ParsedPayment[]
  rowIndex: number
  sheetName: string
  errors: string[]
}

export interface ParseResult {
  pos: ParsedPO[]
  totalItems: number
  anomalies: Array<{ poNumber: string; message: string }>
  errors: Array<{ row: number; sheet: string; message: string }>
}

// 컬럼 인덱스 (0-based)
const COL = {
  NO: 0,           // A
  ISSUE_DATE: 1,   // B
  PO_NUMBER: 2,    // C
  VENDOR: 3,       // D
  PRODUCT: 4,      // E
  QTY: 5,          // F
  TOTAL_QTY: 6,    // G
  UNIT: 7,         // H
  PRICE_KRW: 8,    // I
  PRICE_JPY: 9,    // J
  PRICE_USD: 10,   // K
  AMOUNT: 11,      // L
  PAY_INSTALLMENT: 12, // M
  PAY_DATE: 13,    // N
  PAY_CURRENCY: 14, // O
  PAY_AMOUNT: 15,  // P
  TAX_INVOICE: 16, // Q
  APPROVED: 17,    // R
  INV_PRICE_JPY: 18, // S
  INV_TOTAL_JPY: 19, // T
  INV_DATE: 20,    // U
  INV_NUMBER: 21,  // V
  INV_RATIO: 22,   // W
  INV_AMOUNT: 23,  // X
  DEP_TOTAL: 24,   // Y
  DEP_DATE: 25,    // Z
  DEP_FX_RATE: 26, // AA
  REMARKS: 27,     // AB
}

// 메모성 텍스트 패턴 (발주처가 아닌 경우)
const MEMO_PATTERNS = [
  '발주 취소', '취소', '출고', '선적', '환율', '입금', '통관', '도착',
]

function isMemoText(text: string): boolean {
  return MEMO_PATTERNS.some(p => text.includes(p))
}

function parseDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'number') {
    // Excel serial date
    const date = new Date((val - 25569) * 86400 * 1000)
    return date
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(String(val).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function detectCurrency(krw: unknown, jpy: unknown, usd: unknown): { price: number; currency: string } {
  const k = parseNumber(krw)
  const j = parseNumber(jpy)
  const u = parseNumber(usd)

  if (u > 0) return { price: u, currency: 'USD' }
  if (j > 0) return { price: j, currency: 'JPY' }
  if (k > 0) return { price: k, currency: 'KRW' }
  return { price: 0, currency: 'KRW' }
}

export async function parseExcelFile(buffer: ArrayBuffer): Promise<ParseResult> {
  // 동적 import (서버 사이드에서만)
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const result: ParseResult = {
    pos: [],
    totalItems: 0,
    anomalies: [],
    errors: [],
  }

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name
    let currentPO: ParsedPO | null = null

    // 3행 헤더 스킵 (4행부터 데이터)
    let rowIndex = 0
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      rowIndex = rowNumber
      if (rowNumber <= 3) return // 헤더 스킵

      const cells = row.values as unknown[]
      // ExcelJS는 1-indexed, 슬라이스로 0-indexed 변환
      const c = (i: number) => cells[i + 1]

      const poNumber = String(c(COL.PO_NUMBER) || '').trim()
      const vendorRaw = String(c(COL.VENDOR) || '').trim()
      const product = String(c(COL.PRODUCT) || '').trim()

      // 빈 행 스킵
      if (!poNumber && !product) return

      if (poNumber) {
        // 새 PO 헤더 행
        const isVendorMemo = isMemoText(vendorRaw)
        const issueDate = parseDate(c(COL.ISSUE_DATE))

        currentPO = {
          poNumber,
          issueDate,
          vendorName: isVendorMemo ? '' : vendorRaw,
          status: 'ISSUED',
          remarks: isVendorMemo ? vendorRaw : String(c(COL.REMARKS) || '').trim(),
          items: [],
          payments: [],
          rowIndex: rowNumber,
          sheetName,
          errors: [],
        }

        if (!currentPO.vendorName) {
          currentPO.errors.push('발주처 없음 또는 메모 텍스트')
        }

        result.pos.push(currentPO)
      }

      // 품목 처리 (po 헤더 행 또는 추가 품목 행)
      if (product && currentPO) {
        const qty = parseNumber(c(COL.QTY))
        const { price, currency } = detectCurrency(
          c(COL.PRICE_KRW),
          c(COL.PRICE_JPY),
          c(COL.PRICE_USD)
        )
        const total = parseNumber(c(COL.AMOUNT)) || qty * price

        currentPO.items.push({
          productName: product,
          quantity: qty,
          unit: String(c(COL.UNIT) || 'EA').trim(),
          unitPrice: price,
          currency,
          totalAmount: total,
        })

        result.totalItems++
      }

      // remarks 추가
      const remarks = String(c(COL.REMARKS) || '').trim()
      if (remarks && currentPO && poNumber === '') {
        if (currentPO.remarks) {
          currentPO.remarks += ' / ' + remarks
        } else {
          currentPO.remarks = remarks
        }
      }
    })
  }

  return result
}

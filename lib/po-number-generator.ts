// lib/po-number-generator.ts
import { prisma } from './prisma'

/**
 * 발주번호 자동생성
 * 수입: DHPO-(I)YYMMDDM-XXX
 * 국내: DHPO-YYMMDD-XXX®
 */
export async function generatePONumber(
  isImport: boolean,
  date: Date = new Date()
): Promise<string> {
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31, 23, 59, 59)

  // 트랜잭션으로 동시성 보장
  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.purchaseOrder.count({
      where: {
        issueDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    })

    const seq = String(count + 1).padStart(3, '0')

    if (isImport) {
      return `DHPO-(I)${yy}${mm}${dd}M-${seq}`
    } else {
      return `DHPO-${yy}${mm}${dd}-${seq}®`
    }
  })

  return result
}

/**
 * 발주처 국가에 따라 수입 여부 판단
 */
export function isImportVendor(country: string): boolean {
  return country !== 'KR'
}

/**
 * 청구번호 자동생성
 * 형식: DHPI-C(N)YYMMDDM-XXX
 */
export async function generateInvoiceNumber(date: Date = new Date()): Promise<string> {
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)

  const count = await prisma.invoice.count({
    where: {
      invoiceDate: { gte: startOfYear },
    },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `DHPI-C(N)${yy}${mm}${dd}M-${seq}`
}

/**
 * app/api/trade-pipeline/route.ts
 * 
 * 거래 케이스 목록 조회 API
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {

    const cases = await prisma.tradeCase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        documents: {
          select: {
            id: true,
            docType: true,
            docNumber: true,
            fileName: true,
            confidence: true,
            verified: true,
          },
        },
        shippingInfo: true,
        linkedPOs: {
          select: { id: true, poNumber: true, status: true },
        },
        linkedInvoices: {
          select: {
            id: true,
            invoiceNo: true,
            totalJPY: true,
            deposits: { select: { amountJPY: true } },
          },
        },
      },
    })

    // 각 케이스에 요약 정보 추가
    const enriched = cases.map(c => {
      const totalInvoiced = c.linkedInvoices.reduce(
        (sum, inv) => sum + Number(inv.totalJPY), 0
      )
      const totalDeposited = c.linkedInvoices.reduce(
        (sum, inv) => sum + inv.deposits.reduce((s, d) => s + Number(d.amountJPY), 0),
        0
      )
      return {
        ...c,
        summary: {
          docCount: c.documents.length,
          verifiedCount: c.documents.filter(d => d.verified).length,
          poCount: c.linkedPOs.length,
          invoiceCount: c.linkedInvoices.length,
          totalInvoicedJPY: totalInvoiced,
          totalDepositedJPY: totalDeposited,
          paymentComplete: totalDeposited >= totalInvoiced && totalInvoiced > 0,
        },
      }
    })

    return NextResponse.json({ cases: enriched })
  } catch (err) {
    console.error('[trade-pipeline GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

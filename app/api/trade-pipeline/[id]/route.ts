/**
 * app/api/trade-pipeline/[id]/route.ts
 *
 * 거래 케이스 상세 조회 + 상태 업데이트 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─── GET: 케이스 상세 조회 ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const tradeCase = await prisma.tradeCase.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
        shippingInfo: true,
        linkedPOs: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            vendor: { select: { name: true } },
            issueDate: true,
            items: { select: { totalAmount: true } },
          },
          orderBy: { issueDate: 'desc' },
        },
        linkedInvoices: {
          select: {
            id: true,
            invoiceNo: true,
            totalJPY: true,
            invoiceDate: true,
            deposits: {
              select: { id: true, amountJPY: true, depositDate: true },
              orderBy: { depositDate: 'desc' },
            },
          },
          orderBy: { invoiceDate: 'desc' },
        },
      },
    })

    if (!tradeCase) {
      return NextResponse.json({ error: '케이스를 찾을 수 없습니다' }, { status: 404 })
    }

    // 금액 요약 계산
    const totalInvoicedJPY = tradeCase.linkedInvoices.reduce(
      (s, inv) => s + Number(inv.totalJPY), 0
    )
    const totalDepositedJPY = tradeCase.linkedInvoices.reduce(
      (s, inv) => s + inv.deposits.reduce((d, dep) => d + Number(dep.amountJPY), 0),
      0
    )
    const totalPOJPY = tradeCase.linkedPOs.reduce(
      (s, po) => s + po.items.reduce((a, item) => a + Number(item.totalAmount), 0), 0
    )

    return NextResponse.json({
      ...tradeCase,
      summary: {
        docCount: tradeCase.documents.length,
        verifiedCount: tradeCase.documents.filter(d => d.verified).length,
        poCount: tradeCase.linkedPOs.length,
        invoiceCount: tradeCase.linkedInvoices.length,
        totalPOJPY,
        totalInvoicedJPY,
        totalDepositedJPY,
        remainingJPY: totalInvoicedJPY - totalDepositedJPY,
        paymentComplete: totalDepositedJPY >= totalInvoicedJPY && totalInvoicedJPY > 0,
      },
    })
  } catch (err) {
    console.error('[trade-pipeline/[id] GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── PATCH: 상태 업데이트 + 메모 수정 ────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updated = await prisma.tradeCase.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.memo !== undefined && { memo: body.memo }),
        ...(body.nhDhNumber !== undefined && { nhDhNumber: body.nhDhNumber }),
      },
    })

    return NextResponse.json({ success: true, tradeCase: updated })
  } catch (err) {
    console.error('[trade-pipeline/[id] PATCH]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

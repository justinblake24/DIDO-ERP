/**
 * app/api/trade-pipeline/[id]/link-invoice/route.ts
 *
 * 무역 케이스에 청구서 연결/해제
 * POST body: { invoiceId: string }   → 연결
 * DELETE body: { invoiceId: string } → 해제
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId 필요' }, { status: 400 })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { tradeCaseId: id },
    })

    // 케이스 상태가 PO_CREATED 또는 SHIPPED면 INVOICED로 자동 진행
    const tc = await prisma.tradeCase.findUnique({ where: { id }, select: { status: true } })
    if (tc?.status === 'SHIPPED' || tc?.status === 'PO_CREATED') {
      await prisma.tradeCase.update({ where: { id }, data: { status: 'INVOICED' } })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[link-invoice POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId 필요' }, { status: 400 })

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { tradeCaseId: null },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[link-invoice DELETE]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

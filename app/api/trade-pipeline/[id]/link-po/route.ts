/**
 * app/api/trade-pipeline/[id]/link-po/route.ts
 *
 * 무역 케이스에 발주서 연결/해제
 * POST body: { poId: string }        → 연결
 * DELETE body: { poId: string }      → 해제
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { poId } = await req.json()
    if (!poId) return NextResponse.json({ error: 'poId 필요' }, { status: 400 })

    // PO에 tradeCaseId 연결
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { tradeCaseId: id },
    })

    // 케이스 상태가 REVIEWED이면 PO_CREATED로 자동 진행
    const tc = await prisma.tradeCase.findUnique({ where: { id }, select: { status: true } })
    if (tc?.status === 'REVIEWED') {
      await prisma.tradeCase.update({ where: { id }, data: { status: 'PO_CREATED' } })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[link-po POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { poId } = await req.json()
    if (!poId) return NextResponse.json({ error: 'poId 필요' }, { status: 400 })

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { tradeCaseId: null },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[link-po DELETE]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

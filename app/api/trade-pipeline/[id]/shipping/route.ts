/**
 * app/api/trade-pipeline/[id]/shipping/route.ts
 *
 * 선적 정보 수정 (ETD, ETA, 선적항, 도착항, 선사 등)
 * PATCH body: { etd?, eta?, portOfLoading?, portOfDischarge?, carrier?, incoterms?, containerNos? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    if (body.etd !== undefined) data.etd = body.etd ? new Date(body.etd) : null
    if (body.eta !== undefined) data.eta = body.eta ? new Date(body.eta) : null
    if (body.portOfLoading !== undefined) data.portOfLoading = body.portOfLoading
    if (body.portOfDischarge !== undefined) data.portOfDischarge = body.portOfDischarge
    if (body.carrier !== undefined) data.carrier = body.carrier
    if (body.incoterms !== undefined) data.incoterms = body.incoterms
    if (body.containerNos !== undefined) data.containerNos = body.containerNos

    const shipping = await prisma.shippingInfo.upsert({
      where: { tradeCaseId: id },
      update: data,
      create: {
        tradeCaseId: id,
        portOfLoading: body.portOfLoading || '',
        portOfDischarge: body.portOfDischarge || '',
        ...data,
      },
    })

    // ETD 입력되면 케이스 상태를 SHIPPED로 자동 변경
    if (body.etd) {
      const tc = await prisma.tradeCase.findUnique({ where: { id }, select: { status: true } })
      if (tc?.status === 'PO_CREATED') {
        await prisma.tradeCase.update({ where: { id }, data: { status: 'SHIPPED' } })
      }
    }

    return NextResponse.json({ success: true, shipping })
  } catch (err) {
    console.error('[shipping PATCH]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

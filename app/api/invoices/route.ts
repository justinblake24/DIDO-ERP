// app/api/invoices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAuditLog } from '@/lib/audit'

// GET — 청구서 목록
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const invoices = await prisma.invoice.findMany({
      include: {
        po: { include: { vendor: { select: { name: true, country: true } } } },
        deposits: true,
      },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoice GET error:', error)
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }
}

// POST — 청구서 등록
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } })
    if (!dbUser) return NextResponse.json({ error: '사용자 없음' }, { status: 403 })

    const body = await req.json() as {
      poId?: string
      invoiceNo: string
      invoiceDate: string
      totalJPY: number
      invoiceJPY: number
      ratio: number
      unitPriceJPY: number
      invoiceType?: 'REGULAR' | 'TRANSPORT' | 'SAMPLE'
      memo?: string
      sourceFile?: string
    }

    const { poId, invoiceNo, invoiceDate, totalJPY, invoiceJPY, ratio, unitPriceJPY, memo, sourceFile } = body
    const invoiceType = body.invoiceType ?? 'REGULAR'
    const needsPo = invoiceType === 'REGULAR'

    if (!invoiceNo || !invoiceDate || !totalJPY) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다' }, { status: 400 })
    }
    if (needsPo && !poId) {
      return NextResponse.json({ error: '일반 청구서는 P/O가 필요합니다' }, { status: 400 })
    }

    // 중복 확인
    const existing = await prisma.invoice.findUnique({ where: { invoiceNo } })
    if (existing) {
      return NextResponse.json({ error: `이미 등록된 청구서 번호입니다: ${invoiceNo}` }, { status: 409 })
    }

    // PO 확인 (일반 청구서만)
    let po: { id: string; status: string; poNumber: string } | null = null
    if (needsPo && poId) {
      po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        select: { id: true, status: true, poNumber: true },
      })
      if (!po) return NextResponse.json({ error: 'PO를 찾을 수 없습니다' }, { status: 404 })
    }

    // 트랜잭션으로 Invoice 생성 + PO 상태 업데이트
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          ...(poId ? { poId } : {}),
          invoiceNo,
          invoiceDate: new Date(invoiceDate),
          invoiceType,
          totalJPY,
          unitPriceJPY,
          ratio,
          memo: memo || null,
          sourceFile: sourceFile || null,
        },
      })

      // REGULAR이고 PO 상태가 SHIPPED이면 INVOICED로 업데이트
      if (po && po.status === 'SHIPPED') {
        await tx.purchaseOrder.update({
          where: { id: poId! },
          data: { status: 'INVOICED' },
        })
      }

      return inv
    })

    // 감사 로그
    await createAuditLog({
      table: 'Invoice',
      recordId: invoice.id,
      action: 'CREATE',
      after: { invoiceNo, poId, totalJPY, ratio },
      userId: dbUser.id,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice POST error:', error)
    return NextResponse.json({ error: '등록 실패' }, { status: 500 })
  }
}

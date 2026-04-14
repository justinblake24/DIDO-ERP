// app/api/purchase-orders/import/save/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ message: '인증이 필요합니다' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { email: authUser.email || '' } })
    if (!dbUser) return NextResponse.json({ message: '사용자 없음' }, { status: 404 })

    if (!['MANAGER', 'ADMIN'].includes(dbUser.role)) {
      return NextResponse.json({ message: 'MANAGER 이상 권한 필요' }, { status: 403 })
    }

    const { pos } = await req.json()
    let saved = 0
    const errors: Array<{ poNumber: string; error: string }> = []

    for (const po of pos) {
      if (po.errors && po.errors.length > 0) continue // 오류 건 스킵
      if (!po.vendorName || !po.poNumber) continue

      try {
        // 발주처 찾기 또는 생성
        let vendor = await prisma.vendor.findFirst({
          where: { name: { equals: po.vendorName, mode: 'insensitive' } },
        })

        if (!vendor) {
          const isImport = /[A-Za-z]/.test(po.vendorName)
          vendor = await prisma.vendor.create({
            data: {
              name: po.vendorName,
              country: isImport ? 'CN' : 'KR',
              currency: isImport ? 'USD' : 'KRW',
            },
          })
        }

        // PO 중복 체크
        const exists = await prisma.purchaseOrder.findUnique({ where: { poNumber: po.poNumber } })
        if (exists) continue

        const createdPO = await prisma.purchaseOrder.create({
          data: {
            poNumber: po.poNumber,
            issueDate: po.issueDate ? new Date(po.issueDate) : new Date(),
            vendorId: vendor.id,
            status: po.status || 'ISSUED',
            remarks: po.remarks || '',
            createdById: dbUser.id,
            items: {
              create: (po.items || []).map((item: any, idx: number) => ({
                productName: item.productName,
                specification: item.specification || null,
                quantity: item.quantity || 0,
                unit: item.unit || 'EA',
                unitPrice: item.unitPrice || 0,
                currency: item.currency || 'KRW',
                totalAmount: item.totalAmount || 0,
                sortOrder: idx,
              })),
            },
          },
        })

        await createAuditLog({
          table: 'PurchaseOrder',
          recordId: createdPO.id,
          action: 'CREATE',
          after: { poNumber: createdPO.poNumber, source: 'IMPORT' },
          userId: dbUser.id,
        })

        saved++
      } catch (err: any) {
        errors.push({ poNumber: po.poNumber, error: err.message })
      }
    }

    return NextResponse.json({ saved, errors })
  } catch (error: any) {
    return NextResponse.json({ message: error.message || '저장 실패' }, { status: 500 })
  }
}

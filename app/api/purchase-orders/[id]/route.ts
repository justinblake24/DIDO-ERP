// app/api/purchase-orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAuditLog } from '@/lib/audit'

interface Context { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const { id } = await params
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ message: '인증 필요' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { email: authUser.email || '' } })
    if (!dbUser) return NextResponse.json({ message: '사용자 없음' }, { status: 404 })

    const po = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!po) return NextResponse.json({ message: 'PO를 찾을 수 없습니다' }, { status: 404 })

    // 권한: 본인 or MANAGER+
    const canEdit = po.createdById === dbUser.id || ['MANAGER', 'ADMIN'].includes(dbUser.role)
    if (!canEdit) return NextResponse.json({ message: '권한이 없습니다' }, { status: 403 })

    const body = await req.json()
    const before = { ...po }

    // 기존 items 삭제 후 재생성
    await prisma.pOItem.deleteMany({ where: { poId: id } })

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        vendorId: body.vendorId,
        issueDate: new Date(body.issueDate),
        remarks: body.remarks,
        items: {
          create: body.items.map((item: any, idx: number) => ({
            productName: item.productName,
            specification: item.specification || null,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            currency: item.currency,
            totalAmount: item.totalAmount,
            sortOrder: idx,
          })),
        },
      },
    })

    await createAuditLog({
      table: 'PurchaseOrder',
      recordId: id,
      action: 'UPDATE',
      before: before as any,
      after: { vendorId: body.vendorId, issueDate: body.issueDate },
      userId: dbUser.id,
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'PO 수정 실패' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  const { id } = await params
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ message: '인증 필요' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { email: authUser.email || '' } })
    if (!dbUser || dbUser.role !== 'ADMIN') {
      return NextResponse.json({ message: 'ADMIN 권한만 삭제 가능합니다' }, { status: 403 })
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!po) return NextResponse.json({ message: 'PO를 찾을 수 없습니다' }, { status: 404 })

    await prisma.purchaseOrder.delete({ where: { id } })

    await createAuditLog({
      table: 'PurchaseOrder',
      recordId: id,
      action: 'DELETE',
      before: po as any,
      userId: dbUser.id,
    })

    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    return NextResponse.json({ message: error.message || '삭제 실패' }, { status: 500 })
  }
}

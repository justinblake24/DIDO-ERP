// app/api/purchase-orders/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generatePONumber, isImportVendor } from '@/lib/po-number-generator'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = Number(searchParams.get('page') || 1)
    const pageSize = 20

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { name: true, country: true, currency: true } },
          items: { select: { productName: true, totalAmount: true, currency: true } },
          _count: { select: { items: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    return NextResponse.json({ pos, total, page, pageSize })
  } catch (error) {
    return NextResponse.json({ message: 'PO 조회 실패' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ message: '인증이 필요합니다' }, { status: 401 })

    const dbUser = await prisma.user.findUnique({ where: { email: authUser.email || '' } })
    if (!dbUser) return NextResponse.json({ message: '사용자를 찾을 수 없습니다' }, { status: 404 })

    if (!['OPERATOR', 'MANAGER', 'ADMIN'].includes(dbUser.role)) {
      return NextResponse.json({ message: '권한이 없습니다' }, { status: 403 })
    }

    const body = await req.json()
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId } })
    if (!vendor) return NextResponse.json({ message: '발주처를 찾을 수 없습니다' }, { status: 404 })

    const isImport = isImportVendor(vendor.country)
    const issueDate = new Date(body.issueDate)
    const poNumber = await generatePONumber(isImport, issueDate)

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        issueDate,
        vendorId: body.vendorId,
        remarks: body.remarks,
        createdById: dbUser.id,
        items: {
          create: body.items.map((item: any, idx: number) => ({
            productName: item.productName,
            specification: item.specification,
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
      recordId: po.id,
      action: 'CREATE',
      after: { poNumber: po.poNumber, status: po.status },
      userId: dbUser.id,
    })

    return NextResponse.json(po, { status: 201 })
  } catch (error: any) {
    console.error('PO 생성 에러:', error)
    return NextResponse.json({ message: error.message || 'PO 생성 실패' }, { status: 500 })
  }
}

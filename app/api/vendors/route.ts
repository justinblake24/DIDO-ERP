// app/api/vendors/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, country: true, currency: true },
    })
    return NextResponse.json(vendors)
  } catch (error) {
    return NextResponse.json({ message: '발주처 조회 실패' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const vendor = await prisma.vendor.create({
      data: {
        name: body.name,
        country: body.country,
        currency: body.currency,
        contact: body.contact,
        email: body.email,
        memo: body.memo,
      },
    })
    return NextResponse.json(vendor, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ message: '이미 존재하는 발주처입니다' }, { status: 409 })
    }
    return NextResponse.json({ message: '발주처 생성 실패' }, { status: 500 })
  }
}

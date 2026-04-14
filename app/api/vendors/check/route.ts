// app/api/vendors/check/route.ts
// 엑셀에서 추출한 발주처명 중 DB에 없는 것 탐지
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { vendorNames }: { vendorNames: string[] } = await req.json()
    if (!vendorNames?.length) return NextResponse.json({ missing: [] })

    const unique = [...new Set(vendorNames.filter(Boolean))]

    const existing = await prisma.vendor.findMany({
      where: { name: { in: unique } },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((v) => v.name))
    const missing = unique.filter((n) => !existingNames.has(n))

    return NextResponse.json({ missing })
  } catch {
    return NextResponse.json({ message: '발주처 확인 실패' }, { status: 500 })
  }
}

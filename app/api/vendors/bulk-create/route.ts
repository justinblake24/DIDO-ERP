// app/api/vendors/bulk-create/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface VendorInput {
  name: string
  country: string
  currency: string
}

export async function POST(req: Request) {
  try {
    const { vendors }: { vendors: VendorInput[] } = await req.json()
    if (!vendors?.length) return NextResponse.json({ created: 0 })

    const results = await Promise.allSettled(
      vendors.map((v) =>
        prisma.vendor.create({
          data: { name: v.name, country: v.country, currency: v.currency },
        })
      )
    )

    const created = results.filter((r) => r.status === 'fulfilled').length
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r, i) => vendors[i].name)

    return NextResponse.json({ created, failed })
  } catch {
    return NextResponse.json({ message: '발주처 일괄 생성 실패' }, { status: 500 })
  }
}

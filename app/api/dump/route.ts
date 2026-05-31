import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tcs = await prisma.tradeCase.findMany({
    include: { documents: true },
    orderBy: { createdAt: 'desc' },
    take: 3
  })
  return NextResponse.json(tcs)
}

// app/(app)/purchase-orders/[id]/edit/page.tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import POEditForm from './POEditForm'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { poNumber: true } })
  return { title: `수정: ${po?.poNumber || 'PO'}` }
}

export default async function POEditPage({ params }: Props) {
  const { id } = await params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!po) notFound()

  const vendors = await prisma.vendor.findMany({ where: { active: true }, orderBy: { name: 'asc' } })

  // Prisma Decimal → 일반 숫자로 직렬화 (Client Component 전달용)
  const serializedPo = JSON.parse(JSON.stringify(po))

  return <POEditForm po={serializedPo} vendors={vendors} />
}

// app/(app)/layout.tsx
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/shared/AppShell'
import Header from '@/components/shared/Header'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  // DB에서 사용자 정보 조회
  let dbUser = await prisma.user.findUnique({
    where: { email: authUser.email || '' },
    select: { name: true, email: true, role: true },
  })

  // DB에 없으면 생성 (첫 로그인)
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        role: 'VIEWER',
      },
      select: { name: true, email: true, role: true },
    })
  }

  return (
    <AppShell header={<Header user={dbUser} />}>
      {children}
    </AppShell>
  )
}

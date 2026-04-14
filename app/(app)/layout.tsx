// app/(app)/layout.tsx
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/shared/Sidebar'
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header user={dbUser} />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '32px 24px',
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}

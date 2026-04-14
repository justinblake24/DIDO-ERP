// app/(app)/settings/page.tsx
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users, Database, Bell, Shield, Palette, Globe,
  ChevronRight, Server, Lock
} from 'lucide-react'

export const metadata: Metadata = { title: '시스템 설정' }

const settingsSections = [
  {
    icon: Users,
    title: '사용자 관리',
    desc: '사용자 계정 생성, 역할 및 권한 관리',
    href: '/settings/users',
    color: 'var(--status-issued)',
    bg: 'rgba(59,130,246,0.12)',
  },
  {
    icon: Bell,
    title: '알림 설정',
    desc: '이메일, 시스템 알림 수신 기준 설정',
    href: '#',
    color: 'var(--accent)',
    bg: 'var(--accent-dim)',
    badge: '준비 중',
  },
  {
    icon: Globe,
    title: '언어 및 지역',
    desc: '표시 언어, 날짜·통화 형식 설정',
    href: '#',
    color: 'var(--status-completed)',
    bg: 'rgba(16,185,129,0.12)',
    badge: '준비 중',
  },
  {
    icon: Database,
    title: '데이터 관리',
    desc: '데이터 내보내기, 백업 및 복원',
    href: '#',
    color: 'var(--status-paid)',
    bg: 'rgba(168,85,247,0.12)',
    badge: '준비 중',
  },
  {
    icon: Lock,
    title: '보안 설정',
    desc: '비밀번호 정책, 세션 만료 시간 설정',
    href: '#',
    color: 'var(--status-cancelled)',
    bg: 'rgba(239,68,68,0.12)',
    badge: '준비 중',
  },
  {
    icon: Palette,
    title: '디자인 테마',
    desc: '다크/라이트 모드, UI 밀도 설정',
    href: '#',
    color: 'var(--status-shipped)',
    bg: 'rgba(6,182,212,0.12)',
    badge: '준비 중',
  },
]

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email || '' },
    select: { name: true, email: true, role: true, createdAt: true },
  })

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        시스템 설정
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        DIDO ERP 시스템 환경 설정을 관리합니다
      </p>

      {/* 내 계정 정보 */}
      <div className="glass-card p-5 mb-6" style={{ borderColor: 'rgba(255,192,0,0.2)', background: 'rgba(255,192,0,0.03)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-black text-lg font-bold flex-shrink-0"
            style={{ background: 'var(--accent)' }}>
            {dbUser?.name?.charAt(0) ?? 'U'}
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {dbUser?.name ?? '-'}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{dbUser?.email}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                <Shield className="w-3 h-3" />
                {{ ADMIN: '관리자', MANAGER: '매니저', OPERATOR: '운영자', VIEWER: '조회자' }[dbUser?.role ?? ''] ?? dbUser?.role}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                가입일: {dbUser?.createdAt ? new Date(dbUser.createdAt).toLocaleDateString('ko-KR') : '-'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" style={{ color: 'var(--status-completed)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--status-completed)' }}>정상 운영 중</span>
          </div>
        </div>
      </div>

      {/* 설정 항목 */}
      <div className="space-y-3">
        {settingsSections.map((s) => {
          const Icon = s.icon
          const isDisabled = s.href === '#'
          return (
            <div key={s.title}>
              {isDisabled ? (
                <div className="glass-card p-4 flex items-center gap-4" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: s.bg }}>
                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
                      {s.badge && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-card)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                </div>
              ) : (
                <Link href={s.href} style={{ textDecoration: 'none' }}>
                  <div className="glass-card p-4 flex items-center gap-4 cursor-pointer transition-all"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: s.bg }}>
                      <Icon className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                  </div>
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* 버전 정보 */}
      <div className="mt-8 text-center">
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          DIDO ERP v1.0.0 · Next.js 16 · Prisma 7 · Supabase
        </p>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Upload, Building2,
  ClipboardList, BarChart3, Shield, Settings,
  Users, Zap, LogOut, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: '대시보드' },
  { href: '/purchase-orders', icon: FileText, label: 'P/O 발행대장' },
  { href: '/purchase-orders/import', icon: Upload, label: '엑셀 Import' },
  { href: '/vendors', icon: Building2, label: '발주처 관리' },
  { href: '/invoices', icon: ClipboardList, label: '청구 관리' },
  { href: '/reports', icon: BarChart3, label: '리포트' },
  { href: '/audit', icon: Shield, label: '감사 로그' },
]

const settingsItems = [
  { href: '/settings/users', icon: Users, label: '사용자 관리' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="sidebar w-60 min-h-screen flex flex-col" style={{ padding: '20px 12px' }}>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-2 mb-8" style={{ textDecoration: 'none' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent)' }}>
          <Zap className="w-4 h-4 text-black" />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            DIDO ERP
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            발행관리 시스템
          </div>
        </div>
      </Link>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1">
        <div className="text-xs font-semibold px-2 mb-2 uppercase tracking-wider"
          style={{ color: 'var(--text-subtle)' }}>
          메뉴
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${active ? 'active' : ''}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 opacity-60" />}
              </div>
            </Link>
          )
        })}

        {/* Settings */}
        <div className="text-xs font-semibold px-2 mt-6 mb-2 uppercase tracking-wider"
          style={{ color: 'var(--text-subtle)' }}>
          설정
        </div>
        {settingsItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <div className={`sidebar-item ${active ? 'active' : ''}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-sm">{item.label}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full"
          style={{ color: 'var(--text-subtle)' }}
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">로그아웃</span>
        </button>
      </div>
    </aside>
  )
}

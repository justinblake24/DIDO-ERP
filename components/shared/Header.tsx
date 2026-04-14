'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Search, Sun, Moon, User, Settings, LogOut, Shield, ChevronDown, Check } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface HeaderProps {
  user?: { name: string; email: string; role: string }
}

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'info',    message: 'NH-DH251202001 발주가 승인되었습니다', time: '5분 전',  read: false },
  { id: 2, type: 'warning', message: '3건의 발주가 청구 마감 임박입니다',    time: '1시간 전', read: false },
  { id: 3, type: 'success', message: '엑셀 Import가 완료되었습니다 (12건)', time: '2시간 전', read: true  },
  { id: 4, type: 'info',    message: '신규 발주처 "ABC Trading" 등록됨',    time: '어제',    read: true  },
]

export default function Header({ user }: HeaderProps) {
  const [time, setTime] = useState(new Date())
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const supabase = createClient()

  const [notifOpen, setNotifOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)

  const notifRef   = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))   setNotifOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleLabel: Record<string, string> = {
    ADMIN: '관리자', MANAGER: '매니저', OPERATOR: '운영자', VIEWER: '조회자',
  }
  const roleColor: Record<string, string> = {
    ADMIN: 'var(--accent)', MANAGER: 'var(--status-issued)',
    OPERATOR: 'var(--status-completed)', VIEWER: 'var(--text-subtle)',
  }
  const notifColor: Record<string, string> = {
    info: 'var(--status-issued)', warning: '#f59e0b',
    success: 'var(--status-completed)', error: 'var(--status-cancelled)',
  }

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      backdropFilter: 'blur(20px)',
      padding: '0 24px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      transition: 'background 0.3s ease',
    }}>
      {/* Search - 데스크탑만 */}
      <div className="hidden md:flex flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--text-subtle)' }} />
        <input
          type="text"
          placeholder="발주번호, 발주처 검색..."
          className="erp-input"
          style={{ height: '36px', fontSize: '13px', paddingTop: '0', paddingBottom: '0', paddingLeft: '2.2rem' }}
          aria-label="전역 검색"
        />
      </div>

      <div className="flex-1" />

      {/* Realtime indicator - 데스크탑만 */}
      <div className="hidden md:flex items-center gap-2">
        <div className="pulse-dot" />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>실시간 동기화</span>
      </div>

      {/* Time - 데스크탑만 */}
      <div className="hidden md:block text-xs mono" style={{ color: 'var(--text-subtle)' }} suppressHydrationWarning>
        {time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      {/* Theme Toggle */}
      <button onClick={toggleTheme}
        aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        className="p-2 rounded-lg transition-all duration-200"
        style={{ color: theme === 'dark' ? 'var(--accent)' : 'var(--text-muted)', background: 'var(--accent-dim)' }}>
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* ===== 알림 ===== */}
      <div className="relative" ref={notifRef}>
        <button
          aria-label="알림"
          onClick={() => { setNotifOpen((o) => !o); setProfileOpen(false) }}
          className="relative p-2 rounded-lg transition-all duration-200"
          style={{
            color: notifOpen ? 'var(--accent)' : 'var(--text-muted)',
            background: notifOpen ? 'var(--accent-dim)' : 'transparent',
          }}>
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-black"
              style={{ background: 'var(--accent)', fontSize: '9px', fontWeight: 700 }}>
              {unreadCount}
            </span>
          )}
        </button>

        {/* 알림 드롭다운 */}
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              width: '340px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(20px)',
              zIndex: 100,
            }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>알림</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-black mono"
                    style={{ background: 'var(--accent)', fontSize: '10px', fontWeight: 700 }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs transition-colors"
                  style={{ color: 'var(--accent)' }}>
                  모두 읽음
                </button>
              )}
            </div>

            {/* 알림 목록 */}
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {notifications.map((n) => (
                <div key={n.id}
                  className="flex items-start gap-3 px-4 py-3 transition-all cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'var(--accent-dim)',
                    opacity: n.read ? 0.75 : 1,
                  }}
                  onClick={() => setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item))}>
                  {/* 타입 점 */}
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: notifColor[n.type] || 'var(--text-subtle)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {n.message}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{n.time}</p>
                  </div>
                  {n.read && <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-subtle)' }} />}
                </div>
              ))}
            </div>

            {/* 푸터 */}
            <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <Link href="/audit" onClick={() => setNotifOpen(false)}
                className="text-xs transition-colors" style={{ color: 'var(--accent)' }}>
                전체 활동 로그 보기 →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ===== 프로필 ===== */}
      {user && (
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false) }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200"
            style={{
              background: profileOpen ? 'var(--bg-card)' : 'transparent',
              border: `1px solid ${profileOpen ? 'var(--border)' : 'transparent'}`,
            }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-black text-sm font-bold"
              style={{ background: 'var(--accent)' }}>
              {user.name.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                {user.name}
              </div>
              <div className="text-xs leading-tight" style={{ color: roleColor[user.role] || 'var(--text-subtle)' }}>
                {roleLabel[user.role] || user.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 hidden md:block transition-transform"
              style={{ color: 'var(--text-subtle)', transform: profileOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {/* 프로필 드롭다운 */}
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 rounded-2xl shadow-2xl overflow-hidden"
              style={{
                width: '240px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(20px)',
                zIndex: 100,
              }}>
              {/* 유저 정보 */}
              <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold"
                    style={{ background: 'var(--accent)', fontSize: '16px' }}>
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {user.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{user.email}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {roleLabel[user.role] || user.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* 메뉴 */}
              <div className="py-1.5">
                <Link href="/settings/users" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 transition-all"
                  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <User className="w-4 h-4" />
                  <span className="text-sm">사용자 관리</span>
                </Link>
                <Link href="/settings" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 transition-all"
                  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">시스템 설정</span>
                </Link>
                {user.role === 'ADMIN' && (
                  <Link href="/audit" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 transition-all"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">감사 로그</span>
                  </Link>
                )}
              </div>

              {/* 로그아웃 */}
              <div className="py-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 transition-all"
                  style={{ color: 'var(--status-cancelled)', background: 'transparent' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">로그아웃</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

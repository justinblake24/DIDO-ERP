'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Menu, X } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
  header: React.ReactNode
}

export default function AppShell({ children, header }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 화면 크기 변경 시 데스크탑이면 사이드바 닫기
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // 사이드바 열릴 때 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ===== 데스크탑 사이드바 ===== */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ===== 모바일 오버레이 ===== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== 모바일 드로어 사이드바 ===== */}
      <div
        className="fixed top-0 left-0 h-full z-50 md:hidden transition-transform duration-300"
        style={{
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: '240px',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* ===== 메인 영역 ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* 모바일 햄버거 버튼을 헤더에 주입 */}
        <div className="flex items-center">
          <button
            className="md:hidden p-4 flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="메뉴 열기"
            style={{ color: 'var(--text-primary)' }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            {header}
          </div>
        </div>

        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: 'clamp(16px, 4vw, 32px) clamp(12px, 4vw, 24px)',
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

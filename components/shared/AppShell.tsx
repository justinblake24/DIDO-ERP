'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import { Menu, X, Monitor } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
  header: React.ReactNode
}

export default function AppShell({ children, header }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  // ===== 모바일 차단 화면 =====
  if (isMobile) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: '24px',
        textAlign: 'center',
      }}>
        {/* 아이콘 */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'var(--accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <Monitor style={{ width: '32px', height: '32px', color: 'var(--accent)' }} />
        </div>

        {/* 로고 */}
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          DIDO ERP
        </div>

        {/* 안내 메시지 */}
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          데스크탑에서 이용해주세요
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', maxWidth: '280px' }}>
          DIDO ERP는 PC 환경에 최적화되어 있습니다.<br />
          태블릿 또는 데스크탑 브라우저로 접속해주세요.
        </div>

        {/* 구분선 */}
        <div style={{
          width: '40px',
          height: '2px',
          background: 'var(--accent)',
          margin: '24px auto',
          borderRadius: '2px',
        }} />

        <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
          권장 해상도: 1280px 이상
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {header}
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

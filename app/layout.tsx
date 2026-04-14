// app/layout.tsx
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import ThemeProvider from '@/components/shared/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DIDO ERP | P/O 발행관리 시스템',
    template: '%s | DIDO ERP',
  },
  description: '수입/수출 거래 P/O 발행관리 웹 ERP — 에듀윌',
  keywords: ['ERP', 'P/O', '발주', '수입', '수출', '에듀윌'],
  robots: 'noindex, nofollow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                backdropFilter: 'blur(20px)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}


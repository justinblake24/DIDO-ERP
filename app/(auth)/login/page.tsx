'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { Mail, Lock, ArrowRight, Zap, Eye, EyeOff, ArrowLeft } from 'lucide-react'

type View = 'login' | 'forgot' | 'forgot-sent'

export default function LoginPage() {
  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  /* 로그인 */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('이메일 또는 비밀번호가 올바르지 않습니다.')
    } else {
      window.location.href = '/'
    }
    setLoading(false)
  }

  /* 비밀번호 재설정 메일 발송 */
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setView('forgot-sent')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      {/* 배경 글로우 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #4ADE80 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #4ADE80 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">

        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                DIDO ERP
              </div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                P/O 발행관리 시스템
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {view === 'login' && '안녕하세요 👋'}
            {view === 'forgot' && '비밀번호 찾기'}
            {view === 'forgot-sent' && '이메일을 확인하세요'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {view === 'login' && '계정 정보를 입력해 로그인하세요'}
            {view === 'forgot' && '가입한 이메일 주소를 입력하세요'}
            {view === 'forgot-sent' && `${email}로 재설정 링크를 전송했습니다`}
          </p>
        </div>

        {/* 카드 */}
        <div className="glass-card p-8">

          {/* ─── 로그인 뷰 ─── */}
          {view === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="space-y-4">

                {/* 이메일 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: 'var(--text-subtle)' }} />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@eduwill.net"
                      required
                      className="erp-input"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                  </div>
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    비밀번호
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: 'var(--text-subtle)' }} />
                    <input
                      id="login-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="erp-input"
                      style={{ paddingLeft: '2.4rem', paddingRight: '2.8rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-subtle)' }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 비밀번호 찾기 링크 */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs transition-colors"
                    style={{ color: 'var(--accent)' }}>
                    비밀번호를 잊으셨나요?
                  </button>
                </div>

                {/* 로그인 버튼 */}
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full flex items-center justify-center gap-2"
                  style={{ padding: '12px 16px', marginTop: '4px' }}>
                  {loading
                    ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : <><span>로그인</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* ─── 비밀번호 찾기 뷰 ─── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    가입 이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: 'var(--text-subtle)' }} />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@eduwill.net"
                      required
                      className="erp-input"
                      style={{ paddingLeft: '2.4rem' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold w-full flex items-center justify-center gap-2"
                  style={{ padding: '12px 16px' }}>
                  {loading
                    ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : <><span>재설정 링크 전송</span><ArrowRight className="w-4 h-4" /></>}
                </button>

                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="w-full flex items-center justify-center gap-1 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  로그인으로 돌아가기
                </button>
              </div>
            </form>
          )}

          {/* ─── 전송 완료 뷰 ─── */}
          {view === 'forgot-sent' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✉️</div>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                이메일의 링크를 클릭하면<br />새 비밀번호를 설정할 수 있어요.
              </p>
              <button
                onClick={() => { setView('login'); setEmail(''); }}
                className="flex items-center gap-1 mx-auto text-sm transition-colors"
                style={{ color: 'var(--accent)' }}>
                <ArrowLeft className="w-3.5 h-3.5" />
                로그인으로 돌아가기
              </button>
            </div>
          )}

          {/* 하단 안내 */}
          {view === 'login' && (
            <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                계정이 없으신가요?{' '}
                <span style={{ color: 'var(--accent)' }}>관리자에게 문의하세요</span>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-subtle)' }}>
          © 2026 DIDO. 내부 전용 시스템
        </p>
      </div>
    </div>
  )
}

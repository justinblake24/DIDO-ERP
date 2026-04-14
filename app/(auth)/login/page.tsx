'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { Mail, Lock, ArrowRight, Zap } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
      toast.success('매직 링크를 전송했습니다! 이메일을 확인해주세요.')
    }
    setLoading(false)
  }

  async function handlePassword(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FFC000 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
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
            안녕하세요 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            에듀윌 계정으로 로그인하세요
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {sent ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-4">✉️</div>
              <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                이메일을 확인하세요
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                <span className="font-mono" style={{ color: 'var(--accent)' }}>{email}</span>으로<br />
                매직 링크를 전송했습니다
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-sm underline"
                style={{ color: 'var(--text-muted)' }}
              >
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* Mode Toggle */}
              <div className="flex rounded-xl p-1 mb-6"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                {(['magic', 'password'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                      background: mode === m ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {m === 'magic' ? '🪄 매직 링크' : '🔑 비밀번호'}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === 'magic' ? handleMagicLink : handlePassword}>
                <div className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium mb-2"
                      style={{ color: 'var(--text-muted)' }}>
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
                        className="erp-input pl-10"
                      />
                    </div>
                  </div>

                  {/* Password (only in password mode) */}
                  {mode === 'password' && (
                    <div>
                      <label className="block text-xs font-medium mb-2"
                        style={{ color: 'var(--text-muted)' }}>
                        비밀번호
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--text-subtle)' }} />
                        <input
                          id="login-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="erp-input pl-10"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    id="login-submit"
                    type="submit"
                    disabled={loading}
                    className="btn-gold w-full flex items-center justify-center gap-2 mt-2"
                    style={{ padding: '12px 16px' }}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        {mode === 'magic' ? '매직 링크 전송' : '로그인'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-6 text-center"
                style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  계정이 없으신가요?{' '}
                  <span style={{ color: 'var(--accent)' }}>관리자에게 문의하세요</span>
                </p>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-subtle)' }}>
          © 2026 Eduwill. 내부 전용 시스템
        </p>
      </div>
    </div>
  )
}

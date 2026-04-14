#!/usr/bin/env node
// scripts/setup-env.mjs
// 실행: node scripts/setup-env.mjs

import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve))
}

console.log('\n🚀 Edu-ERP Lite — 환경변수 설정\n')
console.log('━'.repeat(50))

async function main() {
  const pw = await ask('📌 Supabase DB 비밀번호 입력: ')

  const encoded = encodeURIComponent(pw)

  const content = `NEXT_PUBLIC_SUPABASE_URL=https://clkvyahdbchumvxocukx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_LBo05g8plbJTe6KOzdqyTw_9utkswi7

# Transaction Pooler (앱 실행용, 포트 6543)
DATABASE_URL=postgresql://postgres.clkvyahdbchumvxocukx:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct Connection (마이그레이션/시드용, 포트 5432)
DIRECT_URL=postgresql://postgres.clkvyahdbchumvxocukx:${encoded}@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres

# Gemini AI (선택사항)
GEMINI_API_KEY=
`

  fs.writeFileSync(envPath, content)
  console.log('\n✅ .env.local 저장 완료!')
  console.log(`📍 저장 위치: ${envPath}`)
  console.log('\n다음 명령어 실행:')
  console.log('  npm run db:push  → DB 스키마 적용')
  console.log('  npm run db:seed  → 시드 데이터 삽입')
  console.log('  npm run dev      → 서버 시작\n')

  rl.close()
}

main().catch(console.error)

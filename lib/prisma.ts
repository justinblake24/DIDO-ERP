// lib/prisma.ts
// Prisma 7은 engine type "client"를 사용 → adapter 필수!
// DATABASE_URL (pgBouncer 트랜잭션 모드, 포트 6543) + max:1 로 커넥션 풀 제한
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // ✅ pgBouncer 트랜잭션 모드 (포트 6543)
    max: 1, // 서버리스: 인스턴스당 최대 1개 커넥션
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

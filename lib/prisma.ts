// lib/prisma.ts
// Vercel 서버리스 환경을 위한 Prisma 싱글톤 설정
// DATABASE_URL (pgBouncer 트랜잭션 모드, 포트 6543) 사용 → 커넥션 풀 효율적 관리
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        // DIRECT_URL은 마이그레이션 전용, 앱 실행은 항상 pgBouncer URL 사용
        url: process.env.DATABASE_URL,
      },
    },
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 개발 환경에서만 싱글톤 유지 (프로덕션은 각 요청마다 새 인스턴스)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

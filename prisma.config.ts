// prisma.config.ts
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // DATABASE_URL = pgBouncer 트랜잭션 모드 (포트 6543) → 서버리스 필수
    // DIRECT_URL   = 세션 모드 (포트 5432) → 마이그레이션 전용
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
    directUrl: process.env.DIRECT_URL,
  },
})

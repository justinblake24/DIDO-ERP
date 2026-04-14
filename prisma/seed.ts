// prisma/seed.ts
import { PrismaClient, POStatus, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

const SEED_VENDORS = [
  { name: "사브와 프로페셔널",      country: "KR", currency: "KRW" },
  { name: "맑은농산",               country: "KR", currency: "KRW" },
  { name: "모아트랩파트너스",       country: "KR", currency: "KRW" },
  { name: "미스티",                 country: "KR", currency: "KRW" },
  { name: "㈜피치코리아",           country: "KR", currency: "KRW" },
  { name: "㈜대시앤도트",           country: "KR", currency: "KRW" },
  { name: "YIWU PULA FOOD CO.,LTD", country: "CN", currency: "USD" },
  { name: "YIWU MITANG FOOD CO.,LTD", country: "CN", currency: "USD" },
  { name: "Guangdong Province Jiacai Food Co., Ltd", country: "CN", currency: "USD" },
]

const SEED_USERS = [
  { email: "justin@eduwill.net",   name: "Justin",   role: UserRole.ADMIN    },
  { email: "sehee@eduwill.net",    name: "김세희",    role: UserRole.MANAGER  },
  { email: "jinkyung@eduwill.net", name: "김진경",    role: UserRole.OPERATOR },
  { email: "hyejin@eduwill.net",   name: "정혜진",    role: UserRole.OPERATOR },
  { email: "viewer@eduwill.net",   name: "대표",      role: UserRole.VIEWER   },
]

const SEED_POS = [
  {
    poNumber: "DHPO-251017-056",
    issueDate: "2025-10-17",
    vendor: "사브와 프로페셔널",
    status: POStatus.COMPLETED,
    items: [
      { name: "사브와 헤어텍스쳐라이저", qty: 4807, unit: "EA", price: 6900, currency: "KRW" },
      { name: "사브와 헤어엘릭서",       qty: 5000, unit: "EA", price: 8720, currency: "KRW" },
      { name: "사브와 애니메이터",       qty: 4736, unit: "EA", price: 6870, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-260213-004",
    issueDate: "2026-02-13",
    vendor: "맑은농산",
    status: POStatus.INVOICED,
    items: [
      { name: "두바이 쫀득 쿠키 (556 Cartons, 144ea/CTN)", qty: 80064, unit: "EA", price: 1300, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-251224-071",
    issueDate: "2025-12-24",
    vendor: "모아트랩파트너스",
    status: POStatus.SHIPPED,
    items: [
      { name: "모아트랩 백스테이지 약산성 포밍 오일 클렌저", qty: 3025, unit: "EA", price: 3800, currency: "KRW" },
      { name: "모아트랩 백스테이지 시카세라 프라이밍 모이스처 크림", qty: 3008, unit: "EA", price: 7000, currency: "KRW" },
      { name: "모아트랩 백스테이지 시카세라 프라이밍 에센스", qty: 3042, unit: "EA", price: 7000, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-251224-072",
    issueDate: "2025-12-24",
    vendor: "모아트랩파트너스",
    status: POStatus.PAID,
    items: [
      { name: "모아트랩 백스테이지 약산성 포밍 오일 클렌저", qty: 1540, unit: "EA", price: 4180, currency: "KRW" },
      { name: "모아트랩 백스테이지 시카세라 프라이밍 모이스처 크림", qty: 1472, unit: "EA", price: 7700, currency: "KRW" },
      { name: "모아트랩 백스테이지 시카세라 프라이밍 에센스", qty: 1482, unit: "EA", price: 7700, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-260309-006",
    issueDate: "2026-03-09",
    vendor: "미스티",
    status: POStatus.SHIPPED,
    items: [
      { name: "꾸덕젤리 블루베리맛 (278 Cartons, 72ea/CTN)", qty: 20016, unit: "EA", price: 1545, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-251113-061",
    issueDate: "2025-11-13",
    vendor: "맑은농산",
    status: POStatus.COMPLETED,
    items: [
      { name: "설빙 초코 스모어",            qty: 16800, unit: "EA", price: 620, currency: "KRW" },
      { name: "설빙 초코스모어 (위생허가용)", qty: 60,    unit: "EA", price: 620, currency: "KRW" },
      { name: "설빙 딸기스모어 (위생허가용)", qty: 60,    unit: "EA", price: 620, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-260309-007",
    issueDate: "2026-03-09",
    vendor: "㈜피치코리아",
    status: POStatus.PAID,
    items: [
      { name: "수박모양 미니젤리 (18 Carton, 120ea/CTN)",   qty: 2160, unit: "EA", price: 910, currency: "KRW" },
      { name: "블루베리모양 미니젤리 (5 Carton, 120ea/CTN)", qty: 600,  unit: "EA", price: 910, currency: "KRW" },
      { name: "애플망고모양 미니젤리 (4 Carton, 120ea/CTN)", qty: 480,  unit: "EA", price: 910, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-251128-064",
    issueDate: "2025-11-28",
    vendor: "㈜대시앤도트",
    status: POStatus.INVOICED,
    items: [
      { name: "뽀작뽀작 극한일상 리무버 씰 (안!건강해)",  qty: 500, unit: "EA", price: 920, currency: "KRW" },
      { name: "뽀작뽀작 감정기복 리무버 씰 (불타오르네)", qty: 500, unit: "EA", price: 960, currency: "KRW" },
      { name: "뽀작뽀작 감정기복 리무버 씰 (눈누난나)",   qty: 500, unit: "EA", price: 960, currency: "KRW" },
    ],
  },
  {
    poNumber: "DHPO-(I)251210M-066",
    issueDate: "2025-12-10",
    vendor: "Guangdong Province Jiacai Food Co., Ltd",
    status: POStatus.ISSUED,
    items: [
      { name: "BongBong Tears Of Strawberry", qty: 88992, unit: "EA", price: 0.45, currency: "USD" },
      { name: "BongBong Tears Of La France",  qty: 71280, unit: "EA", price: 0.45, currency: "USD" },
      { name: "BongBong Tears Of Grape",      qty: 86736, unit: "EA", price: 0.45, currency: "USD" },
    ],
  },
  {
    poNumber: "DHPO-(I)251222M-067",
    issueDate: "2025-12-22",
    vendor: "Guangdong Province Jiacai Food Co., Ltd",
    status: POStatus.COMPLETED,
    items: [
      { name: "Shinako BongBong 2 (Grape & Strawberry)",       qty: 51024, unit: "EA", price: 0.97, currency: "USD" },
      { name: "Shinako BongBong 2 (Shine Muscat & Pineapple)", qty: 56592, unit: "EA", price: 0.97, currency: "USD" },
    ],
  },
  {
    poNumber: "DHPO-(I)251222M-069",
    issueDate: "2025-12-22",
    vendor: "YIWU PULA FOOD CO.,LTD",
    status: POStatus.COMPLETED,
    items: [
      { name: "BongBong Tears Of Strawberry", qty: 20016, unit: "EA", price: 0.45, currency: "USD" },
      { name: "BongBong Tears Of La France",  qty: 24768, unit: "EA", price: 0.45, currency: "USD" },
      { name: "BongBong Tears Of Grape",      qty: 34992, unit: "EA", price: 0.45, currency: "USD" },
    ],
  },
  {
    poNumber: "DHPO-(I)260114M-002",
    issueDate: "2026-01-14",
    vendor: "YIWU PULA FOOD CO.,LTD",
    status: POStatus.COMPLETED,
    items: [
      { name: "BongBong Tears Of Peach", qty: 24000, unit: "Bags", price: 0.45, currency: "USD" },
    ],
  },
]

async function main() {
  console.log('🌱 Seeding database...')

  // 사용자 생성
  const adminUser = await prisma.user.upsert({
    where: { email: 'justin@eduwill.net' },
    update: {},
    create: { email: 'justin@eduwill.net', name: 'Justin', role: 'ADMIN' },
  })

  for (const u of SEED_USERS.slice(1)) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role },
    })
  }
  console.log(`✅ ${SEED_USERS.length}명 사용자 생성 완료`)

  // 발주처 생성
  const vendorMap: Record<string, string> = {}
  for (const v of SEED_VENDORS) {
    const vendor = await prisma.vendor.upsert({
      where: { name: v.name },
      update: {},
      create: { name: v.name, country: v.country, currency: v.currency },
    })
    vendorMap[v.name] = vendor.id
  }
  console.log(`✅ ${SEED_VENDORS.length}개 발주처 생성 완료`)

  // PO 생성
  let poCount = 0
  for (const po of SEED_POS) {
    const vendorId = vendorMap[po.vendor]
    if (!vendorId) {
      console.warn(`⚠️ 발주처 없음: ${po.vendor}`)
      continue
    }

    const existingPO = await prisma.purchaseOrder.findUnique({
      where: { poNumber: po.poNumber },
    })
    if (existingPO) continue

    await prisma.purchaseOrder.create({
      data: {
        poNumber: po.poNumber,
        issueDate: new Date(po.issueDate),
        vendorId,
        status: po.status,
        createdById: adminUser.id,
        items: {
          create: po.items.map((item, idx) => ({
            productName: item.name,
            quantity: item.qty,
            unit: item.unit,
            unitPrice: item.price,
            currency: item.currency,
            totalAmount: item.qty * item.price,
            sortOrder: idx,
          })),
        },
      },
    })
    poCount++
  }

  console.log(`✅ ${poCount}개 PO 생성 완료`)
  console.log('🎉 시드 완료! 데모 준비 OK')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

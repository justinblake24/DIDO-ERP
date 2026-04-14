# Edu-ERP Lite

> **P/O 발행관리 웹 ERP** — 수입/수출 거래를 관리하는 소규모 기업용 웹 ERP

## 🚀 기술 스택

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 + Custom CSS Variables
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma 7
- **Auth**: Supabase Auth (Email + Magic Link)
- **AI**: Google Gemini API (이상치 탐지)
- **Charts**: Recharts
- **Excel**: ExcelJS (Import/Export)

## ⚡ 빠른 시작

### 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성
2. Project Settings → Database에서 Connection String 복사

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local`에 아래 값을 입력하세요:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=your-transaction-pooler-url
DIRECT_URL=your-direct-url
```

### 3. 의존성 설치 및 DB 설정

```bash
npm install
npm run db:generate     # Prisma 클라이언트 생성
npm run db:push         # DB 스키마 적용
npm run db:seed         # 시드 데이터 삽입 (12건 실제 PO)
```

### 4. 개발 서버 실행

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) 에서 확인

## 🔐 기본 계정

시드 후 아래 이메일로 Supabase Auth에서 사용자를 생성하세요:

| 이메일 | 역할 |
|--------|------|
| justin@eduwill.net | ADMIN |
| sehee@eduwill.net | MANAGER |
| jinkyung@eduwill.net | OPERATOR |
| hyejin@eduwill.net | OPERATOR |
| viewer@eduwill.net | VIEWER |

## 📄 주요 기능

### Phase 1 (현재)
- ✅ 인증 (Magic Link + 비밀번호)
- ✅ PO CRUD + 발주번호 자동생성
- ✅ 엑셀 Import (기존 양식 자동 파싱)
- ✅ 대시보드 + KPI 차트
- ✅ 상태 워크플로우 (DRAFT→ISSUED→PAID→SHIPPED→INVOICED→COMPLETED)
- ✅ 감사 로그 자동 기록

### Phase 2 (예정)
- 결제/청구/입금 모듈
- 한국은행 환율 API 연동
- Gemini AI 이상치 탐지
- 엑셀 Export

## 🗂️ 라우팅

```
/login                          로그인
/                               대시보드
/purchase-orders                P/O 발행대장
/purchase-orders/new            신규 PO 작성
/purchase-orders/[id]           PO 상세
/purchase-orders/[id]/edit      PO 수정
/purchase-orders/import         엑셀 Import
/vendors                        발주처 관리
/invoices                       청구 관리
/reports                        리포트
/audit                          감사 로그
/settings/users                 사용자 관리
```

## 🚀 Vercel 배포

```bash
npx vercel --prod
```

Vercel 환경변수에 `.env.local`과 동일한 값 설정 필요.

## 📊 발주번호 규칙

- **수입**: `DHPO-(I)YYMMDDM-XXX` (예: `DHPO-(I)260412M-009`)
- **국내**: `DHPO-YYMMDD-XXX®` (예: `DHPO-260412-010®`)
- `XXX`: 해당 연도 일련번호 (001부터, 매년 리셋)

---

© 2026 Eduwill. 내부 전용 시스템.

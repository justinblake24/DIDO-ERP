/**
 * app/api/trade-pipeline/analytics/route.ts
 *
 * 무역 파이프라인 경영 분석 API
 *  - 기간: monthly | quarterly | halfyear | yearly
 *  - 매출/원가/영업이익 모두 JPY 기준
 *  - KRW 병기: 입금 당월 평균 환율(FxRate.jpyKrw) 사용
 *  - 원가 통화 변환: KRW → JPY (÷ avgJpyKrw), USD → JPY (× usdJpy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─── 날짜 범위 계산 ─────────────────────────────────────────────────

function getDateRange(
  period: string,
  year: number,
  month: number
): { startDate: Date; endDate: Date } {
  if (period === 'monthly') {
    return {
      startDate: new Date(year, month - 1, 1),
      endDate: new Date(year, month, 0, 23, 59, 59, 999),
    }
  }
  if (period === 'quarterly') {
    const q = Math.ceil(month / 3)
    return {
      startDate: new Date(year, (q - 1) * 3, 1),
      endDate: new Date(year, q * 3, 0, 23, 59, 59, 999),
    }
  }
  if (period === 'halfyear') {
    const h = month <= 6 ? 0 : 1
    return {
      startDate: new Date(year, h * 6, 1),
      endDate: new Date(year, (h + 1) * 6, 0, 23, 59, 59, 999),
    }
  }
  // yearly
  return {
    startDate: new Date(year, 0, 1),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
  }
}

// ─── 해당 월의 FxRate 평균 계산 ────────────────────────────────────

async function getMonthAvgRates(
  year: number,
  month: number
): Promise<{ jpyKrw: number; usdKrw: number }> {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)

  const rates = await prisma.fxRate.findMany({
    where: { date: { gte: start, lte: end } },
    select: { jpyKrw: true, usdKrw: true },
  })

  if (rates.length === 0) {
    return { jpyKrw: 9.5, usdKrw: 1350 } // 폴백 값
  }

  return {
    jpyKrw: rates.reduce((s, r) => s + Number(r.jpyKrw), 0) / rates.length,
    usdKrw: rates.reduce((s, r) => s + Number(r.usdKrw), 0) / rates.length,
  }
}

// ─── 원가를 JPY로 변환 ──────────────────────────────────────────────

function convertCostToJPY(
  amount: number,
  currency: string,
  jpyKrw: number,
  usdKrw: number
): number {
  if (currency === 'JPY') return amount
  if (currency === 'KRW') return jpyKrw > 0 ? amount / jpyKrw : 0
  if (currency === 'USD') return jpyKrw > 0 && usdKrw > 0 ? (amount * usdKrw) / jpyKrw : 0
  return 0
}

// ─── 월별 트렌드 (12개월) ───────────────────────────────────────────

async function getMonthlyTrend(year: number) {
  const months = []

  for (let m = 1; m <= 12; m++) {
    const { startDate, endDate } = getDateRange('monthly', year, m)
    const avgRates = await getMonthAvgRates(year, m)

    const cases = await prisma.tradeCase.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        linkedInvoices: {
          include: { deposits: { select: { amountJPY: true, depositDate: true } } },
        },
        linkedPOs: {
          include: { items: { select: { totalAmount: true, currency: true } } },
        },
      },
    })

    let revenueJPY = 0
    let costJPY = 0
    let depositedJPY = 0

    for (const c of cases) {
      for (const inv of c.linkedInvoices) {
        revenueJPY += Number(inv.invoiceJPY ?? inv.totalJPY)
        for (const dep of inv.deposits) {
          depositedJPY += Number(dep.amountJPY)
        }
      }
      for (const po of c.linkedPOs) {
        // 일본 수주서(JP_PO, NH-DH 번호)는 매출 계산용이므로 원가 계산에서 제외
        if (po.poNumber.startsWith('NH-DH')) continue

        for (const item of po.items) {
          costJPY += convertCostToJPY(
            Number(item.totalAmount),
            item.currency,
            avgRates.jpyKrw,
            avgRates.usdKrw
          )
        }
      }
    }

    months.push({
      month: m,
      revenueJPY: Math.round(revenueJPY),
      costJPY: Math.round(costJPY),
      profitJPY: Math.round(revenueJPY - costJPY),
      depositedJPY: Math.round(depositedJPY),
      caseCount: cases.length,
      avgJpyKrw: avgRates.jpyKrw,
    })
  }

  return months
}

// ─── 메인 핸들러 ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'monthly'
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const { startDate, endDate } = getDateRange(period, year, month)

    // ── 해당 기간 케이스 전체 조회 ──────────────────────────────────
    const cases = await prisma.tradeCase.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        linkedInvoices: {
          include: {
            deposits: {
              select: {
                id: true,
                amountJPY: true,
                amountKRW: true,
                depositDate: true,
                fxRate: true,
              },
            },
          },
        },
        linkedPOs: {
          include: {
            items: {
              select: { totalAmount: true, currency: true, productName: true },
            },
            vendor: { select: { id: true, name: true, country: true } },
          },
        },
        shippingInfo: {
          select: { etd: true, eta: true, portOfLoading: true, portOfDischarge: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // ── 기간 평균 환율 ──────────────────────────────────────────────
    const periodRates = await prisma.fxRate.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { jpyKrw: true, usdKrw: true },
    })
    const periodAvgJpyKrw =
      periodRates.length > 0
        ? periodRates.reduce((s, r) => s + Number(r.jpyKrw), 0) / periodRates.length
        : 9.5
    const periodAvgUsdKrw =
      periodRates.length > 0
        ? periodRates.reduce((s, r) => s + Number(r.usdKrw), 0) / periodRates.length
        : 1350

    // ── 케이스별 집계 ───────────────────────────────────────────────
    const caseData = await Promise.all(
      cases.map(async (c) => {
        // 입금 날짜로 당월 평균 환율 결정
        const allDeposits = c.linkedInvoices.flatMap((inv) => inv.deposits)
        let avgJpyKrw = periodAvgJpyKrw
        let avgUsdKrw = periodAvgUsdKrw

        if (allDeposits.length > 0) {
          // 가장 최근 입금일 기준 월 환율
          const latestDeposit = allDeposits.sort(
            (a, b) => new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()
          )[0]
          const depDate = new Date(latestDeposit.depositDate)
          const monthRates = await getMonthAvgRates(
            depDate.getFullYear(),
            depDate.getMonth() + 1
          )
          avgJpyKrw = monthRates.jpyKrw
          avgUsdKrw = monthRates.usdKrw
        }

        // 매출 (판매가) — JPY
        const revenueJPY = c.linkedInvoices.reduce(
          (sum, inv) => sum + Number(inv.invoiceJPY ?? inv.totalJPY),
          0
        )

        // 실 입금액 — JPY & KRW
        const depositedJPY = allDeposits.reduce((s, d) => s + Number(d.amountJPY), 0)
        const depositedKRW = allDeposits.reduce((s, d) => s + Number(d.amountKRW), 0)

        // 원가 — JPY 환산
        let costJPY = 0
        const vendorCosts: Record<string, { name: string; country: string; costJPY: number }> = {}
        for (const po of c.linkedPOs) {
          // 일본 수주서(JP_PO, NH-DH 번호)는 매출 계산용이므로 원가 계산에서 제외
          if (po.poNumber.startsWith('NH-DH')) continue

          let poCostJPY = 0
          for (const item of po.items) {
            poCostJPY += convertCostToJPY(
              Number(item.totalAmount),
              item.currency,
              avgJpyKrw,
              avgUsdKrw
            )
          }
          costJPY += poCostJPY
          const vKey = po.vendor.id
          vendorCosts[vKey] = {
            name: po.vendor.name,
            country: po.vendor.country,
            costJPY: (vendorCosts[vKey]?.costJPY ?? 0) + poCostJPY,
          }
        }

        const profitJPY = revenueJPY - costJPY
        const profitKRW = Math.round(profitJPY * avgJpyKrw)
        const revenueKRW = Math.round(revenueJPY * avgJpyKrw)
        const costKRW = Math.round(costJPY * avgJpyKrw)
        const marginPct = revenueJPY > 0 ? (profitJPY / revenueJPY) * 100 : 0

        return {
          id: c.id,
          caseName: c.caseName,
          nhDhNumber: c.nhDhNumber,
          status: c.status,
          createdAt: c.createdAt,
          etd: c.shippingInfo?.etd ?? null,
          eta: c.shippingInfo?.eta ?? null,
          portOfLoading: c.shippingInfo?.portOfLoading ?? null,
          portOfDischarge: c.shippingInfo?.portOfDischarge ?? null,
          // JPY 기준 숫자
          revenueJPY: Math.round(revenueJPY),
          depositedJPY: Math.round(depositedJPY),
          costJPY: Math.round(costJPY),
          profitJPY: Math.round(profitJPY),
          // 당월 평균 환율로 환산한 KRW
          revenueKRW,
          depositedKRW: Math.round(depositedKRW),
          costKRW,
          profitKRW,
          marginPct: Math.round(marginPct * 10) / 10,
          isProfitable: profitJPY >= 0,
          avgJpyKrw: Math.round(avgJpyKrw * 100) / 100,
          vendors: Object.values(vendorCosts),
          invoiceCount: c.linkedInvoices.length,
          poCount: c.linkedPOs.length,
          depositCount: allDeposits.length,
        }
      })
    )

    // ── 전체 합계 ───────────────────────────────────────────────────
    const totals = {
      caseCount: caseData.length,
      completedCount: caseData.filter((c) => c.status === 'COMPLETED').length,
      revenueJPY: caseData.reduce((s, c) => s + c.revenueJPY, 0),
      depositedJPY: caseData.reduce((s, c) => s + c.depositedJPY, 0),
      costJPY: caseData.reduce((s, c) => s + c.costJPY, 0),
      profitJPY: 0,
      revenueKRW: caseData.reduce((s, c) => s + c.revenueKRW, 0),
      depositedKRW: caseData.reduce((s, c) => s + c.depositedKRW, 0),
      costKRW: caseData.reduce((s, c) => s + c.costKRW, 0),
      profitKRW: 0,
      marginPct: 0,
      avgJpyKrw: Math.round(periodAvgJpyKrw * 100) / 100,
    }
    totals.profitJPY = totals.revenueJPY - totals.costJPY
    totals.profitKRW = totals.revenueKRW - totals.costKRW
    totals.marginPct =
      totals.revenueJPY > 0
        ? Math.round((totals.profitJPY / totals.revenueJPY) * 1000) / 10
        : 0

    // ── 업체별 집계 ─────────────────────────────────────────────────
    const vendorMap = new Map<
      string,
      { name: string; country: string; caseCount: number; revenueJPY: number; costJPY: number }
    >()
    for (const c of caseData) {
      // 매출은 케이스 단위로 배분 (업체별 매출 분리 어려움 → 케이스 매출 전체)
      for (const v of c.vendors) {
        const existing = vendorMap.get(v.name) ?? {
          name: v.name,
          country: v.country,
          caseCount: 0,
          revenueJPY: 0,
          costJPY: 0,
        }
        existing.caseCount++
        existing.costJPY += v.costJPY
        vendorMap.set(v.name, existing)
      }
    }

    // ── 월별 트렌드 ─────────────────────────────────────────────────
    const monthlyTrend = await getMonthlyTrend(year)

    // ── 타임라인 이벤트 ─────────────────────────────────────────────
    const timeline = caseData
      .flatMap((c) => {
        const events: { date: string; label: string; type: string; caseName: string }[] = []
        if (c.etd)
          events.push({
            date: c.etd as unknown as string,
            label: '출항',
            type: 'ship',
            caseName: c.caseName,
          })
        if (c.eta)
          events.push({
            date: c.eta as unknown as string,
            label: '입항 예정',
            type: 'arrive',
            caseName: c.caseName,
          })
        return events
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      period,
      year,
      month,
      dateRange: { start: startDate, end: endDate },
      totals,
      cases: caseData,
      vendors: Array.from(vendorMap.values()).sort((a, b) => b.costJPY - a.costJPY),
      monthlyTrend,
      timeline,
    })
  } catch (err) {
    console.error('[trade-pipeline/analytics GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

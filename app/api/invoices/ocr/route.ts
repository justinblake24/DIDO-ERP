// app/api/invoices/ocr/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseInvoiceImage } from '@/lib/gemini'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * 청구서 번호에서 invoiceType 자동 감지
 * - T(N) 패턴 → TRANSPORT (운송비)
 * - S(N) 패턴 → SAMPLE (샘플 대금)
 * - 그 외      → REGULAR (일반 P/O 청구)
 */
function detectInvoiceType(invoiceNo: string): 'REGULAR' | 'TRANSPORT' | 'SAMPLE' {
  if (/T\(N\)/i.test(invoiceNo)) return 'TRANSPORT'
  if (/S\(N\)/i.test(invoiceNo)) return 'SAMPLE'
  return 'REGULAR'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '지원하지 않는 파일 형식입니다. (지원: JPG, PNG, PDF)' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Gemini Vision OCR
    const ocrResult = await parseInvoiceImage(base64, file.type)

    // ── 청구 유형 자동 감지 ──────────────────────────────
    const invoiceType = detectInvoiceType(ocrResult.invoiceNo)
    const needsPo = invoiceType === 'REGULAR'

    // ── PO 자동 매핑 (REGULAR 유형만) ───────────────────
    let matchedPo = null
    if (needsPo && ocrResult.poRef) {
      matchedPo = await prisma.purchaseOrder.findFirst({
        where: { poNumber: { equals: ocrResult.poRef } },
        select: {
          id: true, poNumber: true, status: true,
          vendor: { select: { name: true, country: true } },
          items: { select: { productName: true, totalAmount: true, currency: true } },
        },
      })

      if (!matchedPo) {
        matchedPo = await prisma.purchaseOrder.findFirst({
          where: { poNumber: { contains: ocrResult.poRef.replace(/[®©™]/g, '') } },
          select: {
            id: true, poNumber: true, status: true,
            vendor: { select: { name: true, country: true } },
            items: { select: { productName: true, totalAmount: true, currency: true } },
          },
        })
      }
    }

    // 중복 확인
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNo: ocrResult.invoiceNo },
      select: { id: true, invoiceNo: true },
    })

    return NextResponse.json({
      ocr: ocrResult,
      invoiceType,   // 'REGULAR' | 'TRANSPORT' | 'SAMPLE'
      needsPo,       // false이면 P/O 없이 저장 가능
      matchedPo,
      duplicate: existingInvoice ? { id: existingInvoice.id, invoiceNo: existingInvoice.invoiceNo } : null,
      fileName: file.name,
    })
  } catch (error) {
    console.error('OCR API error:', error)
    const message = error instanceof Error ? error.message : 'OCR 처리 중 오류가 발생했습니다'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

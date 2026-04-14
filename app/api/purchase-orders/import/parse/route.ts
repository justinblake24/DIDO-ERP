// app/api/purchase-orders/import/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile } from '@/lib/excel-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ message: '파일이 없습니다' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const result = await parseExcelFile(buffer)

    return NextResponse.json({
      pos: result.pos,
      totalItems: result.totalItems,
      anomalies: result.anomalies,
      errors: result.errors,
    })
  } catch (error: any) {
    console.error('Excel parse error:', error)
    return NextResponse.json({ message: error.message || '파싱 실패' }, { status: 500 })
  }
}

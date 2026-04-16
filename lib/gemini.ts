// lib/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// ─── OCR: 청구서 이미지 분석 ───────────────────────────────────────

export interface InvoiceOcrResult {
  invoiceNo: string        // 청구서 번호 (文書番号)
  invoiceDate: string      // YYYY-MM-DD
  totalJPY: number         // 합계 금액
  invoiceJPY: number       // 실 청구 금액 (중간정산 등)
  ratio: number            // invoiceJPY / totalJPY (0~1)
  unitPriceJPY: number     // 단가 (JPY)
  poRef: string            // Ref.No에서 추출한 PO 번호
  vendorName: string       // 수신처 이름
  productSummary: string   // 품목 요약
  rawText: string          // OCR 원본 텍스트
}

/**
 * Gemini Vision으로 청구서 이미지를 분석해 구조화된 데이터 반환
 */
export async function parseInvoiceImage(
  imageBase64: string,
  mimeType: string
): Promise<InvoiceOcrResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

  const prompt = `This is a Japanese invoice (御請求書). Extract the following information in JSON format.

IMPORTANT RULES for numbers:
- Remove ALL commas, ¥ symbols, and spaces from numbers
- Return numbers as plain integers (no decimals unless unit price)
- If you see "¥55,550,016" → return 55550016
- totalJPY: Grand total (合計 row, largest amount at the bottom of items table)
- invoiceJPY: The actual billing/claim amount (請求額, 請求金額) — may be less than totalJPY for partial payments
- unitPriceJPY: Unit price (単価) as integer
- invoiceNo: Document number (文書番号) in top-right area
- invoiceDate: Invoice date (請求日) in YYYY-MM-DD format
- poRef: FIRST PO reference in "Ref. No." field — extract only the part starting with DHPO- (ignore anything after line break)
- vendorName: Recipient company (宛先, 御中)
- productSummary: Brief summary of products
- ratio: set to 0 (will be calculated automatically)

Return ONLY valid JSON, no markdown:
{
  "invoiceNo": "...",
  "invoiceDate": "YYYY-MM-DD",
  "totalJPY": 55550016,
  "invoiceJPY": 21201062,
  "ratio": 0,
  "unitPriceJPY": 183,
  "poRef": "DHPO-(I)241028M-065",
  "vendorName": "...",
  "productSummary": "..."
}`

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    prompt,
  ])

  const text = result.response.text().trim()
  // JSON 블록 추출 (```json ... ``` 감싸진 경우 대비)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('OCR 결과 파싱 실패: JSON을 찾을 수 없습니다')

  const parsed = JSON.parse(jsonMatch[0]) as InvoiceOcrResult

  // ratio 서버에서 정확히 재계산 (소수점 4자리)
  if (parsed.totalJPY > 0 && parsed.invoiceJPY > 0) {
    parsed.ratio = Math.round((parsed.invoiceJPY / parsed.totalJPY) * 10000) / 10000
  }

  return parsed
}

export interface AnomalyCheckInput {
  vendor: string
  product: string
  currentPrice: number
  avgPrice: number
  currency: string
  quantity: number
  avgQuantity: number
}

export interface AnomalyResult {
  isAnomaly: boolean
  severity: 'low' | 'medium' | 'high'
  message: string
}

/**
 * Gemini AI 이상치 탐지
 * 과거 평균 대비 ±30% 이상 벗어나면 경고
 */
export async function checkPriceAnomaly(input: AnomalyCheckInput): Promise<AnomalyResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { isAnomaly: false, severity: 'low', message: '' }
  }

  const deviation = Math.abs((input.currentPrice - input.avgPrice) / input.avgPrice)
  if (deviation < 0.3) {
    return { isAnomaly: false, severity: 'low', message: '' }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

    const prompt = `당신은 무역 PO 검증 전문가입니다. 아래 발주의 이상 여부를 판단하고 1문장으로 경고하세요. 판단 기준: 단가, 수량, 발주처 패턴.

발주처: ${input.vendor}
제품: ${input.product}
현재 단가: ${input.currentPrice} ${input.currency}
과거 평균 단가: ${input.avgPrice} ${input.currency}
편차: ${(deviation * 100).toFixed(1)}%
수량: ${input.quantity}
과거 평균 수량: ${input.avgQuantity}

경고 메시지 (1문장, 한국어):`

    const result = await model.generateContent(prompt)
    const message = result.response.text().trim()

    const severity = deviation > 0.5 ? 'high' : deviation > 0.3 ? 'medium' : 'low'

    return { isAnomaly: true, severity, message }
  } catch (error) {
    console.error('Gemini API error:', error)
    const direction = input.currentPrice > input.avgPrice ? '상승' : '하락'
    return {
      isAnomaly: true,
      severity: 'medium',
      message: `${input.product}의 단가가 과거 평균 대비 ${(deviation * 100).toFixed(0)}% ${direction}했습니다. 확인이 필요합니다.`,
    }
  }
}

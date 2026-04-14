// lib/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

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

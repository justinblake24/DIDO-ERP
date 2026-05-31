/**
 * lib/trade-pipeline/parser.ts
 * 
 * 정규식 기반 무역 문서 파싱 엔진
 * AI 없이 결정론적으로 번호를 추출합니다 (오류 방지)
 */

export type DocType = 'JP_PO' | 'KR_PO_INTL' | 'KR_PO_LOCAL' | 'INVOICE_NOAH' | 'SHIPPING_DOC'

export interface ParsedDocument {
  docType: DocType
  docNumber: string | null
  numbers: {
    nhDh: string | null      // NH-DH번호 (일본 발주)
    dhpo: string | null      // DHPO번호 (한국→해외 발주)
    dhpoLocal: string | null // DH(L)번호 (국내 발주)
    dhpi: string | null      // DHPI-C(N)번호 (청구서)
    invNo: string | null     // DH-CS/DH-C 인보이스번호
  }
  parties: {
    buyer: string | null
    seller: string | null
    shipper: string | null
    consignee: string | null
  }
  items: Array<{
    name: string
    qty: number | null
    unit: string | null
    unitPrice: number | null
    currency: string | null
    amount: number | null
  }>
  incidentalCosts: Array<{
    name: string
    amount: number
    currency: string
  }>
  shipping: {
    portOfLoading: string | null
    portOfDischarge: string | null
    carrier: string | null
    containerNos: string[]
    incoterms: string | null
    etd: string | null
  }
  amounts: {
    total: number | null
    currency: string | null
  }
  rawText: string
  confidence: number // 0~100
  warnings: string[]
}

// ─── 정규식 패턴 (전부 결정론적) ───────────────────────────────

const PATTERNS = {
  // 번호 패턴
  NH_DH:      /NH-DH(\d{9,12}[A-Z]?)/gi,
  DHPO_INTL:  /DHPO-\(I\)([\d]{6}[A-Z]?-[\d]{3})/gi,
  DHPO_BARE:  /DHPO-([\d]{6}-[\d]{3}[®]?)/gi,
  DH_LOCAL:   /DH\(L\)-([\d]{6}-[\d]{3}[®]?)/gi,
  DHPI:       /DHPI-C\(N\)([\d]{6}[A-Z]?-[\d]{3})/gi,
  DH_CS_INV:  /DH-CS-(\d{4}-\d{2,3})/gi,
  DH_C_INV:   /DH-C-(\d{4}-\d{2,3})/gi,

  // 회사 패턴
  NOAH:        /NOAH\s*International\s*Co\.?\s*Ltd\.?/gi,
  DAIDO:       /Daido\s*Health\s*Care\s*Co\.?,?\s*Ltd\.?/gi,

  // 선적 패턴
  PORT_LOADING:   /Port\s+of\s+[Ll]oading[:\s]+([A-Za-z\s,]+?)(?:\n|,|\.|$)/gi,
  PORT_DISCHARGE: /Port\s+of\s+[Dd]ischarge[:\s]+([A-Za-z\s,]+?)(?:\n|,|\.|$)/gi,
  CONTAINER:      /([A-Z]{4}\d{7})\s*\/\s*([A-Z0-9]+)/g,
  INCOTERMS:      /INCO\s*TERMS?\s*[:：]\s*(FOB|CIF|EXW|DAP|DDP)/gi,
  CARRIER:        /(?:Carrier|선사)\s*[:：]?\s*([A-Z][A-Z0-9 ]+(?:\/[A-Z0-9]+)?)/gi,
  ETD:            /[Ss]ailing\s+on\s+or\s+about\s*[:：]?\s*([\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4})/gi,

  // 금액 패턴 (기호 및 텍스트 통화코드 지원, 앞뒤 모두 허용)
  JPY_AMOUNT:  /(?:[¥￥]|JPY\s*)([\d,]+)|([\d,]+)\s*JPY/gi,
  USD_AMOUNT:  /(?:\$|USD\s*)([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*USD/gi,
  KRW_AMOUNT:  /(?:[₩]|KRW\s*|원\s*)([\d,]+)|([\d,]+)\s*(?:KRW|원)/gi,
}

// ─── 번호 추출 헬퍼 ─────────────────────────────────────────────

function firstMatch(text: string, pattern: RegExp): string | null {
  pattern.lastIndex = 0
  const m = pattern.exec(text)
  if (!m) return null
  return (m[1] || m[2] || m[0]).trim()
}

function allMatches(text: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    const val = m[1] || m[2]
    if (val) results.push(val.trim())
  }
  return [...new Set(results)]
}

// ─── 문서 유형 분류 ─────────────────────────────────────────────

export function classifyDocType(text: string, fileName: string): DocType {
  const upper = text.toUpperCase()
  const fileUpper = fileName.toUpperCase()

  // 파일명 기반 우선 분류
  if (/DH発注書|NH-DH/.test(fileName)) return 'JP_PO'
  if (/請求書/.test(fileName)) return 'INVOICE_NOAH'
  if (/INV.*P\.L|P\.L.*INV/.test(fileUpper) || fileName.endsWith('.xlsx')) return 'SHIPPING_DOC'
  if (/DH\(L\)|DH-L/.test(fileName)) return 'KR_PO_LOCAL'
  if (/DHPO.*\(I\)|DAIDO_PO/.test(fileUpper)) return 'KR_PO_INTL'
  if (/DHPO/.test(fileUpper) && !/\(I\)/.test(fileUpper)) return 'KR_PO_LOCAL'

  // 텍스트 기반 분류
  if (/発注書|発注No/.test(text) && /NOAHインターナショナル/.test(text)) return 'JP_PO'
  if (/御請求書|請求書/.test(text) && /NOAH/.test(text)) return 'INVOICE_NOAH'
  if (/PURCHASE ORDER SHEET/.test(upper) && /GUANGDONG|CHINA/.test(upper)) return 'KR_PO_INTL'
  if (/PURCHASE ORDER/.test(upper) && /DH\(L\)/.test(text)) return 'KR_PO_LOCAL'
  if (/PURCHASE ORDER/.test(upper) && /DHPO/.test(text) && !/\(I\)/.test(text)) return 'KR_PO_LOCAL'
  if (/COMMERCIAL INVOICE|PACKING LIST/.test(upper)) return 'SHIPPING_DOC'

  // fallback
  if (/DH\(L\)/.test(text)) return 'KR_PO_LOCAL'
  if (/DHPO.*\(I\)/.test(text)) return 'KR_PO_INTL'
  if (/DHPO/.test(text)) return 'KR_PO_LOCAL'
  return 'SHIPPING_DOC'
}

// ─── 금액 파싱 ──────────────────────────────────────────────────

function parseAmount(str: string): number | null {
  const cleaned = str.replace(/,/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// ─── 상품 아이템 추출 ────────────────────────────────────────────

function extractItems(text: string, defaultCurrency: string, docType: DocType): ParsedDocument['items'] {
  const items: ParsedDocument['items'] = []

  // 번호. 상품명 패턴 (1. Product Name ... qty ... [unit] ... price ... amount)
  // pdftotext -layout 적용 시 금액 앞에/뒤에 통화 기호 및 텍스트가 붙어있을 수 있음
  const curr = /(?:[₩\$¥￥]|KRW|JPY|USD|원)/.source
  const linePattern = new RegExp(`^\\s*(\\d+)\\.\\s+(.+?)\\s+([\\d,]+)\\s+(?:(EA|Bags?|Pcs?|Sets?|Cases?|Boxes?|BOX|Cartons?|CTN|개|ea)\\s+)?(?:${curr}\\s*)?([\\d.,]+)\\s*(?:${curr}\\s*)?\\s+(?:${curr}\\s*)?([\\d,]+)\\s*(?:${curr}\\s*)?`, 'gim')
  let m: RegExpExecArray | null
  while ((m = linePattern.exec(text)) !== null) {
    let lineCurrency = defaultCurrency
    if (/[¥￥]|\bJPY\b/i.test(m[0])) lineCurrency = 'JPY'
    else if (/[₩]|\bKRW\b|원/i.test(m[0])) lineCurrency = 'KRW'
    else if (/[\$]|\bUSD\b/i.test(m[0])) lineCurrency = 'USD'

    items.push({
      name: m[2].trim(),
      qty: parseAmount(m[3]),
      unit: m[4] || null,
      unitPrice: parseAmount(m[5]),
      currency: lineCurrency,
      amount: parseAmount(m[6]),
    })
  }

  // 발주서(JP PO) 등에서 항목 번호 없이 [상품명] [수량] [박스] [단가] [금액] 나열되는 경우
  if (items.length === 0 && docType === 'JP_PO') {
    const blockPattern = new RegExp(`^\\s*(.+?)\\s+([\\d,]+)\\s+(?:([\\d,]+)\\s+)?(?:${curr}\\s*)?([\\d.,]+)\\s*(?:${curr}\\s*)?\\s+(?:${curr}\\s*)?([\\d,]+)\\s*(?:${curr}\\s*)?$`, 'gim')
    while ((m = blockPattern.exec(text)) !== null) {
      const name = m[1].trim()
      const qty = parseAmount(m[2]) || 0
      const price = parseAmount(m[4]) || 0
      const amount = parseAmount(m[5]) || 0
      
      let lineCurrency = defaultCurrency
      if (/[¥￥]|\bJPY\b/i.test(m[0])) lineCurrency = 'JPY'
      else if (/[₩]|\bKRW\b|원/i.test(m[0])) lineCurrency = 'KRW'
      else if (/[\$]|\bUSD\b/i.test(m[0])) lineCurrency = 'USD'

      // 전화번호나 우편번호 등 잘못 매칭되는 것을 방지하기 위해 간단한 유효성 검증
      if (qty > 0 && price > 0 && amount > 0 && Math.abs(qty * price - amount) < amount * 0.1) {
        items.push({
          name: name,
          qty,
          unit: 'EA',
          unitPrice: price,
          currency: lineCurrency,
          amount,
        })
      }
    }
  }

  return items
}

// ─── 부대비용 추출 ──────────────────────────────────────────────

function extractIncidentalCosts(text: string, defaultCurrency: string): ParsedDocument['incidentalCosts'] {
  const costs: ParsedDocument['incidentalCosts'] = []
  
  // T/C, Insurance, Freight, THC, 운임, 보험 등의 키워드를 추적
  const costKeywords = ['T/C', 'T.C', '보험 포함', 'Insurance', 'Freight', 'THC', '운임', 'Handling Charge']
  
  // 조금 더 엄격한 매칭을 위해 각 줄마다 검사
  const lines = text.split('\n')
  for (const line of lines) {
    for (const kw of costKeywords) {
      if (line.toUpperCase().includes(kw.toUpperCase())) {
        // Remove dates like 3/14, 3/19, 2024.03.19 to prevent them from being parsed as amounts
        let cleanLine = line.replace(/\b\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,2})?\b/g, '')
        // Extract all remaining numbers
        const matches = cleanLine.match(/[\d,]+(?:\.\d+)?/g)
        
        if (matches && matches.length > 0) {
          let maxAmount = 0
          for (const m of matches) {
            const val = parseAmount(m)
            if (val && val > maxAmount) {
              maxAmount = val
            }
          }

          if (maxAmount > 0 && !costs.some(c => c.name.toUpperCase() === kw.toUpperCase())) {
            let lineCurrency = defaultCurrency
            if (/[¥￥]|\bJPY\b/i.test(line)) lineCurrency = 'JPY'
            else if (/[₩]|\bKRW\b|원/i.test(line)) lineCurrency = 'KRW'
            else if (/[\$]|\bUSD\b/i.test(line)) lineCurrency = 'USD'

            costs.push({ name: kw, amount: maxAmount, currency: lineCurrency })
          }
        }
      }
    }
  }

  return costs
}

// ─── 메인 파서 ──────────────────────────────────────────────────

export function parseTradeDocument(
  text: string,
  fileName: string
): ParsedDocument {
  const warnings: string[] = []
  const docType = classifyDocType(text, fileName)

  // 번호 추출
  const nhDhRaw    = firstMatch(text, PATTERNS.NH_DH)
  const nhDh       = nhDhRaw ? `NH-DH${nhDhRaw}` : null
  const dhpoIntl   = firstMatch(text, PATTERNS.DHPO_INTL)
  const dhpoBare   = firstMatch(text, PATTERNS.DHPO_BARE)
  const dhpo       = dhpoIntl ? `DHPO-(I)${dhpoIntl}` : dhpoBare ? `DHPO-${dhpoBare}` : null
  const dhpoLocal  = firstMatch(text, PATTERNS.DH_LOCAL)
  const dhpoLocalFull = dhpoLocal ? `DH(L)-${dhpoLocal}` : null
  const dhpiRaw    = firstMatch(text, PATTERNS.DHPI)
  const dhpi       = dhpiRaw ? `DHPI-C(N)${dhpiRaw}` : null
  const invCs      = firstMatch(text, PATTERNS.DH_CS_INV)
  const invC       = firstMatch(text, PATTERNS.DH_C_INV)
  const invNo      = invCs ? `DH-CS-${invCs}` : invC ? `DH-C-${invC}` : null

  // 문서 유형별 대표 번호
  const docNumber =
    docType === 'JP_PO'       ? nhDh :
    docType === 'KR_PO_INTL'  ? dhpo :
    docType === 'KR_PO_LOCAL' ? (dhpoLocalFull || dhpo) :
    docType === 'INVOICE_NOAH'? dhpi :
    invNo

  // 거래처
  const hasNoah  = PATTERNS.NOAH.test(text)
  const hasDaido = PATTERNS.DAIDO.test(text)

  // 선적 정보 (1차 정규식 매칭)
  let portLoading   = firstMatch(text, PATTERNS.PORT_LOADING)?.trim() ?? null
  let portDischarge = firstMatch(text, PATTERNS.PORT_DISCHARGE)?.trim() ?? null
  const incoterms     = firstMatch(text, PATTERNS.INCOTERMS)?.toUpperCase() ?? null
  const containerNos  = allMatches(text, PATTERNS.CONTAINER)
  let carrier       = firstMatch(text, PATTERNS.CARRIER)?.trim() ?? null
  let etd           = firstMatch(text, PATTERNS.ETD) ?? null

  // 2차 매칭: 엑셀 등 표 형태 텍스트에 대한 줄바꿈(tabular) 구조 후처리
  if (!portLoading || !portDischarge || !carrier || !etd) {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase()
      // Port of Loading & Discharge
      if ((!portLoading || !portDischarge) && lowerLine.includes('port of loading')) {
        const nextLine = lines[i+1]
        if (nextLine) {
          const parts = nextLine.split('\t')
          if (!portLoading && parts.length > 0 && parts[0].trim()) portLoading = parts[0].trim()
          if (!portDischarge && parts.length > 1 && parts[1].trim()) portDischarge = parts[1].trim()
        }
      }
      // Carrier & ETD
      if ((!carrier || !etd) && (lowerLine.includes('carrier') || lowerLine.includes('선사'))) {
        const nextLine = lines[i+1]
        if (nextLine) {
          const parts = nextLine.split('\t')
          if (!carrier && parts.length > 0 && parts[0].trim()) carrier = parts[0].trim()
          if (!etd && parts.length > 1) {
            const etdMatch = parts[1].match(/[\d]{4}-[\d]{2}-[\d]{2}/)
            if (etdMatch) etd = etdMatch[0]
          }
        }
      }
    }
  }

  // 금액
  const jpyAmounts = allMatches(text, PATTERNS.JPY_AMOUNT).map(parseAmount).filter(Boolean) as number[]
  const usdAmounts = allMatches(text, PATTERNS.USD_AMOUNT).map(parseAmount).filter(Boolean) as number[]
  const krwAmounts = allMatches(text, PATTERNS.KRW_AMOUNT).map(parseAmount).filter(Boolean) as number[]
  const totalJPY = jpyAmounts.length ? Math.max(...jpyAmounts) : null
  const totalUSD = usdAmounts.length ? Math.max(...usdAmounts) : null
  const totalKRW = krwAmounts.length ? Math.max(...krwAmounts) : null
  
  let currency = 'UNKNOWN'
  if (totalJPY && (!totalKRW || totalJPY > totalKRW)) currency = 'JPY'
  else if (totalUSD && (!totalKRW || totalUSD > totalKRW)) currency = 'USD'
  else if (totalKRW) currency = 'KRW'
  
  if (currency === 'UNKNOWN') {
    if (/JPY/i.test(text) || /YEN/i.test(text)) currency = 'JPY'
    else if (/USD/i.test(text)) currency = 'USD'
    else currency = 'KRW'
  }

  if (docType === 'KR_PO_LOCAL') {
    currency = 'KRW'
  }
  const total    = totalJPY ?? totalUSD ?? totalKRW ?? null

  // 상품 아이템 및 부대비용
  const items = extractItems(text, currency, docType)
  const incidentalCosts = extractIncidentalCosts(text, currency)

  // 신뢰도 계산 (문서 종류별 맞춤)
  let confidence = 0
  
  if (docType === 'JP_PO') {
    if (nhDh) confidence += 40
    if (items.length > 0) confidence += 40
    if (total) confidence += 20
  } else if (docType === 'KR_PO_INTL') {
    if (dhpo) confidence += 40
    if (items.length > 0) confidence += 40
    if (total) confidence += 20
  } else if (docType === 'KR_PO_LOCAL') {
    if (dhpoLocalFull || dhpo) confidence += 40
    if (items.length > 0) confidence += 40
    if (total) confidence += 20
  } else if (docType === 'INVOICE_NOAH') {
    if (invNo) confidence += 30
    if (nhDh) confidence += 20
    if (dhpo) confidence += 20
    if (items.length > 0) confidence += 20
    if (total) confidence += 10
  } else if (docType === 'SHIPPING_DOC') {
    if (invNo) confidence += 60
    if (items.length > 0) confidence += 20
    if (total) confidence += 10
    if (dhpi) confidence += 10
    if (portLoading || portDischarge) confidence += 10
  } else {
    // 기본값 폴백
    if (nhDh)   confidence += 30
    if (dhpo)   confidence += 25
    if (invNo)  confidence += 20
    if (dhpi)   confidence += 15
    if (items.length > 0) confidence += 10
  }
  
  confidence = Math.min(confidence, 100)

  // 경고 생성 (문서 종류별 맞춤)
  if (!nhDh && docType === 'JP_PO') warnings.push('NH-DH 번호를 찾지 못했습니다')
  if (!dhpo && docType === 'KR_PO_INTL') warnings.push('DHPO 번호를 찾지 못했습니다')
  if (!(dhpoLocalFull || dhpo) && docType === 'KR_PO_LOCAL') warnings.push('국내 발주 번호를 찾지 못했습니다')
  if (!invNo && docType === 'INVOICE_NOAH') warnings.push('Invoice 번호를 찾지 못했습니다')
  
  if (items.length === 0 && docType !== 'SHIPPING_DOC') warnings.push('상품 항목을 추출하지 못했습니다')
  if (!total && docType !== 'SHIPPING_DOC') warnings.push('금액을 추출하지 못했습니다')

  return {
    docType,
    docNumber,
    numbers: { nhDh, dhpo, dhpoLocal: dhpoLocalFull, dhpi, invNo },
    parties: {
      buyer:     hasNoah  ? 'NOAH International Co., Ltd.' : null,
      seller:    hasDaido ? 'Daido Health Care Co., Ltd.'  : null,
      shipper:   hasDaido ? 'Daido Health Care Co., Ltd.'  : null,
      consignee: hasNoah  ? 'NOAH International Co., Ltd.' : null,
    },
    items,
    incidentalCosts,
    shipping: {
      portOfLoading: portLoading,
      portOfDischarge: portDischarge,
      carrier,
      containerNos,
      incoterms,
      etd,
    },
    amounts: { total, currency },
    rawText: text,
    confidence,
    warnings,
  }
}

// ─── 거래 연결 알고리즘 ──────────────────────────────────────────

export interface LinkScore {
  score: number      // 0~100
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  matchedOn: string[]
  warnings: string[]
}

export function calculateLinkScore(docs: ParsedDocument[]): LinkScore {
  const warnings: string[] = []
  const matchedOn: string[] = []
  let score = 0

  if (docs.length === 1) {
    const docConf = docs[0].confidence
    return {
      score: docConf,
      level: docConf >= 80 ? 'HIGH' : docConf >= 60 ? 'MEDIUM' : 'LOW',
      matchedOn: ['단일 문서가 업로드되었습니다 (교차 검증 불가)'],
      warnings: docConf < 80 ? ['문서 신뢰도가 낮아 주의가 필요합니다.'] : []
    }
  }

  // NH-DH 번호 수집
  const nhDhNums = [...new Set(docs.map(d => d.numbers.nhDh).filter(Boolean))]
  // DHPO 번호 수집
  const dhpoNums = [...new Set(docs.map(d => d.numbers.dhpo).filter(Boolean))]
  // INV 번호 수집
  const invNums  = [...new Set(docs.map(d => d.numbers.invNo).filter(Boolean))]

  // 請求書에서 NH-DH와 DHPO 동시 보유 확인 (핵심 연결 증거)
  const invoiceDocs = docs.filter(d => d.docType === 'INVOICE_NOAH')
  for (const inv of invoiceDocs) {
    if (inv.numbers.nhDh && inv.numbers.dhpo) {
      score += 50
      matchedOn.push(`請求書 ${inv.docNumber} → NH-DH + DHPO 동시 확인`)
    }
  }

  // NH-DH 번호 일치 확인
  if (nhDhNums.length === 1 && docs.filter(d => d.numbers.nhDh).length >= 2) {
    score += 30
    matchedOn.push(`NH-DH 번호 일치: ${nhDhNums[0]}`)
  } else if (nhDhNums.length > 1) {
    score += 30 // 복합 거래도 정상 거래로 취급
    matchedOn.push(`복합 거래건 확인 (${nhDhNums.length}건 발주 통합): ${nhDhNums.join(', ')}`)
  }

  // DHPO 번호 일치 확인
  if (dhpoNums.length >= 1 && docs.filter(d => d.numbers.dhpo).length >= 2) {
    score += 20
    matchedOn.push(`DHPO 번호 일치: ${dhpoNums[0]}`)
  }

  // INV 번호 연결 확인
  if (invNums.length >= 1 && docs.filter(d => d.numbers.invNo).length >= 2) {
    score += 10
    matchedOn.push(`INV 번호 일치: ${invNums.join(', ')}`)
  }

  // 금액 검증 (모든 발주서 합계 vs 모든 청구서 합계)
  const jpPoAmounts  = docs.filter(d => d.docType === 'JP_PO').map(d => d.amounts.total).filter(Boolean) as number[]
  const invAmounts   = docs.filter(d => d.docType === 'INVOICE_NOAH').map(d => d.amounts.total).filter(Boolean) as number[]

  if (jpPoAmounts.length > 0 && invAmounts.length > 0) {
    const totalJpPo = jpPoAmounts.reduce((a, b) => a + b, 0)
    const totalInv = invAmounts.reduce((a, b) => a + b, 0)

    const ratio = totalInv / totalJpPo
    if (ratio > 1.15) {
      warnings.push(`⚠️ 청구 초과: 발주서 총액 ¥${totalJpPo.toLocaleString()} vs 청구서 총액 ¥${totalInv.toLocaleString()} (+${((ratio-1)*100).toFixed(1)}% 초과)`)
    } else if (ratio < 0.9) {
      score += 20
      matchedOn.push(`부분 선적 (Partial Shipment) 확인: 발주 총액의 ${(ratio * 100).toFixed(1)}% 청구됨 (¥${totalInv.toLocaleString()})`)
    } else {
      score += 20
      matchedOn.push(`총액 일치 검증 통과: ¥${totalJpPo.toLocaleString()} ≈ ¥${totalInv.toLocaleString()}`)
    }
  }

  const level: LinkScore['level'] =
    score >= 80 ? 'HIGH' :
    score >= 60 ? 'MEDIUM' : 'LOW'

  return { score: Math.min(score, 100), level, matchedOn, warnings }
}

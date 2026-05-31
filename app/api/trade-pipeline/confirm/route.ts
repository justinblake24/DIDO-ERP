/**
 * app/api/trade-pipeline/confirm/route.ts
 * 
 * 사람이 검토 완료 후 "확정 저장" 버튼을 누르면 호출되는 API
 * 파싱 결과를 DB에 저장합니다
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface ConfirmPayload {
  caseName: string
  nhDhNumber: string | null
  linkScore: number
  documents: Array<{
    fileName: string
    filePath: string
    docType: string
    docNumber: string | null
    numbers: {
      nhDh: string | null
      dhpo: string | null
      dhpoLocal: string | null
      dhpi: string | null
      invNo: string | null
    }
    parsedData: object
    confidence: number
    verified: boolean
  }>
  shippingInfo: {
    portOfLoading: string
    portOfDischarge: string
    carrier: string | null
    containerNos: string[]
    incoterms: string | null
    etd: string | null
    eta: string | null
  } | null
}

async function getOrCreateVendor(tx: any, parsedData: any): Promise<string> {
  const seller = parsedData?.parties?.seller;
  const buyer = parsedData?.parties?.buyer;
  let name = seller || buyer || 'Unknown Vendor';
  
  const searchName = name.replace(/co\.,\s*ltd\.?/i, '').trim();

  let vendor = await tx.vendor.findFirst({
    where: { name: { contains: searchName, mode: 'insensitive' } }
  });

  if (!vendor) {
    vendor = await tx.vendor.findUnique({ where: { name } });
  }

  if (!vendor) {
    vendor = await tx.vendor.create({
      data: {
        name,
        country: 'UNKNOWN',
        currency: 'USD'
      }
    });
  }

  return vendor.id;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    let dbUserId = null;
    if (authUser?.email) {
      const dbUser = await prisma.user.findUnique({ where: { email: authUser.email } })
      if (dbUser) dbUserId = dbUser.id
    }
    
    if (!dbUserId) {
      const firstAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
      dbUserId = firstAdmin?.id
    }
    
    if (!dbUserId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없어 발주서를 생성할 수 없습니다.' }, { status: 401 })
    }

    const body: ConfirmPayload = await req.json()

    const result = await prisma.$transaction(async (tx) => {
      // 1. TradeCase 생성
      const tradeCase = await tx.tradeCase.create({
        data: {
          caseName: body.caseName,
          nhDhNumber: body.nhDhNumber,
          status: 'REVIEWED',

          // 문서들 일괄 생성
          documents: {
            create: body.documents.map(doc => ({
              docType: doc.docType as any,
              docNumber: doc.docNumber,
              fileName: doc.fileName,
              filePath: doc.filePath,
              parsedData: doc.parsedData as any,
              confidence: doc.confidence,
              verified: doc.verified,
            })),
          },

          // 선적 정보
          ...(body.shippingInfo && {
            shippingInfo: {
              create: {
                portOfLoading: body.shippingInfo.portOfLoading,
                portOfDischarge: body.shippingInfo.portOfDischarge,
                carrier: body.shippingInfo.carrier,
                containerNos: body.shippingInfo.containerNos,
                incoterms: body.shippingInfo.incoterms,
                etd: body.shippingInfo.etd ? new Date(body.shippingInfo.etd) : null,
                eta: body.shippingInfo.eta ? new Date(body.shippingInfo.eta) : null,
              },
            },
          }),
        },
        include: {
          documents: true,
          shippingInfo: true,
        },
      })

      // 2. 문서별 PurchaseOrder 및 Invoice 자동 생성 및 연결 로직
      for (const doc of tradeCase.documents) {
        if (!doc.docNumber) continue;

        if (['JP_PO', 'KR_PO_INTL', 'KR_PO_LOCAL'].includes(doc.docType)) {
          // 기존 PO 확인
          const existingPo = await tx.purchaseOrder.findUnique({
            where: { poNumber: doc.docNumber },
            include: { items: true }
          })

          if (existingPo) {
            // 연결
            await tx.purchaseOrder.update({
              where: { id: existingPo.id },
              data: { tradeCaseId: tradeCase.id }
            })

            // 기존 PO의 금액이 0원인 경우(과거 잘못 파싱된 데이터), 새 파싱 데이터로 아이템 덮어쓰기
            const existingTotal = existingPo.items.reduce((acc, it) => acc + Number(it.totalAmount), 0)
            if (existingTotal === 0 && existingPo.items.length > 0) {
              const parsed = doc.parsedData as any;
              const firstItemCurrency = parsed?.items?.[0]?.currency || 'USD';
              
              if (parsed?.items && parsed.items.length > 0) {
                // 기존 0원 아이템들 삭제
                await tx.pOItem.deleteMany({
                  where: { poId: existingPo.id }
                })
                
                // 새 아이템 생성
                await tx.pOItem.createMany({
                  data: parsed.items.map((item: any, idx: number) => ({
                    poId: existingPo.id,
                    productName: item.name || 'Unknown Item',
                    quantity: item.qty || 1,
                    unit: item.unit || 'EA',
                    unitPrice: item.unitPrice || 0,
                    currency: item.currency || firstItemCurrency,
                    totalAmount: item.amount || ( (item.qty || 1) * (item.unitPrice || 0) ),
                    sortOrder: idx
                  }))
                })
              }
            }
          } else {
            // 신규 PO 생성
            const parsed = doc.parsedData as any;
            const vendorId = await getOrCreateVendor(tx, parsed);
            
            const firstItemCurrency = parsed?.items?.[0]?.currency || 'USD';
            
            await tx.purchaseOrder.create({
              data: {
                poNumber: doc.docNumber,
                issueDate: new Date(), // 기본값: 현재시간
                vendorId,
                status: 'DRAFT',
                createdById: dbUserId,
                tradeCaseId: tradeCase.id,
                items: {
                  create: (parsed?.items || []).map((item: any, idx: number) => ({
                    productName: item.name || 'Unknown Item',
                    quantity: item.qty || 1,
                    unit: item.unit || 'EA',
                    unitPrice: item.unitPrice || 0,
                    currency: item.currency || firstItemCurrency,
                    totalAmount: item.amount || ( (item.qty || 1) * (item.unitPrice || 0) ),
                    sortOrder: idx
                  }))
                }
              }
            })
          }
        } 
        else if (doc.docType === 'INVOICE_NOAH') {
          const parsed = doc.parsedData as any;
          
          // 연관된 PO 찾기 (DHPO 또는 NH-DH)
          let linkedPoId = null;
          const targetPoNum = parsed?.numbers?.dhpo || parsed?.numbers?.nhDh;
          if (targetPoNum) {
            const po = await tx.purchaseOrder.findUnique({ where: { poNumber: targetPoNum } });
            if (po) linkedPoId = po.id;
          }

          // 기존 Invoice 확인
          const existingInv = await tx.invoice.findUnique({
            where: { invoiceNo: doc.docNumber }
          })

          if (existingInv) {
            // 연결
            await tx.invoice.update({
              where: { id: existingInv.id },
              data: { 
                tradeCaseId: tradeCase.id,
                ...(linkedPoId && { poId: linkedPoId })
              }
            })
          } else {
            // 신규 Invoice 생성
            const total = parsed?.amounts?.total || 0;
            
            await tx.invoice.create({
              data: {
                invoiceNo: doc.docNumber,
                invoiceDate: new Date(),
                invoiceType: 'REGULAR',
                unitPriceJPY: 0,
                totalJPY: total,
                ratio: 100, // 기본 100%
                tradeCaseId: tradeCase.id,
                ...(linkedPoId && { poId: linkedPoId })
              }
            })
          }
        }
      }

      return tradeCase;
    });

    return NextResponse.json({
      success: true,
      tradeCaseId: result.id,
      message: `거래 케이스 "${body.caseName}"이 저장되며 발주서/청구서가 연동되었습니다.`,
    })
  } catch (err) {
    console.error('[trade-pipeline/confirm]', err)
    return NextResponse.json(
      { error: '저장 중 오류가 발생했습니다', detail: String(err) },
      { status: 500 }
    )
  }
}

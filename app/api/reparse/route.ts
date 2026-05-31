import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseTradeDocument } from '@/lib/trade-pipeline/parser'

export async function GET() {
  try {
    const docs = await prisma.tradeCaseDocument.findMany()
    let updatedCount = 0

    for (const doc of docs) {
      // Extract rawText from parsedData if it exists
      const currentParsedData = doc.parsedData as any;
      console.log('Doc keys:', Object.keys(currentParsedData));
      const rawText = currentParsedData?.rawText;

      if (rawText) {
        // Re-run the parser with the existing rawText and filename
        const newParsedData = parseTradeDocument(rawText, doc.fileName)
        
        // Update the database record with the fresh parsedData
        await prisma.tradeCaseDocument.update({
          where: { id: doc.id },
          data: {
            parsedData: newParsedData as any,
          }
        })
        updatedCount++
      }
    }

    return NextResponse.json({ success: true, updatedCount })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}

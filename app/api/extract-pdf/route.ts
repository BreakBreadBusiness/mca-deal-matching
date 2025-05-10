import { type NextRequest, NextResponse } from "next/server"
import pdfParse from "pdf-parse"
import { createWorker } from "tesseract.js"

// OCR fallback
async function extractTextWithOcr(pdfData: Buffer): Promise<string> {
  const worker = await createWorker()
  const { data } = await worker.recognize(pdfData)
  await worker.terminate()
  return data.text
}

// Extract and parse text
function parseFields(text: string) {
  const parsedFields: any = {}

  const match = (regex: RegExp) => {
    const result = text.match(regex)
    return result && result[1]?.trim()
  }

  parsedFields.businessName = match(/business\s*name\s*:?\s*([\w\s&.,'-]+)/i)
  parsedFields.creditScore = parseInt(match(/credit\s*score\s*:?\s*(\d{3,})/i)) || undefined
  parsedFields.timeInBusiness = parseInt(match(/time\s*in\s*business\s*:?\s*(\d+)/i)) || undefined

  const funding = match(/funding\s*(?:requested|amount|needed)\s*:?\s*\$?\s*([\d,\.]+)/i)
  parsedFields.fundingRequested = funding ? parseInt(funding.replace(/,/g, "")) : undefined

  const state = match(/state\s*:?\s*([A-Z]{2})/i)
  parsedFields.state = state?.toUpperCase()

  const industries = [
    "Restaurant", "Retail", "Healthcare", "Technology", "Construction", "Manufacturing",
    "Transportation", "Finance", "Real Estate", "Education", "Hospitality", "Entertainment",
    "Agriculture", "Energy", "Legal Services", "Automotive", "Beauty & Wellness",
    "Fitness", "Home Services", "Professional Services",
  ]
  parsedFields.industry = industries.find(ind => text.toLowerCase().includes(ind.toLowerCase()))

  return parsedFields
}

// API handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileUrl, storageType } = body

    if (!fileUrl) {
      return NextResponse.json({ error: "No file URL provided" }, { status: 400 })
    }

    const response = await fetch(fileUrl)
    if (!response.ok) {
      return NextResponse.json({ error: `Failed to download file: ${response.status}` }, { status: 500 })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    let extractedText: string
    try {
      const result = await pdfParse(buffer)
      extractedText = result.text
    } catch (pdfError) {
      console.warn("PDF parsing failed, using OCR fallback")
      extractedText = await extractTextWithOcr(buffer)
    }

    const parsedFields = parseFields(extractedText)

    return NextResponse.json({
      success: true,
      extractedText,
      parsedFields,
    })
  } catch (error) {
    console.error("Error processing PDF:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

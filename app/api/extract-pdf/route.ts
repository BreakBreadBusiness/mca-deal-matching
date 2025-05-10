import { type NextRequest, NextResponse } from "next/server"
import { createWorker } from "tesseract.js"

// OCR fallback if pdfParse fails
async function extractTextWithOcr(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng")
  const {
    data: { text },
  } = await worker.recognize(buffer)
  await worker.terminate()
  return text
}

// Parse text for fields
function parseFields(text: string) {
  const parsedFields: {
    businessName?: string
    creditScore?: number
    timeInBusiness?: number
    fundingRequested?: number
    state?: string
    industry?: string
  } = {}

  const getMatch = (regex: RegExp) => {
    const match = text.match(regex)
    return match?.[1]?.trim()
  }

  parsedFields.businessName = getMatch(/business\s*name\s*:?\s*([\w\s&.,'-]+)/i) || undefined
  parsedFields.creditScore = Number.parseInt(getMatch(/credit\s*score\s*:?\s*(\d{3,})/i) || "") || undefined
  parsedFields.timeInBusiness = Number.parseInt(getMatch(/time\s*in\s*business\s*:?\s*(\d+)/i) || "") || undefined

  const fundingRaw = getMatch(/funding\s*(?:requested|amount|needed)\s*:?\s*\$?\s*([\d,.]+)/i)
  parsedFields.fundingRequested = fundingRaw ? Number.parseInt(fundingRaw.replace(/,/g, "")) : undefined

  const stateMatch = getMatch(/state\s*:?\s*([A-Z]{2})/i)
  parsedFields.state = stateMatch ? stateMatch.toUpperCase() : undefined

  const industries = [
    "Restaurant",
    "Retail",
    "Healthcare",
    "Technology",
    "Construction",
    "Manufacturing",
    "Transportation",
    "Finance",
    "Real Estate",
    "Education",
    "Hospitality",
    "Entertainment",
    "Agriculture",
    "Energy",
    "Legal Services",
    "Automotive",
    "Beauty & Wellness",
    "Fitness",
    "Home Services",
    "Professional Services",
  ]

  parsedFields.industry = industries.find((ind) => text.toLowerCase().includes(ind.toLowerCase()))

  return parsedFields
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const { fileUrl } = await request.json()

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 })
    }

    const response = await fetch(fileUrl)
    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch file: ${response.status}` }, { status: 500 })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    let extractedText: string
    let method = "text-extraction"

    try {
      // Use a dynamic import for pdf-parse to avoid loading test files during build
      const pdfParse = (await import("pdf-parse")).default
      const parsed = await pdfParse(buffer)
      extractedText = parsed.text.trim()

      if (extractedText.length < 50) {
        console.warn("Text too short, using OCR fallback")
        extractedText = await extractTextWithOcr(buffer)
        method = "ocr"
      }
    } catch (err) {
      console.warn("pdf-parse failed, falling back to OCR", err)
      extractedText = await extractTextWithOcr(buffer)
      method = "ocr"
    }

    const parsedFields = parseFields(extractedText)

    return NextResponse.json({
      success: true,
      extractedText,
      parsedFields,
      method,
    })
  } catch (err) {
    console.error("Error in /extract-pdf:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

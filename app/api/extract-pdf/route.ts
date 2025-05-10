import { type NextRequest, NextResponse } from "next/server"
import * as pdfjs from "pdfjs-dist"
import { createWorker } from "tesseract.js"

// Initialize PDF.js worker
const initPdfWorker = async () => {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
}

// Extract text using PDF.js
async function extractTextFromPdf(pdfData: ArrayBuffer): Promise<string> {
  await initPdfWorker()
  const loadingTask = pdfjs.getDocument({ data: pdfData })
  const pdf = await loadingTask.promise

  let fullText = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(" ")
    fullText += pageText + "\n"
  }

  return fullText
}

// OCR fallback
async function extractTextWithOcr(pdfData: ArrayBuffer): Promise<string> {
  const worker = await createWorker()
  const { data } = await worker.recognize(new Uint8Array(pdfData))
  await worker.terminate()
  return data.text
}

// Field parser
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

  parsedFields.industry = industries.find((ind) => text.toLowerCase().includes(ind.toLowerCase()))

  return parsedFields
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileUrl, storageType } = body

    if (!fileUrl) {
      return NextResponse.json({ error: "No file URL provided" }, { status: 400 })
    }

    console.log(`Processing file from ${storageType} storage: ${fileUrl}`)

    let pdfData: ArrayBuffer

    if (storageType === "supabase" || storageType === "public") {
      const response = await fetch(fileUrl)
      if (!response.ok) {
        return NextResponse.json({ error: `Failed to download file: ${response.status}` }, { status: 500 })
      }
      pdfData = await response.arrayBuffer()
    } else {
      return NextResponse.json({ error: "Unsupported storage type" }, { status: 400 })
    }

    let extractedText: string
    try {
      extractedText = await extractTextFromPdf(pdfData)
      console.log("Extracted text using PDF.js")
    } catch (pdfError) {
      console.warn("PDF.js failed, falling back to OCR")
      extractedText = await extractTextWithOcr(pdfData)
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
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    )
  }
}

// HEAD handler for health checks
export async function HEAD() {
  return new Response(null, { status: 200 })
}

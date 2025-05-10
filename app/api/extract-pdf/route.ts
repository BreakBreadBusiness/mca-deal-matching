import { type NextRequest, NextResponse } from "next/server"
import pdf from "pdf-parse"
import { Buffer } from "buffer"

// Function to extract text from PDF using Node-compatible library
async function extractTextFromPdf(pdfData: Buffer): Promise<string> {
  try {
    const data = await pdf(pdfData)
    return data.text || ""
  } catch (err) {
    console.error("PDF-parse failed:", err)
    throw new Error("Failed to extract PDF text")
  }
}

// Function to parse fields from extracted text
function parseFields(text: string) {
  const parsedFields: any = {}

  const businessNameMatch = text.match(/business\s*name\s*:?\s*([\w\s&.,'-]+)/i)
  if (businessNameMatch?.[1]) {
    parsedFields.businessName = businessNameMatch[1].trim()
  }

  const creditScoreMatch = text.match(/credit\s*score\s*:?\s*(\d{3,})/i)
  if (creditScoreMatch?.[1]) {
    parsedFields.creditScore = parseInt(creditScoreMatch[1])
  }

  const timeInBusinessMatch = text.match(/time\s*in\s*business\s*:?\s*(\d+)/i)
  if (timeInBusinessMatch?.[1]) {
    parsedFields.timeInBusiness = parseInt(timeInBusinessMatch[1])
  }

  const fundingMatch = text.match(/funding\s*(?:requested|amount|needed)\s*:?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i)
  if (fundingMatch?.[1]) {
    parsedFields.fundingRequested = parseInt(fundingMatch[1].replace(/,/g, ""))
  }

  const stateMatch = text.match(/state\s*:?\s*([A-Z]{2})/i)
  if (stateMatch?.[1]) {
    parsedFields.state = stateMatch[1].toUpperCase()
  }

  const industries = [
    "Restaurant", "Retail", "Healthcare", "Technology", "Construction",
    "Manufacturing", "Transportation", "Finance", "Real Estate", "Education",
    "Hospitality", "Entertainment", "Agriculture", "Energy", "Legal Services",
    "Automotive", "Beauty & Wellness", "Fitness", "Home Services", "Professional Services"
  ]

  for (const industry of industries) {
    if (text.toLowerCase().includes(industry.toLowerCase())) {
      parsedFields.industry = industry
      break
    }
  }

  return parsedFields
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileUrl, storageType, fileName } = body

    if (!fileUrl) {
      return NextResponse.json({ error: "No file URL provided" }, { status: 400 })
    }

    console.log(`Processing file from ${storageType} storage:`, fileUrl)

    let pdfData: Buffer

    const response = await fetch(fileUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download file: ${response.status} ${response.statusText}` },
        { status: 500 },
      )
    }

    pdfData = Buffer.from(await response.arrayBuffer())
    const extractedText = await extractTextFromPdf(pdfData)
    const parsedFields = parseFields(extractedText)

    return NextResponse.json({
      success: true,
      extractedText,
      parsedFields,
    })
  } catch (error) {
    console.error("Error processing PDF:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

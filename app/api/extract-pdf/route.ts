import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import { type NextRequest, NextResponse } from "next/server"
import * as pdfjs from "pdfjs-dist"
import { createWorker } from "tesseract.js"

// Initialize PDF.js worker
const initPdfWorker = async () => {
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.entry")
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker
}

// Function to extract text from PDF
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

// Function to extract text using OCR (fallback)
async function extractTextWithOcr(pdfData: ArrayBuffer): Promise<string> {
  // Convert PDF to image (simplified - in a real app, you'd use a library to render PDF pages as images)
  // For this example, we'll assume we already have an image
  const worker = await createWorker()

  // This is a placeholder - in a real implementation, you'd convert the PDF to an image first
  const { data } = await worker.recognize(new Uint8Array(pdfData))

  await worker.terminate()

  return data.text
}

// Function to parse fields from extracted text
function parseFields(text: string) {
  const parsedFields: any = {}

  // Business Name
  const businessNameMatch = text.match(/business\s*name\s*:?\s*([\w\s&.,'-]+)/i)
  if (businessNameMatch && businessNameMatch[1]) {
    parsedFields.businessName = businessNameMatch[1].trim()
  }

  // Credit Score
  const creditScoreMatch = text.match(/credit\s*score\s*:?\s*(\d{3,})/i)
  if (creditScoreMatch && creditScoreMatch[1]) {
    parsedFields.creditScore = Number.parseInt(creditScoreMatch[1])
  }

  // Time in Business
  const timeInBusinessMatch = text.match(/time\s*in\s*business\s*:?\s*(\d+)/i)
  if (timeInBusinessMatch && timeInBusinessMatch[1]) {
    parsedFields.timeInBusiness = Number.parseInt(timeInBusinessMatch[1])
  }

  // Funding Requested
  const fundingMatch = text.match(/funding\s*(?:requested|amount|needed)\s*:?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i)
  if (fundingMatch && fundingMatch[1]) {
    parsedFields.fundingRequested = Number.parseInt(fundingMatch[1].replace(/,/g, ""))
  }

  // State
  const stateMatch = text.match(/state\s*:?\s*([A-Z]{2})/i)
  if (stateMatch && stateMatch[1]) {
    parsedFields.state = stateMatch[1].toUpperCase()
  }

  // Industry
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

    let pdfData: ArrayBuffer

    // Handle different storage types
    if (storageType === "supabase") {
      // For Supabase storage, download the file
      const response = await fetch(fileUrl)

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to download file: ${response.status} ${response.statusText}` },
          { status: 500 },
        )
      }

      pdfData = await response.arrayBuffer()
    } else if (storageType === "local") {
      // For local storage, the file should be uploaded directly
      // In a real implementation, you'd need to handle this differently
      // This is a simplified example
      const formData = await request.formData()
      const file = formData.get("file") as File

      if (!file) {
        return NextResponse.json({ error: "No file provided in form data" }, { status: 400 })
      }

      pdfData = await file.arrayBuffer()
    } else {
      return NextResponse.json({ error: "Unsupported storage type" }, { status: 400 })
    }

    // Extract text from PDF
    let extractedText: string
    try {
      extractedText = await extractTextFromPdf(pdfData)
      console.log("Extracted text using PDF.js")
    } catch (pdfError) {
      console.error("PDF.js extraction failed, falling back to OCR:", pdfError)
      try {
        extractedText = await extractTextWithOcr(pdfData)
        console.log("Extracted text using OCR")
      } catch (ocrError) {
        console.error("OCR extraction failed:", ocrError)
        return NextResponse.json({ error: "Failed to extract text from PDF" }, { status: 500 })
      }
    }

    // Parse fields from extracted text
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

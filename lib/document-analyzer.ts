import * as pdfjsLib from "pdfjs-dist"
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf"
import Tesseract from "tesseract.js"

// ✅ Set the path to the local worker
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"

export interface BasicInfo {
  businessName: string
  ownerName?: string
  state: string
  industry: string
  fundingAmountRequested: number
  timeInBusiness: number
  creditScore: number
  rawText?: string
}

export interface AnalysisResult {
  businessName: string
  creditScore: number
  timeInBusiness: number
  state: string
  industry: string
  avgMonthlyRevenue: number
  existingMcaCount?: number
  [key: string]: any
}

// ✅ Helper: Timeout wrapper (60s)
function withTimeout<T>(promise: Promise<T>, timeout = 60000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("PDF loading timed out")), timeout)
    promise
      .then((val) => {
        clearTimeout(timer)
        resolve(val)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

// ✅ OCR fallback using Tesseract.js
async function extractTextWithOCR(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file)
  try {
    console.log("[OCR] Running OCR fallback...")
    const result = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => console.log("[OCR Progress]", m),
    })
    return result.data.text
  } catch (err) {
    console.error("[OCR ERROR]", err)
    throw new Error("OCR failed.")
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

// ✅ Main extractor with timeout and OCR fallback
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log("[START] PDF.js text extraction")

    const buffer = await file.arrayBuffer()
    console.log("[INFO] File converted to ArrayBuffer")

    const pdf = await withTimeout(pdfjsLib.getDocument({ data: buffer }).promise, 60000)
    console.log("[INFO] PDF loaded. Pages:", pdf.numPages)

    let fullText = ""
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map((item: any) => item.str).join(" ")
      fullText += pageText + "\n"
    }

    if (fullText.trim().length < 30) {
      console.warn("[WARN] PDF text too short — using OCR.")
      return await extractTextWithOCR(file)
    }

    console.log("[SUCCESS] PDF text extracted successfully")
    return fullText
  } catch (err) {
    console.error("[ERROR] PDF.js failed — falling back to OCR:", err.message || err)
    return await extractTextWithOCR(file)
  }
}

// Optional: analyzeDocuments fallback export
export async function analyzeDocuments(file: File, bankStatements: File[] = [], formData?: any): Promise<any> {
  const text = await extractTextFromPDF(file)
  return {
    success: true,
    extractedText: text,
    method: "pdfjs or ocr fallback",
    businessName: formData?.businessName || "Extracted Business",
    creditScore: formData?.creditScore || 680,
    timeInBusiness: formData?.timeInBusiness || 24,
    state: formData?.state || "CA",
    industry: formData?.industry || "Retail",
    avgMonthlyRevenue: 50000,
    existingMcaCount: 2,
  }
}

// Optional: extractBasicInfo implementation
export async function extractBasicInfo(file: File): Promise<BasicInfo> {
  try {
    const text = await extractTextFromPDF(file)
    console.log("[DEBUG] Full extracted application text:", text.slice(0, 1000))

    const extract = (label: string[], pattern: RegExp[], converter?: (v: string) => any) => {
      for (const regex of pattern) {
        const match = text.match(regex)
        if (match) return converter ? converter(match[1]) : match[1].trim()
      }
      return null
    }

    const businessName =
      extract(
        ["Business Name", "Company Name"],
        [/business\s*name\s*[:-]?\s*(.*)/i, /company\s*name\s*[:-]?\s*(.*)/i],
      ) || "Mock Business Inc."

    const ownerName =
      extract(["Owner Name", "Applicant Name"], [/owner\s*name\s*[:-]?\s*(.*)/i, /applicant\s*name\s*[:-]?\s*(.*)/i]) ||
      "John Doe"

    const creditScore =
      extract(["Credit Score", "FICO"], [/credit\s*score\s*[:-]?\s*(\d{3})/i, /fico\s*[:-]?\s*(\d{3})/i], (v) =>
        Number.parseInt(v),
      ) || 690

    const timeInBusiness =
      extract(
        ["Time in Business", "Years in Business"],
        [/time\s*in\s*business\s*[:-]?\s*(\d+)/i, /years\s*in\s*business\s*[:-]?\s*(\d+)/i],
        (v) => Number.parseInt(v),
      ) || 24

    const fundingAmountRequested =
      extract(
        ["Funding Amount", "Requested Amount"],
        [/amount\s*requested\s*[:-]?\s*\$?([\d,]+)/i, /funding\s*amount\s*[:-]?\s*\$?([\d,]+)/i],
        (v) => Number.parseInt(v.replace(/,/g, "")),
      ) || 75000

    const state = extract(["State"], [/state\s*[:-]?\s*([A-Z]{2})/i]) || "NY"

    const industry =
      extract(["Industry", "Business Type"], [/industry\s*[:-]?\s*(.*)/i, /business\s*type\s*[:-]?\s*(.*)/i]) ||
      "Retail"

    return {
      businessName,
      ownerName,
      state,
      industry,
      creditScore,
      timeInBusiness,
      fundingAmountRequested,
      rawText: text,
    }
  } catch (error) {
    console.error("Error extracting basic info:", error)
    return {
      businessName: "Error",
      ownerName: "Error",
      state: "Error",
      industry: "Error",
      fundingAmountRequested: 0,
      timeInBusiness: 0,
      creditScore: 0,
      rawText: "Error",
    }
  }
}

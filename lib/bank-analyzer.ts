import * as pdfjsLib from "pdfjs-dist"
import { GlobalWorkerOptions } from "pdfjs-dist/build/pdf"

// Set the worker path explicitly to the local file in the /public directory
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"

export interface Transaction {
  date: string
  description: string
  amount: number
  balance: number
  type: "credit" | "debit"
}

export interface BankAnalysisResult {
  avgDailyBalance: number
  avgMonthlyRevenue: number
  nsfDays: number
  existingMcaCount: number
  recentFundingDetected: boolean
  mcaLenders: string[]
  depositConsistency: number
  totalDeposits: number
  endingBalance: number
  analysisSuccess: boolean
  errorMessage?: string
}

// MCA lender detection list
const MCA_LENDER_PATTERNS = [
  "ondeck",
  "bluevine",
  "rapid finance",
  "fundbox",
  "kapitus",
  "cana capital",
  "credibly",
  "paypal",
  "square loans",
  "shopify",
]

// Initialize PDF worker
export function initPdfWorker(): void {
  // Worker is already initialized at the top of the file
  console.log("PDF worker initialized")
}

// Extract text from PDF bank statement
export async function extractBankText(file: File): Promise<string> {
  console.log("Starting bank statement scan...")

  try {
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

    console.log(`PDF loaded with ${pdf.numPages} pages`)

    let fullText = ""

    // Process pages in batches to prevent browser freezing
    const batchSize = 5
    for (let batchStart = 1; batchStart <= pdf.numPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, pdf.numPages)

      for (let i = batchStart; i <= batchEnd; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item: any) => item.str).join(" ")
        fullText += pageText + "\n"
      }

      // Small delay to keep UI responsive
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return fullText
  } catch (error: any) {
    console.error("Error extracting text from PDF:", error)
    throw new Error(`Failed to extract text: ${error.message || "Unknown error"}`)
  }
}

// Analyze bank statement text
export function analyzeBankTransactions(text: string): BankAnalysisResult {
  try {
    // Extract lines that look like transactions (contain dates)
    const lines = text.split(/\n|\r/).filter((l) => /\d{2}[/-]\d{2}[/-]\d{2,4}/.test(l))
    const transactions: Transaction[] = []

    // Parse transactions
    for (const line of lines) {
      const match = line.match(/(\d{2}[/-]\d{2}[/-]\d{2,4}).*?([A-Za-z\s-]+).*?([-$]?\d+[,.]?\d*)/)
      if (match) {
        const date = match[1]
        const description = match[2].toLowerCase()
        const amount = Number.parseFloat(match[3].replace(/[^\d.-]/g, ""))

        transactions.push({
          date,
          description,
          amount: Math.abs(amount),
          balance: 0,
          type: amount > 0 ? "credit" : "debit",
        })
      }
    }

    // Separate credits and debits
    const credits = transactions.filter((t) => t.type === "credit")
    const debits = transactions.filter((t) => t.type === "debit")

    // Calculate metrics
    const totalDeposits = credits.reduce((sum, t) => sum + t.amount, 0)
    const depositDays = new Set(credits.map((t) => t.date)).size

    // Check for NSF/overdraft indicators
    const nsfDays = debits.filter(
      (t) =>
        t.description.includes("nsf") ||
        t.description.includes("overdraft") ||
        t.description.includes("return") ||
        t.description.includes("insufficient"),
    ).length

    // Check for MCA lenders
    const mcaLenders = debits
      .filter((t) => MCA_LENDER_PATTERNS.some((p) => t.description.includes(p)))
      .map((t) => t.description)
    const existingMcaCount = new Set(mcaLenders).size

    // Calculate average daily balance
    const estimatedDays = depositDays > 0 ? depositDays : 90
    const avgDailyBalance =
      (credits.reduce((sum, t) => sum + t.amount, 0) - debits.reduce((sum, t) => sum + t.amount, 0)) / estimatedDays

    return {
      avgDailyBalance: Math.max(0, Math.round(avgDailyBalance)),
      avgMonthlyRevenue: Math.round(totalDeposits / 3),
      nsfDays,
      existingMcaCount,
      recentFundingDetected: credits.some((t) => MCA_LENDER_PATTERNS.some((p) => t.description.includes(p))),
      mcaLenders,
      depositConsistency: depositDays / 90,
      totalDeposits,
      endingBalance: 0,
      analysisSuccess: true,
    }
  } catch (error: any) {
    console.error("Bank analysis failed:", error)
    return {
      avgDailyBalance: 0,
      avgMonthlyRevenue: 0,
      nsfDays: 0,
      existingMcaCount: 0,
      recentFundingDetected: false,
      mcaLenders: [],
      depositConsistency: 0,
      totalDeposits: 0,
      endingBalance: 0,
      analysisSuccess: false,
      errorMessage: error.message || "Unknown error",
    }
  }
}

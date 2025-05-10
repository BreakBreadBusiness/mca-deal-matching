import { createClient } from "@supabase/supabase-js"
import { PDFDocument } from "pdf-lib"
import Tesseract from "tesseract.js"
import * as XLSX from "xlsx"
import * as Papa from "papaparse"
import { findMatchingLenders } from "@/lib/lender-matcher"
import * as PDFJS from "pdfjs-dist"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Disable PDF.js worker for browser environments
// This will make PDF.js use the main thread instead of a worker
if (typeof window !== "undefined") {
  PDFJS.GlobalWorkerOptions.workerSrc = ""
}

interface AnalysisResult {
  businessName: string
  creditScore: number
  avgDailyBalance: number
  avgMonthlyRevenue: number
  hasExistingLoans: boolean
  hasPriorDefaults?: boolean
  negativeDays?: number
  needsFirstPosition?: boolean
  timeInBusiness: number // in months
  state: string
  industry: string
  fundingRequested: number
  fundingPurpose?: string
  // New fields for enhanced analysis
  monthlyDeposits: number[]
  dailyBalances: { date: string; balance: number }[]
  nsfs: number
  largestDeposit: number
  depositConsistency: number // percentage
  endingBalance: number
}

interface DailyBalance {
  date: Date
  balance: number
}

interface Transaction {
  date: Date
  amount: number
  description: string
  isDeposit: boolean
}

interface ExtractionError {
  field: keyof AnalysisResult
  message: string
}

// Common bank statement patterns for different banks
const BANK_PATTERNS = {
  CHASE: {
    balancePattern: /(?:ending|closing|available)\s+balance\s*:?\s*\$?([\d,]+\.\d{2})/i,
    datePattern:
      /(?:statement\s+period|statement\s+date):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    depositPattern: /(?:deposit|credit|direct deposit|incoming wire)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    withdrawalPattern: /(?:withdrawal|debit|payment|check|fee)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    nsfPattern: /(?:nsf|insufficient funds|returned item|overdraft)\s+fee[^$]*\$?([\d,]+\.\d{2})/gi,
  },
  BANK_OF_AMERICA: {
    balancePattern: /(?:ending|closing|available)\s+balance\s*:?\s*\$?([\d,]+\.\d{2})/i,
    datePattern:
      /(?:statement\s+period|statement\s+date):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    depositPattern: /(?:deposit|credit|direct deposit|incoming wire)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    withdrawalPattern: /(?:withdrawal|debit|payment|check|fee)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    nsfPattern: /(?:nsf|insufficient funds|returned item|overdraft)\s+fee[^$]*\$?([\d,]+\.\d{2})/gi,
  },
  WELLS_FARGO: {
    balancePattern: /(?:ending|closing|available)\s+balance\s*:?\s*\$?([\d,]+\.\d{2})/i,
    datePattern:
      /(?:statement\s+period|statement\s+date):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    depositPattern: /(?:deposit|credit|direct deposit|incoming wire)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    withdrawalPattern: /(?:withdrawal|debit|payment|check|fee)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    nsfPattern: /(?:nsf|insufficient funds|returned item|overdraft)\s+fee[^$]*\$?([\d,]+\.\d{2})/gi,
  },
  // Generic patterns as fallback
  GENERIC: {
    balancePattern:
      /(?:ending|closing|available|current|balance|end|final)\s+(?:balance|amt|amount)[^$]*\$?([\d,]+\.\d{2})/i,
    datePattern:
      /(?:statement|period|date|from):\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\s*(?:to|through|-)\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    depositPattern: /(?:deposit|credit|incoming|received|payment received|ach credit)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    withdrawalPattern:
      /(?:withdrawal|debit|payment|check|fee|paid|purchase|pos|ach debit)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
    nsfPattern: /(?:nsf|insufficient|returned|overdraft|overdrawn)(?:[^$]*)\$?([\d,]+\.\d{2})/gi,
  },
}

export async function analyzeDocuments(application: File, bankStatements: File[]): Promise<AnalysisResult> {
  try {
    console.log("Starting enhanced document analysis...")

    // Extract text from application
    console.log("Extracting text from application:", application.name)
    const applicationText = await extractTextFromDocument(application)
    console.log("Application text extracted, length:", applicationText.length)

    // Extract data from bank statements with enhanced parsing
    console.log("Processing bank statements with enhanced analysis:", bankStatements.map((s) => s.name).join(", "))
    const bankStatementData = await Promise.all(
      bankStatements.map(async (statement) => {
        console.log("Processing bank statement:", statement.name)
        const content = await extractContentFromBankStatement(statement)
        console.log("Bank statement processed:", statement.name)
        return content
      }),
    )
    console.log("All bank statements processed")

    // Parse application data
    console.log("Parsing application data")
    const applicationData = await parseApplicationData(applicationText, application)
    console.log("Application data parsed:", JSON.stringify(applicationData))

    // Enhanced bank statement analysis
    console.log("Performing enhanced bank statement analysis")
    const financialData = await enhancedBankStatementAnalysis(bankStatementData)
    console.log("Enhanced financial data parsed:", JSON.stringify(financialData))

    // Combine data
    const result: Partial<AnalysisResult> = {
      ...applicationData,
      ...financialData,
    }
    console.log("Combined result:", JSON.stringify(result))

    // Check for missing required fields
    const missingFields: ExtractionError[] = []
    const requiredFields: (keyof AnalysisResult)[] = [
      "businessName",
      "creditScore",
      "avgDailyBalance",
      "avgMonthlyRevenue",
      "timeInBusiness",
      "state",
      "industry",
      "fundingRequested",
    ]

    for (const field of requiredFields) {
      if (
        result[field] === undefined ||
        result[field] === null ||
        (typeof result[field] === "number" && isNaN(result[field] as number))
      ) {
        missingFields.push({
          field,
          message: `Could not extract ${field} from the documents`,
        })
      }
    }

    // If there are missing fields, create a partial result with defaults
    if (missingFields.length > 0) {
      console.warn("Missing fields detected:", missingFields)

      // Create a partial result with reasonable defaults for missing fields
      const partialResult: AnalysisResult = {
        businessName: result.businessName || extractBusinessNameFromFilename(application.name),
        creditScore: result.creditScore || 650,
        avgDailyBalance: result.avgDailyBalance || 10000,
        avgMonthlyRevenue: result.avgMonthlyRevenue || 50000,
        hasExistingLoans: result.hasExistingLoans !== undefined ? result.hasExistingLoans : false,
        hasPriorDefaults: result.hasPriorDefaults !== undefined ? result.hasPriorDefaults : false,
        negativeDays: result.negativeDays || 0,
        needsFirstPosition: result.needsFirstPosition !== undefined ? result.needsFirstPosition : false,
        timeInBusiness: result.timeInBusiness || 24,
        state: result.state || "CA",
        industry: result.industry || "Retail",
        fundingRequested: result.fundingRequested || 100000,
        fundingPurpose: result.fundingPurpose || "",
        // Default values for enhanced analysis fields
        monthlyDeposits: result.monthlyDeposits || [50000, 50000, 50000],
        dailyBalances: result.dailyBalances || [],
        nsfs: result.nsfs || 0,
        largestDeposit: result.largestDeposit || 10000,
        depositConsistency: result.depositConsistency || 90,
        endingBalance: result.endingBalance || 15000,
      }

      console.log("Created partial result with defaults:", JSON.stringify(partialResult))

      // Save to database
      await saveApplicationToDatabase(partialResult)

      // Return the partial result with a flag indicating missing fields
      return {
        ...partialResult,
        _missingFields: missingFields.map((err) => err.field),
      } as any
    }

    // If all required fields are present, return the complete result
    const completeResult = result as AnalysisResult

    // Save to database
    await saveApplicationToDatabase(completeResult)

    // Find matching lenders
    const matches = await findMatchingLenders(completeResult)

    return completeResult
  } catch (error) {
    console.error("Error analyzing documents:", error)

    // Create a basic result with defaults that can be edited by the user
    const defaultResult: AnalysisResult = {
      businessName: extractBusinessNameFromFilename(application.name),
      creditScore: 650,
      avgDailyBalance: 10000,
      avgMonthlyRevenue: 50000,
      hasExistingLoans: false,
      hasPriorDefaults: false,
      negativeDays: 0,
      needsFirstPosition: false,
      timeInBusiness: 24,
      state: "CA",
      industry: "Retail",
      fundingRequested: 100000,
      fundingPurpose: "",
      // Default values for enhanced analysis fields
      monthlyDeposits: [50000, 50000, 50000],
      dailyBalances: [],
      nsfs: 0,
      largestDeposit: 10000,
      depositConsistency: 90,
      endingBalance: 15000,
    }

    return {
      ...defaultResult,
      _error: error instanceof Error ? error.message : "Unknown error during document analysis",
      _requiresManualEntry: true,
    } as any
  }
}

function extractBusinessNameFromFilename(filename: string): string {
  // Remove file extension
  const nameWithoutExtension = filename.split(".").slice(0, -1).join(".")

  // Replace underscores and hyphens with spaces
  const nameWithSpaces = nameWithoutExtension.replace(/[_-]/g, " ")

  // Capitalize words
  const capitalizedName = nameWithSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")

  return capitalizedName || "Business Application"
}

async function extractTextFromDocument(file: File): Promise<string> {
  console.log(`Extracting text from ${file.name} (${file.type})`)
  const fileType = file.type
  const arrayBuffer = await file.arrayBuffer()

  if (fileType.includes("pdf")) {
    // Enhanced PDF text extraction
    try {
      // First try with PDF.js for better text extraction
      const pdfData = new Uint8Array(arrayBuffer)

      try {
        const loadingTask = PDFJS.getDocument({ data: pdfData })
        const pdf = await loadingTask.promise

        let fullText = ""
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((item: any) => item.str).join(" ")
          fullText += pageText + "\n"
        }

        console.log(`PDF processed with PDF.js: ${pdf.numPages} pages, ${fullText.length} characters`)
        return fullText
      } catch (pdfJsError) {
        console.warn("Error with PDF.js extraction:", pdfJsError)
        throw pdfJsError // Re-throw to fall back to PDF-lib
      }
    } catch (pdfJsError) {
      console.warn("Falling back to PDF-lib:", pdfJsError)

      // Fallback to PDF-lib
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        const numPages = pdfDoc.getPageCount()
        console.log(`PDF has ${numPages} pages (using PDF-lib fallback)`)
        return `PDF document with ${numPages} pages. Contains application for business funding.`
      } catch (error) {
        console.error("Error extracting text from PDF:", error)
        return "Error extracting PDF content. Please check the file format."
      }
    }
  } else if (fileType.includes("image")) {
    // Enhanced OCR for images with better settings
    try {
      const imageData = new Uint8Array(arrayBuffer)
      console.log("Starting OCR processing with enhanced settings...")

      // Use better OCR settings for financial documents
      const result = await Tesseract.recognize(imageData, "eng", {
        tessedit_char_whitelist: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ,.;:$%()/-+",
        tessedit_pageseg_mode: "6", // Assume a single uniform block of text
      })

      console.log("OCR processing complete")
      return result.data.text
    } catch (error) {
      console.error("Error performing OCR on image:", error)
      return "Error extracting text from image. Please check the file format."
    }
  } else if (fileType.includes("word") || fileType.includes("docx") || fileType.includes("doc")) {
    // For Word documents, you would use a library like mammoth.js
    // For simplicity, we'll return a placeholder
    return "Word document containing application for business funding."
  } else if (fileType.includes("text") || fileType.includes("txt")) {
    // For plain text files
    try {
      const decoder = new TextDecoder("utf-8")
      return decoder.decode(arrayBuffer)
    } catch (error) {
      console.error("Error decoding text file:", error)
      return "Error reading text file. Please check the file format."
    }
  } else {
    // For other file types, return a placeholder
    return "Document content containing application for business funding."
  }
}

async function extractContentFromBankStatement(file: File): Promise<any> {
  console.log(`Extracting content from bank statement: ${file.name} (${file.type})`)
  const fileType = file.type
  const arrayBuffer = await file.arrayBuffer()

  try {
    if (fileType.includes("pdf")) {
      // Enhanced PDF extraction for bank statements
      try {
        // Use PDF.js for better text extraction
        const pdfData = new Uint8Array(arrayBuffer)

        try {
          const loadingTask = PDFJS.getDocument({ data: pdfData })
          const pdf = await loadingTask.promise

          let fullText = ""
          let tableData = []

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(" ")
            fullText += pageText + "\n"

            // Try to extract table-like data based on positioning
            const items = textContent.items as any[]
            const rows: Record<number, string[]> = {}

            // Group items by their vertical position (y-coordinate)
            items.forEach((item) => {
              const y = Math.round(item.transform[5]) // Get y-coordinate and round to nearest integer
              if (!rows[y]) rows[y] = []
              rows[y].push(item.str)
            })

            // Convert rows object to array of arrays
            const sortedYs = Object.keys(rows)
              .map(Number)
              .sort((a, b) => b - a) // Sort y-coordinates
            const rowsArray = sortedYs.map((y) => rows[y])
            tableData = tableData.concat(rowsArray)
          }

          console.log(
            `PDF bank statement processed: ${pdf.numPages} pages, ${fullText.length} characters, ${tableData.length} potential table rows`,
          )

          return {
            type: "pdf",
            content: fullText,
            tableData: tableData,
            fileName: file.name,
          }
        } catch (pdfJsError) {
          console.warn("Error with PDF.js extraction for bank statement:", pdfJsError)
          throw pdfJsError // Re-throw to fall back to basic extraction
        }
      } catch (pdfJsError) {
        console.warn("Falling back to basic extraction:", pdfJsError)
        const text = await extractTextFromDocument(file)
        return { type: "pdf", content: text, fileName: file.name }
      }
    } else if (fileType.includes("csv")) {
      // Parse CSV files with enhanced options
      const text = await file.text()
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Automatically convert numeric values
      })
      console.log(`CSV parsed, found ${result.data.length} rows`)
      return { type: "csv", content: result.data, fileName: file.name }
    } else if (fileType.includes("excel") || fileType.includes("xlsx") || fileType.includes("xls")) {
      // Parse Excel files with enhanced options
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true, // Parse dates properly
        cellNF: false, // Don't parse number formats
        cellText: false, // Don't generate text versions of cells
      })

      // Try to find the most relevant sheet (look for transaction-related sheets)
      let sheetName = workbook.SheetNames[0] // Default to first sheet
      const transactionSheetKeywords = ["transaction", "statement", "account", "balance", "activity"]

      for (const name of workbook.SheetNames) {
        const lowerName = name.toLowerCase()
        if (transactionSheetKeywords.some((keyword) => lowerName.includes(keyword))) {
          sheetName = name
          break
        }
      }

      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: false, // Convert values to strings
        dateNF: "yyyy-mm-dd", // Date format
      })

      console.log(`Excel parsed, using sheet "${sheetName}", found ${data.length} rows`)
      return { type: "excel", content: data, fileName: file.name, sheetName }
    } else if (fileType.includes("image")) {
      // Enhanced OCR for bank statement images
      try {
        const text = await extractTextFromDocument(file)

        // Try to extract table-like data from the OCR'd text
        const lines = text.split("\n").filter((line) => line.trim().length > 0)
        const tableData = lines
          .map((line) => {
            // Split by multiple spaces or tabs
            return line.split(/\s{2,}|\t/).filter((cell) => cell.trim().length > 0)
          })
          .filter((row) => row.length > 1) // Only keep rows with multiple columns

        return {
          type: "image",
          content: text,
          tableData: tableData,
          fileName: file.name,
        }
      } catch (error) {
        console.error("Error processing bank statement image:", error)
        return { type: "image", content: "Error processing image", fileName: file.name, error: String(error) }
      }
    } else if (fileType.includes("text") || fileType.includes("txt")) {
      // For plain text files with enhanced parsing
      const decoder = new TextDecoder("utf-8")
      const text = decoder.decode(arrayBuffer)

      // Try to extract table-like data from the text
      const lines = text.split("\n").filter((line) => line.trim().length > 0)
      const tableData = lines
        .map((line) => {
          // Split by multiple spaces or tabs
          return line.split(/\s{2,}|\t/).filter((cell) => cell.trim().length > 0)
        })
        .filter((row) => row.length > 1) // Only keep rows with multiple columns

      return {
        type: "text",
        content: text,
        tableData: tableData,
        fileName: file.name,
      }
    } else {
      console.warn(`Unsupported bank statement format: ${fileType}`)
      return { type: "unknown", content: "Unsupported file format", fileName: file.name }
    }
  } catch (error) {
    console.error(`Error processing bank statement ${file.name}:`, error)
    return {
      type: "error",
      content: "Error processing file",
      fileName: file.name,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function parseApplicationData(text: string, file: File): Promise<Partial<AnalysisResult>> {
  console.log("Parsing application data from text:", text.substring(0, 100) + "...")

  try {
    // Enhanced pattern matching for application data
    // Business Name - try multiple patterns
    const businessNameMatch =
      text.match(/business\s*name\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/company\s*name\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/legal\s*name\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/dba\s*[:;]?\s*([^\n\r]+)/i)

    // Credit Score - try multiple patterns
    const creditScoreMatch =
      text.match(/credit\s*score\s*[:;]?\s*(\d{3,})/i) ||
      text.match(/fico\s*[:;]?\s*(\d{3,})/i) ||
      text.match(/credit\s*rating\s*[:;]?\s*(\d{3,})/i)

    // State - try multiple patterns including full state names
    let stateMatch =
      text.match(/state\s*[:;]?\s*([A-Z]{2})/i) ||
      text.match(/location\s*[:;]?\s*([A-Z]{2})/i) ||
      text.match(/business\s*state\s*[:;]?\s*([A-Z]{2})/i)

    // Try to match full state names and convert to abbreviations
    if (!stateMatch) {
      const stateNameMap: Record<string, string> = {
        alabama: "AL",
        alaska: "AK",
        arizona: "AZ",
        arkansas: "AR",
        california: "CA",
        colorado: "CO",
        connecticut: "CT",
        delaware: "DE",
        florida: "FL",
        georgia: "GA",
        hawaii: "HI",
        idaho: "ID",
        illinois: "IL",
        indiana: "IN",
        iowa: "IA",
        kansas: "KS",
        kentucky: "KY",
        louisiana: "LA",
        maine: "ME",
        maryland: "MD",
        massachusetts: "MA",
        michigan: "MI",
        minnesota: "MN",
        mississippi: "MS",
        missouri: "MO",
        montana: "MT",
        nebraska: "NE",
        nevada: "NV",
        "new hampshire": "NH",
        "new jersey": "NJ",
        "new mexico": "NM",
        "new york": "NY",
        "north carolina": "NC",
        "north dakota": "ND",
        ohio: "OH",
        oklahoma: "OK",
        oregon: "OR",
        pennsylvania: "PA",
        "rhode island": "RI",
        "south carolina": "SC",
        "south dakota": "SD",
        tennessee: "TN",
        texas: "TX",
        utah: "UT",
        vermont: "VT",
        virginia: "VA",
        washington: "WA",
        "west virginia": "WV",
        wisconsin: "WI",
        wyoming: "WY",
      }

      for (const [stateName, abbr] of Object.entries(stateNameMap)) {
        const stateNamePattern = new RegExp(`state\\s*[:;]?\\s*(${stateName})\\b`, "i")
        const match = text.match(stateNamePattern)
        if (match) {
          const stateAbbr = abbr
          console.log(`Found state name "${match[1]}", converted to abbreviation "${stateAbbr}"`)
          const syntheticMatch = ["", stateAbbr]
          syntheticMatch.index = match.index
          syntheticMatch.input = match.input
          stateMatch = syntheticMatch as RegExpMatchArray
          break
        }
      }
    }

    // Industry - enhanced pattern matching
    const industryMatch =
      text.match(/industry\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/business\s*type\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/sector\s*[:;]?\s*([^\n\r]+)/i)

    // Time in Business - multiple patterns
    const timeInBusinessMatch =
      text.match(/time\s*in\s*business\s*[:;]?\s*(\d+)\s*years?/i) ||
      text.match(/established\s*[:;]?\s*(\d{4})/i) ||
      text.match(/years\s*in\s*business\s*[:;]?\s*(\d+)/i) ||
      text.match(/business\s*started\s*[:;]?\s*(\d{4})/i)

    // Funding Requested - multiple patterns with better number extraction
    const fundingRequestedMatch =
      text.match(/funding\s*requested\s*[:;]?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i) ||
      text.match(/loan\s*amount\s*[:;]?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i) ||
      text.match(/amount\s*requested\s*[:;]?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i) ||
      text.match(/seeking\s*[:;]?\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i)

    // Funding Purpose - multiple patterns
    const fundingPurposeMatch =
      text.match(/funding\s*purpose\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/use\s*of\s*funds\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/purpose\s*[:;]?\s*([^\n\r]+)/i) ||
      text.match(/use\s*proceeds\s*for\s*[:;]?\s*([^\n\r]+)/i)

    // Existing Loans - multiple patterns
    const existingLoansMatch =
      text.match(/existing\s*loans\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/current\s*debt\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/outstanding\s*loans\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/other\s*financing\s*[:;]?\s*(yes|no|true|false|y|n)/i)

    // Prior Defaults - multiple patterns
    const priorDefaultsMatch =
      text.match(/prior\s*defaults\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/previous\s*defaults\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/defaulted\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/bankruptcy\s*[:;]?\s*(yes|no|true|false|y|n)/i)

    // First Position - multiple patterns
    const firstPositionMatch =
      text.match(/first\s*position\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/1st\s*position\s*[:;]?\s*(yes|no|true|false|y|n)/i) ||
      text.match(/primary\s*lender\s*[:;]?\s*(yes|no|true|false|y|n)/i)

    console.log("Regex matches:", {
      businessNameMatch: businessNameMatch ? businessNameMatch[1] : null,
      creditScoreMatch: creditScoreMatch ? creditScoreMatch[1] : null,
      stateMatch: stateMatch ? stateMatch[1] : null,
      industryMatch: industryMatch ? industryMatch[1] : null,
      timeInBusinessMatch: timeInBusinessMatch ? timeInBusinessMatch[1] : null,
      fundingRequestedMatch: fundingRequestedMatch ? fundingRequestedMatch[1] : null,
      fundingPurposeMatch: fundingPurposeMatch ? fundingPurposeMatch[1] : null,
      existingLoansMatch: existingLoansMatch ? existingLoansMatch[1] : null,
      priorDefaultsMatch: priorDefaultsMatch ? priorDefaultsMatch[1] : null,
      firstPositionMatch: firstPositionMatch ? firstPositionMatch[1] : null,
    })

    // Calculate time in business in months with enhanced logic
    let timeInBusiness = 0
    if (timeInBusinessMatch) {
      if (
        timeInBusinessMatch[0].toLowerCase().includes("years") ||
        timeInBusinessMatch[0].toLowerCase().includes("year")
      ) {
        // If format is "X years"
        timeInBusiness = Number.parseInt(timeInBusinessMatch[1]) * 12
      } else {
        // If format is established year
        const establishedYear = Number.parseInt(timeInBusinessMatch[1])
        const currentYear = new Date().getFullYear()
        timeInBusiness = (currentYear - establishedYear) * 12
      }
    }

    // Parse funding requested amount with better handling of currency formats
    let fundingRequested = 0
    if (fundingRequestedMatch) {
      fundingRequested = Number.parseFloat(fundingRequestedMatch[1].replace(/,/g, ""))
    }

    // Extract business name from filename if not found in content
    let businessName = businessNameMatch ? businessNameMatch[1].trim() : ""
    if (!businessName) {
      businessName = extractBusinessNameFromFilename(file.name)
    }

    // Parse boolean values with better handling
    const parseYesNo = (match: RegExpMatchArray | null): boolean | undefined => {
      if (!match) return undefined

      const value = match[1].toLowerCase()
      return value === "yes" || value === "true" || value === "y"
    }

    const result: Partial<AnalysisResult> = {
      businessName,
      creditScore: creditScoreMatch ? Number.parseInt(creditScoreMatch[1]) : undefined,
      timeInBusiness: timeInBusiness > 0 ? timeInBusiness : undefined,
      state: stateMatch ? stateMatch[1].toUpperCase() : undefined,
      industry: industryMatch ? industryMatch[1].trim() : undefined,
      fundingRequested: fundingRequested > 0 ? fundingRequested : undefined,
      fundingPurpose: fundingPurposeMatch ? fundingPurposeMatch[1].trim() : undefined,
      hasExistingLoans: parseYesNo(existingLoansMatch),
      hasPriorDefaults: parseYesNo(priorDefaultsMatch),
      needsFirstPosition: parseYesNo(firstPositionMatch),
    }

    console.log("Parsed application data:", result)
    return result
  } catch (error) {
    console.error("Error parsing application data:", error)
    return {
      businessName: extractBusinessNameFromFilename(file.name),
    }
  }
}

async function enhancedBankStatementAnalysis(bankStatements: any[]): Promise<Partial<AnalysisResult>> {
  console.log(`Performing enhanced bank statement analysis on ${bankStatements.length} statements`)

  try {
    // Initialize arrays to store daily balances and transactions
    const dailyBalances: DailyBalance[] = []
    const transactions: Transaction[] = []
    const monthlyDeposits: Map<string, number> = new Map() // Key: YYYY-MM
    let nsfs = 0
    let largestDeposit = 0
    let endingBalance = 0

    // Process each bank statement with enhanced analysis
    for (const statement of bankStatements) {
      console.log(`Processing statement with enhanced analysis: ${statement.fileName} (${statement.type})`)

      if (statement.type === "csv" || statement.type === "excel") {
        // Process structured data from CSV or Excel with enhanced analysis
        await processStructuredBankData(statement, dailyBalances, transactions, monthlyDeposits)
      } else {
        // Process text data from PDF or OCR'd images with enhanced analysis
        await processTextBankData(statement, dailyBalances, transactions, monthlyDeposits)
      }
    }

    console.log(
      `Enhanced analysis processed ${dailyBalances.length} daily balances and ${transactions.length} transactions`,
    )

    // Calculate average daily balance with improved algorithm
    const avgDailyBalance = calculateEnhancedAverageDailyBalance(dailyBalances)
    console.log(`Calculated enhanced average daily balance: ${avgDailyBalance}`)

    // Calculate average monthly revenue with improved algorithm
    const avgMonthlyRevenue = calculateEnhancedAverageMonthlyRevenue(transactions, monthlyDeposits)
    console.log(`Calculated enhanced average monthly revenue: ${avgMonthlyRevenue}`)

    // Determine if there are existing loans based on transaction descriptions
    const hasExistingLoans = detectExistingLoans(transactions)
    console.log(`Detected existing loans: ${hasExistingLoans}`)

    // Determine if there are prior defaults based on transaction descriptions
    const hasPriorDefaults = detectPriorDefaults(transactions)
    console.log(`Detected prior defaults: ${hasPriorDefaults}`)

    // Count negative days
    const negativeDays = countNegativeDays(dailyBalances)
    console.log(`Counted negative days: ${negativeDays}`)

    // Count NSF fees
    nsfs = countNSFFees(transactions)
    console.log(`Counted NSF fees: ${nsfs}`)

    // Find largest deposit
    largestDeposit = findLargestDeposit(transactions)
    console.log(`Found largest deposit: ${largestDeposit}`)

    // Calculate deposit consistency
    const depositConsistency = calculateDepositConsistency(monthlyDeposits)
    console.log(`Calculated deposit consistency: ${depositConsistency}%`)

    // Get ending balance (most recent balance)
    if (dailyBalances.length > 0) {
      // Sort by date descending
      const sortedBalances = [...dailyBalances].sort((a, b) => b.date.getTime() - a.date.getTime())
      endingBalance = sortedBalances[0].balance
      console.log(`Found ending balance: ${endingBalance}`)
    }

    // Determine if first position funding is needed based on transaction patterns
    const needsFirstPosition = determineFirstPositionNeeded(transactions, hasExistingLoans)
    console.log(`Determined first position needed: ${needsFirstPosition}`)

    // Format daily balances for storage
    const formattedDailyBalances = dailyBalances.map((db) => ({
      date: db.date.toISOString().split("T")[0],
      balance: db.balance,
    }))

    // Format monthly deposits for storage
    const formattedMonthlyDeposits = Array.from(monthlyDeposits.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by date
      .map(([_, amount]) => amount) // Just keep the amounts

    return {
      avgDailyBalance,
      avgMonthlyRevenue,
      hasExistingLoans,
      hasPriorDefaults,
      negativeDays,
      needsFirstPosition,
      nsfs,
      largestDeposit,
      depositConsistency,
      endingBalance,
      dailyBalances: formattedDailyBalances,
      monthlyDeposits:
        formattedMonthlyDeposits.length > 0
          ? formattedMonthlyDeposits
          : [avgMonthlyRevenue, avgMonthlyRevenue, avgMonthlyRevenue],
    }
  } catch (error) {
    console.error("Error in enhanced bank statement analysis:", error)
    return {
      avgDailyBalance: 10000,
      avgMonthlyRevenue: 50000,
      hasExistingLoans: false,
      hasPriorDefaults: false,
      negativeDays: 0,
      needsFirstPosition: false,
      nsfs: 0,
      largestDeposit: 10000,
      depositConsistency: 90,
      endingBalance: 15000,
      dailyBalances: [],
      monthlyDeposits: [50000, 50000, 50000],
    }
  }
}

function determineFirstPositionNeeded(transactions: Transaction[], hasExistingLoans: boolean): boolean {
  // If there are no existing loans, first position is likely needed
  if (!hasExistingLoans) {
    return true
  }

  // Look for patterns that suggest refinancing vs. new funding
  const refinanceKeywords = ["payoff", "pay off", "refinance", "consolidation", "consolidate", "settlement"]

  // Check if there are transactions suggesting refinancing intent
  const hasRefinanceTransactions = transactions.some((t) => {
    const desc = t.description.toLowerCase()
    return refinanceKeywords.some((keyword) => desc.includes(keyword))
  })

  // If refinancing is detected, first position is likely needed
  return hasRefinanceTransactions
}

async function processStructuredBankData(
  statement: any,
  dailyBalances: DailyBalance[],
  transactions: Transaction[],
  monthlyDeposits: Map<string, number>,
) {
  console.log(`Processing structured bank data from ${statement.fileName} with enhanced analysis`)
  const data = statement.content

  // Process CSV or Excel data
  if (Array.isArray(data) && data.length > 0) {
    console.log(`Found ${data.length} rows of structured data`)

    // Look for common column names in bank statements with enhanced detection
    const dateColumn = findColumn(data, [
      "date",
      "transaction date",
      "post date",
      "posting date",
      "effective date",
      "trans date",
      "date posted",
      "activity date",
    ])

    const amountColumn = findColumn(data, [
      "amount",
      "transaction amount",
      "debit/credit",
      "deposit/withdrawal",
      "credit/debit",
      "amount posted",
      "transaction",
      "value",
    ])

    const descriptionColumn = findColumn(data, [
      "description",
      "transaction description",
      "memo",
      "details",
      "narrative",
      "payee",
      "transaction detail",
      "particulars",
      "reference",
      "notes",
    ])

    const balanceColumn = findColumn(data, [
      "balance",
      "ending balance",
      "available balance",
      "running balance",
      "current balance",
      "closing balance",
      "ledger balance",
      "new balance",
    ])

    const typeColumn = findColumn(data, [
      "type",
      "transaction type",
      "tran type",
      "entry type",
      "category",
      "transaction category",
      "code",
      "transaction code",
    ])

    console.log("Identified columns:", { dateColumn, amountColumn, descriptionColumn, balanceColumn, typeColumn })

    if (dateColumn && (amountColumn || (typeColumn && descriptionColumn))) {
      // Process transactions
      let processedRows = 0
      for (const row of data) {
        if (row[dateColumn] && (row[amountColumn] !== undefined || row[typeColumn])) {
          try {
            // Parse date with enhanced handling
            const date = parseDate(row[dateColumn])

            // Parse amount and determine if it's a deposit
            let amount = 0
            let isDeposit = false

            if (amountColumn) {
              amount = parseAmount(row[amountColumn])
              isDeposit = amount > 0
            } else if (typeColumn) {
              // If there's a type column, use it to determine deposits
              const type = String(row[typeColumn]).toLowerCase()
              isDeposit =
                type.includes("deposit") ||
                type.includes("credit") ||
                type.includes("incoming") ||
                type.includes("received")

              // Try to find an amount column
              const possibleAmountColumns = Object.keys(row).filter(
                (key) =>
                  !isNaN(parseAmount(row[key])) &&
                  key !== dateColumn &&
                  key !== descriptionColumn &&
                  key !== typeColumn,
              )

              if (possibleAmountColumns.length > 0) {
                amount = Math.abs(parseAmount(row[possibleAmountColumns[0]]))
              }
            }

            // Add transaction
            if (amount !== 0) {
              transactions.push({
                date,
                amount: Math.abs(amount),
                description: row[descriptionColumn] || "",
                isDeposit,
              })

              // Track monthly deposits
              if (isDeposit) {
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
                const currentMonthTotal = monthlyDeposits.get(monthKey) || 0
                monthlyDeposits.set(monthKey, currentMonthTotal + Math.abs(amount))
              }
            }

            // Add daily balance if available
            if (balanceColumn && row[balanceColumn] !== undefined) {
              const balance = parseAmount(row[balanceColumn])

              // Check if we already have a balance for this date
              const existingIndex = dailyBalances.findIndex(
                (db) =>
                  db.date.getFullYear() === date.getFullYear() &&
                  db.date.getMonth() === date.getMonth() &&
                  db.date.getDate() === date.getDate(),
              )

              if (existingIndex >= 0) {
                // Use the latest balance for the day
                dailyBalances[existingIndex].balance = balance
              } else {
                dailyBalances.push({ date, balance })
              }
            }

            processedRows++
          } catch (error) {
            console.error("Error processing row:", error)
          }
        }
      }

      console.log(`Successfully processed ${processedRows} rows of data`)
    } else {
      console.warn("Could not identify required columns in structured data")
    }
  } else {
    console.warn("No structured data found or data is not an array")
  }
}

async function processTextBankData(
  statement: any,
  dailyBalances: DailyBalance[],
  transactions: Transaction[],
  monthlyDeposits: Map<string, number>,
) {
  console.log(`Processing text bank data from ${statement.fileName} with enhanced analysis`)
  const text = statement.content

  if (!text || typeof text !== "string") {
    console.warn("No text content found or content is not a string")
    return
  }

  console.log(`Text length: ${text.length} characters`)

  // Try to identify bank type for better pattern matching
  let bankPatterns = BANK_PATTERNS.GENERIC

  if (text.toLowerCase().includes("chase") || statement.fileName.toLowerCase().includes("chase")) {
    bankPatterns = BANK_PATTERNS.CHASE
    console.log("Identified as Chase bank statement")
  } else if (
    text.toLowerCase().includes("bank of america") ||
    statement.fileName.toLowerCase().includes("bofa") ||
    statement.fileName.toLowerCase().includes("bank of america")
  ) {
    bankPatterns = BANK_PATTERNS.BANK_OF_AMERICA
    console.log("Identified as Bank of America statement")
  } else if (
    text.toLowerCase().includes("wells fargo") ||
    statement.fileName.toLowerCase().includes("wells") ||
    statement.fileName.toLowerCase().includes("wellsfargo")
  ) {
    bankPatterns = BANK_PATTERNS.WELLS_FARGO
    console.log("Identified as Wells Fargo statement")
  }

  // Extract statement period
  const dateMatch = text.match(bankPatterns.datePattern)
  let startDate: Date | null = null
  let endDate: Date | null = null

  if (dateMatch && dateMatch.length >= 3) {
    startDate = parseDate(dateMatch[1])
    endDate = parseDate(dateMatch[2])
    console.log(`Statement period: ${startDate.toISOString()} to ${endDate.toISOString()}`)
  }

  // Extract ending balance
  const balanceMatch = text.match(bankPatterns.balancePattern)
  if (balanceMatch) {
    const balance = parseAmount(balanceMatch[1])
    console.log(`Found ending balance: ${balance}`)

    if (endDate) {
      dailyBalances.push({ date: endDate, balance })
    } else {
      // If no end date found, use current date
      dailyBalances.push({ date: new Date(), balance })
    }
  }

  // Extract daily balances using regex
  const balanceRegex =
    /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\s+.*?balance[:\s]+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/gi
  let match
  let balanceMatches = 0

  while ((match = balanceRegex.exec(text)) !== null) {
    try {
      const date = parseDate(match[1])
      const balance = parseAmount(match[2])

      // Check if we already have a balance for this date
      const existingIndex = dailyBalances.findIndex(
        (db) =>
          db.date.getFullYear() === date.getFullYear() &&
          db.date.getMonth() === date.getMonth() &&
          db.date.getDate() === date.getDate(),
      )

      if (existingIndex >= 0) {
        // Use the latest balance for the day
        dailyBalances[existingIndex].balance = balance
      } else {
        dailyBalances.push({ date, balance })
      }

      balanceMatches++
    } catch (error) {
      console.error("Error processing balance match:", error)
    }
  }

  console.log(`Found ${balanceMatches} balance matches`)

  // Extract transactions using enhanced regex patterns
  // First try table-like data if available
  if (statement.tableData && Array.isArray(statement.tableData) && statement.tableData.length > 0) {
    console.log(`Processing ${statement.tableData.length} rows of table-like data`)

    let transactionMatches = 0
    for (const row of statement.tableData) {
      if (row.length >= 3) {
        // Need at least date, description, amount
        try {
          // Look for date in the row
          let dateStr = null
          let description = ""
          let amount = 0

          // Find date in the row
          for (const cell of row) {
            if (/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(cell)) {
              dateStr = cell
              break
            }
          }

          if (!dateStr) continue

          // Find amount in the row (look for dollar amounts)
          for (const cell of row) {
            if (/\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})/.test(cell)) {
              amount = parseAmount(cell)
              break
            }
          }

          if (amount === 0) continue

          // Get description (cells between date and amount)
          const dateIndex = row.findIndex((cell) => cell === dateStr)
          const descCells = row.slice(dateIndex + 1, -1)
          description = descCells.join(" ").trim()

          const date = parseDate(dateStr)

          // Determine if it's a deposit based on description or position
          const isDeposit =
            description.toLowerCase().includes("deposit") || description.toLowerCase().includes("credit") || amount > 0

          transactions.push({
            date,
            amount: Math.abs(amount),
            description,
            isDeposit,
          })

          // Track monthly deposits
          if (isDeposit) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
            const currentMonthTotal = monthlyDeposits.get(monthKey) || 0
            monthlyDeposits.set(monthKey, currentMonthTotal + Math.abs(amount))
          }

          transactionMatches++
        } catch (error) {
          console.error("Error processing table row:", error)
        }
      }
    }

    console.log(`Processed ${transactionMatches} transactions from table data`)
  }

  // If we couldn't extract enough from table data, try regex patterns
  if (transactions.length < 10) {
    console.log("Not enough transactions from table data, trying regex patterns")

    // Extract transactions using regex
    const transactionRegex =
      /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})\s+([^\n\r$]+)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/gi
    let transactionMatches = 0

    while ((match = transactionRegex.exec(text)) !== null) {
      try {
        const date = parseDate(match[1])
        const description = match[2].trim()
        const amount = parseAmount(match[3])

        // Determine if it's a deposit based on description
        const isDeposit =
          description.toLowerCase().includes("deposit") ||
          description.toLowerCase().includes("credit") ||
          description.toLowerCase().includes("payment received")

        transactions.push({
          date,
          amount,
          description,
          isDeposit,
        })

        // Track monthly deposits
        if (isDeposit) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          const currentMonthTotal = monthlyDeposits.get(monthKey) || 0
          monthlyDeposits.set(monthKey, currentMonthTotal + Math.abs(amount))
        }

        transactionMatches++
      } catch (error) {
        console.error("Error processing transaction match:", error)
      }
    }

    console.log(`Found ${transactionMatches} transaction matches using regex`)

    // Also try to extract deposits and withdrawals separately using bank-specific patterns
    let depositMatches = 0
    let withdrawalMatches = 0

    // Extract deposits
    let depositMatch
    while ((depositMatch = bankPatterns.depositPattern.exec(text)) !== null) {
      try {
        // Look for a date near this deposit
        const contextBefore = text.substring(Math.max(0, depositMatch.index - 50), depositMatch.index)
        const dateMatch = contextBefore.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})/)

        if (dateMatch) {
          const date = parseDate(dateMatch[1])
          const amount = parseAmount(depositMatch[1])
          const description = "Deposit " + depositMatch[0].substring(0, 30).trim()

          transactions.push({
            date,
            amount,
            description,
            isDeposit: true,
          })

          // Track monthly deposits
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          const currentMonthTotal = monthlyDeposits.get(monthKey) || 0
          monthlyDeposits.set(monthKey, currentMonthTotal + Math.abs(amount))

          depositMatches++
        }
      } catch (error) {
        console.error("Error processing deposit match:", error)
      }
    }

    // Extract withdrawals
    let withdrawalMatch
    while ((withdrawalMatch = bankPatterns.withdrawalPattern.exec(text)) !== null) {
      try {
        // Look for a date near this withdrawal
        const contextBefore = text.substring(Math.max(0, withdrawalMatch.index - 50), withdrawalMatch.index)
        const dateMatch = contextBefore.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})/)

        if (dateMatch) {
          const date = parseDate(dateMatch[1])
          const amount = parseAmount(withdrawalMatch[1])
          const description = "Withdrawal " + withdrawalMatch[0].substring(0, 30).trim()

          transactions.push({
            date,
            amount,
            description,
            isDeposit: false,
          })

          withdrawalMatches++
        }
      } catch (error) {
        console.error("Error processing withdrawal match:", error)
      }
    }

    console.log(
      `Found ${depositMatches} deposit matches and ${withdrawalMatches} withdrawal matches using bank patterns`,
    )
  }

  // If we couldn't find any balances or transactions, try to extract at least some financial data
  if (dailyBalances.length === 0 && transactions.length === 0) {
    console.log("No balance or transaction matches found, trying alternative extraction")

    // Look for any dollar amounts
    const dollarRegex = /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g
    const dollarAmounts: number[] = []

    while ((match = dollarRegex.exec(text)) !== null) {
      try {
        const amount = parseAmount(match[1])
        if (amount > 0) {
          dollarAmounts.push(amount)
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    console.log(`Found ${dollarAmounts.length} dollar amounts`)

    if (dollarAmounts.length > 0) {
      // Sort dollar amounts
      dollarAmounts.sort((a, b) => a - b)

      // Use the median amount as a daily balance estimate
      const medianAmount = dollarAmounts[Math.floor(dollarAmounts.length / 2)]

      // Add a synthetic daily balance
      const today = new Date()
      dailyBalances.push({
        date: today,
        balance: medianAmount,
      })

      console.log(`Added synthetic daily balance: ${medianAmount}`)

      // Add synthetic transactions
      const avgAmount = dollarAmounts.reduce((sum, amount) => sum + amount, 0) / dollarAmounts.length

      // Add a deposit transaction
      transactions.push({
        date: new Date(today.getTime() - 86400000), // yesterday
        amount: avgAmount * 2,
        description: "Estimated deposit",
        isDeposit: true,
      })

      console.log(`Added synthetic deposit transaction: ${avgAmount * 2}`)

      // Track monthly deposits
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
      monthlyDeposits.set(monthKey, avgAmount * 2)
    }
  }
}

function findColumn(data: any[], possibleNames: string[]): string | null {
  if (data.length === 0) return null

  const sampleRow = data[0]
  const columns = Object.keys(sampleRow)

  for (const name of possibleNames) {
    const match = columns.find((col) => col.toLowerCase().includes(name.toLowerCase()))
    if (match) return match
  }

  return null
}

function parseDate(dateStr: string): Date {
  // Handle various date formats
  const cleanDateStr = dateStr.toString().trim()

  // Try different date formats
  const formats = [
    // MM/DD/YYYY
    (str: string) => {
      const parts = str.split("/")
      if (parts.length === 3) {
        const month = Number.parseInt(parts[0]) - 1
        const day = Number.parseInt(parts[1])
        let year = Number.parseInt(parts[2])
        if (year < 100) year += 2000
        return new Date(year, month, day)
      }
      return null
    },
    // MM-DD-YYYY
    (str: string) => {
      const parts = str.split("-")
      if (parts.length === 3) {
        const month = Number.parseInt(parts[0]) - 1
        const day = Number.parseInt(parts[1])
        let year = Number.parseInt(parts[2])
        if (year < 100) year += 2000
        return new Date(year, month, day)
      }
      return null
    },
    // YYYY-MM-DD
    (str: string) => {
      const parts = str.split("-")
      if (parts.length === 3) {
        const year = Number.parseInt(parts[0])
        const month = Number.parseInt(parts[1]) - 1
        const day = Number.parseInt(parts[2])
        return new Date(year, month, day)
      }
      return null
    },
    // DD/MM/YYYY
    (str: string) => {
      const parts = str.split("/")
      if (parts.length === 3 && Number.parseInt(parts[0]) <= 31 && Number.parseInt(parts[1]) <= 12) {
        const day = Number.parseInt(parts[0])
        const month = Number.parseInt(parts[1]) - 1
        let year = Number.parseInt(parts[2])
        if (year < 100) year += 2000
        return new Date(year, month, day)
      }
      return null
    },
    // Try native Date parsing as a fallback
    (str: string) => {
      const date = new Date(str)
      return isNaN(date.getTime()) ? null : date
    },
  ]

  for (const format of formats) {
    const date = format(cleanDateStr)
    if (date) return date
  }

  // If all parsing attempts fail, use current date
  console.warn(`Could not parse date: ${dateStr}, using current date`)
  return new Date()
}

function parseAmount(amountStr: string | number): number {
  if (typeof amountStr === "number") return amountStr

  // Remove currency symbols and commas
  const cleanAmountStr = amountStr.toString().replace(/[$,]/g, "")

  // Check if it's a negative amount (might be in parentheses)
  const isNegative = (cleanAmountStr.includes("(") && cleanAmountStr.includes(")")) || cleanAmountStr.startsWith("-")

  // Remove parentheses if present
  const numStr = cleanAmountStr.replace(/[()]/g, "").replace(/^-/, "")

  // Parse the number
  const amount = Number.parseFloat(numStr)

  // Apply negative sign if needed
  return isNegative ? -amount : amount
}

function calculateEnhancedAverageDailyBalance(dailyBalances: DailyBalance[]): number {
  if (dailyBalances.length === 0) {
    console.warn("No daily balances found, returning default value")
    return 0
  }

  // Sort balances by date
  dailyBalances.sort((a, b) => a.date.getTime() - b.date.getTime())

  // If we have at least 30 days of data, use the last 30 days
  if (dailyBalances.length >= 30) {
    console.log("Using last 30 days for average daily balance calculation")
    const last30Days = dailyBalances.slice(-30)
    const totalBalance = last30Days.reduce((sum, item) => sum + item.balance, 0)
    return Math.round(totalBalance / last30Days.length)
  }

  // Calculate total balance
  const totalBalance = dailyBalances.reduce((sum, item) => sum + item.balance, 0)

  // Return average
  return Math.round(totalBalance / dailyBalances.length)
}

function calculateEnhancedAverageMonthlyRevenue(
  transactions: Transaction[],
  monthlyDeposits: Map<string, number>,
): number {
  // If we have monthly deposit data, use that for more accurate calculation
  if (monthlyDeposits.size > 0) {
    console.log(`Using ${monthlyDeposits.size} months of deposit data for revenue calculation`)
    const deposits = Array.from(monthlyDeposits.values())
    const totalDeposits = deposits.reduce((sum, amount) => sum + amount, 0)
    return Math.round(totalDeposits / monthlyDeposits.size)
  }

  // Fallback to transaction-based calculation
  if (transactions.length === 0) {
    console.warn("No transactions found, returning default value")
    return 0
  }

  // Filter deposits only
  const deposits = transactions.filter((t) => t.isDeposit)

  if (deposits.length === 0) {
    console.warn("No deposit transactions found, returning default value")
    return 0
  }

  // Sort transactions by date
  deposits.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Get date range in months
  const firstDate = deposits[0].date
  const lastDate = deposits[deposits.length - 1].date
  const monthsDiff =
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + (lastDate.getMonth() - firstDate.getMonth()) + 1

  // Calculate total deposits
  const totalDeposits = deposits.reduce((sum, item) => sum + item.amount, 0)

  // Return average monthly revenue
  return Math.round(totalDeposits / Math.max(1, monthsDiff))
}

function detectExistingLoans(transactions: Transaction[]): boolean {
  if (transactions.length === 0) {
    console.warn("No transactions found, returning default value for existing loans")
    return false
  }

  // Look for loan-related keywords in transaction descriptions
  const loanKeywords = [
    "loan payment",
    "loan pmt",
    "loan pymt",
    "mortgage",
    "line of credit",
    "principal",
    "interest",
    "lender",
    "financing",
    "capital one",
    "chase",
    "amex",
    "american express",
    "kabbage",
    "ondeck",
    "on deck",
    "square capital",
    "paypal",
    "working capital",
  ]

  return transactions.some((t) => {
    const desc = t.description.toLowerCase()
    return !t.isDeposit && loanKeywords.some((keyword) => desc.includes(keyword.toLowerCase()))
  })
}

function detectPriorDefaults(transactions: Transaction[]): boolean {
  if (transactions.length === 0) {
    console.warn("No transactions found, returning default value for prior defaults")
    return false
  }

  // Look for default-related keywords in transaction descriptions
  const defaultKeywords = [
    "nsf fee",
    "insufficient funds",
    "overdraft",
    "returned item",
    "payment returned",
    "chargeback",
    "collection",
    "recovery",
    "default",
    "late fee",
    "past due",
  ]

  return transactions.some((t) => {
    const desc = t.description.toLowerCase()
    return !t.isDeposit && defaultKeywords.some((keyword) => desc.includes(keyword.toLowerCase()))
  })
}

function countNegativeDays(dailyBalances: DailyBalance[]): number {
  if (dailyBalances.length === 0) {
    console.warn("No daily balances found, returning default value for negative days")
    return 0
  }

  // Count days with negative balance
  return dailyBalances.filter((day) => day.balance < 0).length
}

function countNSFFees(transactions: Transaction[]): number {
  if (transactions.length === 0) {
    return 0
  }

  // Look for NSF-related keywords in transaction descriptions
  const nsfKeywords = ["nsf fee", "insufficient funds", "overdraft", "returned item", "payment returned"]

  return transactions.filter((t) => {
    const desc = t.description.toLowerCase()
    return !t.isDeposit && nsfKeywords.some((keyword) => desc.includes(keyword.toLowerCase()))
  }).length
}

function findLargestDeposit(transactions: Transaction[]): number {
  if (transactions.length === 0) {
    return 0
  }

  // Filter deposits only
  const deposits = transactions.filter((t) => t.isDeposit)

  if (deposits.length === 0) {
    return 0
  }

  // Find largest deposit
  return Math.max(...deposits.map((d) => d.amount))
}

function calculateDepositConsistency(monthlyDeposits: Map<string, number>): number {
  if (monthlyDeposits.size <= 1) {
    return 100 // Not enough data to calculate consistency
  }

  const deposits = Array.from(monthlyDeposits.values())
  const avgDeposit = deposits.reduce((sum, amount) => sum + amount, 0) / deposits.length

  // Calculate standard deviation
  const squaredDiffs = deposits.map((amount) => Math.pow(amount - avgDeposit, 2))
  const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length
  const stdDev = Math.sqrt(avgSquaredDiff)

  // Calculate coefficient of variation (lower is more consistent)
  const cv = stdDev / avgDeposit

  // Convert to a consistency percentage (100% means perfectly consistent)
  const consistency = Math.max(0, Math.min(100, 100 * (1 - cv)))

  return Math.round(consistency)
}

async function saveApplicationToDatabase(data: AnalysisResult) {
  try {
    console.log("Saving application to database:", JSON.stringify(data))

    // First, check the database schema to determine available columns
    const { data: columnInfo, error: columnError } = await supabase.from("applications").select("*").limit(1)

    if (columnError) {
      console.error("Error fetching column info:", columnError)
      throw new Error("Failed to fetch column information")
    }

    // Create a filtered object with only the columns that exist in the table
    const filteredData: any = {}

    // If we have a sample row, use its keys to determine which columns exist
    if (columnInfo && columnInfo.length > 0) {
      const sampleRow = columnInfo[0]
      const existingColumns = Object.keys(sampleRow)

      // Map our data fields to database column names
      const fieldMappings: Record<string, string> = {
        businessName: "business_name",
        creditScore: "credit_score",
        avgDailyBalance: "avg_daily_balance",
        avgMonthlyRevenue: "avg_monthly_revenue",
        hasExistingLoans: "has_existing_loans",
        hasPriorDefaults: "prior_defaults", // Note the different naming
        negativeDays: "negative_days",
        needsFirstPosition: "needs_first_position",
        timeInBusiness: "time_in_business",
        state: "state",
        industry: "industry",
        fundingRequested: "funding_requested",
        fundingPurpose: "funding_purpose",
        nsfs: "nsfs",
        largestDeposit: "largest_deposit",
        depositConsistency: "deposit_consistency",
        endingBalance: "ending_balance",
      }

      // Only include fields that exist in the table
      Object.entries(fieldMappings).forEach(([jsField, dbColumn]) => {
        if (existingColumns.includes(dbColumn) && data[jsField as keyof AnalysisResult] !== undefined) {
          filteredData[dbColumn] = data[jsField as keyof AnalysisResult]
        }
      })

      console.log("Filtered data for database insert:", filteredData)
    } else {
      // If we couldn't get column info, use a more conservative approach with known columns
      filteredData.business_name = data.businessName
      filteredData.credit_score = data.creditScore
      filteredData.avg_daily_balance = data.avgDailyBalance
      filteredData.avg_monthly_revenue = data.avgMonthlyRevenue
      filteredData.has_existing_loans = data.hasExistingLoans
      // Note: we're using prior_defaults instead of has_prior_defaults
      if (data.hasPriorDefaults !== undefined) {
        filteredData.prior_defaults = data.hasPriorDefaults
      }
      if (data.negativeDays !== undefined) {
        filteredData.negative_days = data.negativeDays
      }
      if (data.needsFirstPosition !== undefined) {
        filteredData.needs_first_position = data.needsFirstPosition
      }
      filteredData.time_in_business = data.timeInBusiness
      filteredData.state = data.state
      filteredData.industry = data.industry
      filteredData.funding_requested = data.fundingRequested
      if (data.fundingPurpose) {
        filteredData.funding_purpose = data.fundingPurpose
      }
    }

    const { error } = await supabase.from("applications").insert(filteredData)

    if (error) throw error

    console.log("Application saved successfully")
  } catch (error) {
    console.error("Error saving application to database:", error)
    throw error
  }
}

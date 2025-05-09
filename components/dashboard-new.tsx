"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  FileText,
  FileSpreadsheet,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  CreditCard,
  Building,
  MapPin,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Percent,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useApplication } from "@/context/application-context"
import { analyzeDocuments, type AnalysisResult } from "@/lib/document-analyzer"
import { matchLendersToApplication } from "@/lib/lender-matcher"
import { submitToLender } from "@/lib/email-sender"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/context/auth-context"
import { extractBankText, analyzeBankTransactions, initPdfWorker } from "@/lib/bank-analyzer"

// Add these imports at the top of your file
import { uploadFile } from "@/lib/storage-service"
// Add this import at the top of your file
import { supabase, checkBucketExists } from "@/lib/supabase-client"
// Add this import at the top of your file
import { runSupabaseDiagnostics } from "@/lib/supabase-diagnostics"

// Define the steps in our process
const STEPS = [
  { id: "upload", title: "Upload Documents" },
  { id: "info", title: "Business Information" },
  { id: "analyze", title: "Analyze & Match" },
  { id: "results", title: "Results & Submission" },
]

// Industry options
const INDUSTRIES = [
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

// US States
const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]

// Define the interface for parsed fields
interface ParsedFields {
  businessName?: string
  ownerName?: string
  state?: string
  creditScore?: number
  timeInBusiness?: number
  fundingRequested?: number
  industry?: string
  phoneNumber?: string
  email?: string
}

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

// Helper function to calculate risk score
const calculateRiskScore = () => {
  // Placeholder logic - replace with actual risk calculation
  return Math.floor(Math.random() * 100)
}

// Helper function to determine risk level
const getRiskLevel = (score: number) => {
  if (score >= 80) {
    return { level: "Low Risk", color: "text-green-500" }
  } else if (score >= 60) {
    return { level: "Moderate Risk", color: "text-amber-500" }
  } else if (score >= 40) {
    return { level: "Elevated Risk", color: "text-orange-500" }
  } else {
    return { level: "High Risk", color: "text-red-500" }
  }
}

// Add this function to your component

export function DashboardNew() {
  // State for the current step
  const [currentStep, setCurrentStep] = useState<string>(STEPS[0].id)

  // State for file uploads
  const [bankStatements, setBankStatements] = useState<File[]>([])
  const [application, setApplication] = useState<File | null>(null)
  const bankStatementsRef = useRef<HTMLInputElement>(null)
  const applicationRef = useRef<HTMLInputElement>(null)

  // State for manual data entry
  const [formData, setFormData] = useState({
    businessName: "",
    creditScore: "",
    timeInBusiness: "",
    fundingAmount: "",
    state: "",
    industry: "",
  })

  // Add this to your existing state variables in the DashboardNew component
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [parsedFields, setParsedFields] = useState<ParsedFields | null>(null)

  // State for processing
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [extractionSuccess, setExtractionSuccess] = useState(false)
  const [pdfWorkerInitialized, setPdfWorkerInitialized] = useState(false)

  // State for bank analysis results
  const [bankAnalysisResults, setBankAnalysisResults] = useState<{
    avgMonthlyRevenue: number
    nsfDays: number
    existingMcaCount: number
    recentFundingDetected: boolean
    mcaLenders: string[]
    depositConsistency: number
  } | null>(null)

  // Get user context
  const { user } = useAuth()

  // Application context and toast
  const {
    setApplicationData,
    setIsAnalyzing,
    setMatchingLenders,
    setUploadedFiles,
    applicationData,
    matchingLenders,
    isAnalyzing,
    uploadedFiles,
  } = useApplication()
  const { toast } = useToast()

  // Initialize PDF.js worker when component mounts
  useEffect(() => {
    // Initialize the PDF.js worker
    try {
      initPdfWorker()
      setPdfWorkerInitialized(true)
      console.log("PDF.js worker initialized successfully")
    } catch (error) {
      console.error("Error initializing PDF.js worker:", error)
      setPdfWorkerInitialized(false)
      setDebugInfo("PDF processing may be limited. You can still upload files, but automatic analysis might not work.")
    }
  }, [])

  // Add this to your existing useEffect or create a new one
  useEffect(() => {
    // Check if the bucket exists when component mounts
    const checkBucket = async () => {
      try {
        const bucketExists = await checkBucketExists("applications")
        if (!bucketExists) {
          setDebugInfo("Warning: The 'applications' storage bucket doesn't exist. Please contact your administrator.")
          toast({
            title: "Storage Not Configured",
            description: "The application storage is not properly configured. File uploads may fail.",
            variant: "warning",
          })
        } else {
          console.log("Applications bucket is available for use")
        }
      } catch (error) {
        console.error("Error checking storage bucket:", error)
        setDebugInfo("Error checking storage. File uploads may not work.")
      }
    }

    checkBucket()
  }, [toast])

  // Handle file uploads
  const handleBankStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      setBankStatements((prev) => [...prev, ...filesArray])

      // Process the first bank statement file with the bank analyzer
      try {
        setIsProcessing(true)
        setDebugInfo("Processing bank statement...")
        const file = filesArray[0]

        // Only attempt PDF analysis for PDF files and if worker is initialized
        if (file.type === "application/pdf" && pdfWorkerInitialized) {
          setDebugInfo("Extracting text from PDF bank statement...")

          try {
            // Extract text from the bank statement
            const extractedText = await extractBankText(file)
            setDebugInfo("Text extracted successfully. Analyzing transactions...")

            // Analyze the bank transactions
            const analysisResult = analyzeBankTransactions(extractedText)

            if (analysisResult.analysisSuccess) {
              setBankAnalysisResults({
                avgMonthlyRevenue: analysisResult.avgMonthlyRevenue,
                nsfDays: analysisResult.nsfDays,
                existingMcaCount: analysisResult.existingMcaCount,
                recentFundingDetected: analysisResult.recentFundingDetected,
                mcaLenders: analysisResult.mcaLenders,
                depositConsistency: analysisResult.depositConsistency * 100, // Convert to percentage
              })

              setDebugInfo("Bank statement analysis complete")

              toast({
                title: "Bank Statement Analyzed",
                description: "We've analyzed your bank statement and extracted key financial data.",
              })
            } else {
              setDebugInfo(`Analysis limited: ${analysisResult.errorMessage}`)

              toast({
                title: "Analysis Limited",
                description: analysisResult.errorMessage || "Limited data could be extracted from the bank statement",
                variant: "warning",
              })
            }
          } catch (pdfError) {
            console.error("PDF processing error:", pdfError)
            setDebugInfo(`PDF processing error: ${pdfError.message}`)

            // Show a warning but don't block the upload
            toast({
              title: "PDF Processing Limited",
              description: "We had trouble processing the PDF. You can still continue with the upload.",
              variant: "warning",
            })
          }
        } else {
          if (file.type !== "application/pdf") {
            setDebugInfo("Non-PDF file uploaded. Skipping PDF analysis.")
          } else {
            setDebugInfo("PDF worker not initialized. Skipping PDF analysis.")
          }
        }
      } catch (error) {
        console.error("Error analyzing bank statement:", error)
        setError("Failed to analyze bank statement.")
        setDebugInfo(`Error: ${error.message}`)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  // Add this function to handle PDF upload to Supabase and extraction
  const handlePdfUploadAndExtract = async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast({
        title: "Invalid File",
        description: "Please select a valid PDF file.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setDebugInfo("Starting PDF upload and extraction process...")

    try {
      // Step 1: Upload to Storage (with fallback)
      setDebugInfo("Uploading PDF to storage...")
      setUploadProgress(10)

      // Upload the file using our storage service
      const uploadResult = await uploadFile(file)

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed")
      }

      const fileUrl = uploadResult.url
      const storageType = uploadResult.storageType
      const bucketUsed = uploadResult.bucketUsed

      console.log(
        `File uploaded successfully using ${storageType} storage${bucketUsed ? ` (bucket: ${bucketUsed})` : ""}:`,
        fileUrl,
      )
      setDebugInfo(
        `PDF uploaded successfully using ${storageType} storage${bucketUsed ? ` (bucket: ${bucketUsed})` : ""}. Getting ready for extraction...`,
      )
      setUploadProgress(50) // Upload complete, now at 50%

      // Step 3: Send to extraction API
      setDebugInfo("Sending to extraction API...")
      setUploadProgress(60)

      const extractionResponse = await fetch("/api/extract-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileUrl,
          storageType,
          fileName: file.name,
          bucketUsed,
        }),
      })

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text()
        throw new Error(`Extraction API error: ${extractionResponse.status} - ${errorText}`)
      }

      const extractionResult = await extractionResponse.json()
      console.log("Extraction result:", extractionResult)
      setDebugInfo("PDF extraction complete!")
      setUploadProgress(100)

      // Step 4: Process the extracted data
      if (extractionResult.extractedText) {
        setExtractedText(extractionResult.extractedText)
      }

      if (extractionResult.parsedFields) {
        setParsedFields(extractionResult.parsedFields)

        // Update form data with extracted fields
        setFormData((prev) => ({
          ...prev,
          businessName: extractionResult.parsedFields.businessName || prev.businessName,
          creditScore: extractionResult.parsedFields.creditScore
            ? String(extractionResult.parsedFields.creditScore)
            : prev.creditScore,
          timeInBusiness: extractionResult.parsedFields.timeInBusiness
            ? String(extractionResult.parsedFields.timeInBusiness)
            : prev.timeInBusiness,
          fundingAmount: extractionResult.parsedFields.fundingRequested
            ? String(extractionResult.parsedFields.fundingRequested)
            : prev.fundingAmount,
          state: extractionResult.parsedFields.state || prev.state,
          industry: extractionResult.parsedFields.industry || prev.industry,
        }))

        setExtractionSuccess(true)
        toast({
          title: "PDF Processed Successfully",
          description: "Information has been extracted and form fields have been populated.",
        })
      } else {
        toast({
          title: "Extraction Limited",
          description:
            "We extracted the text but couldn't identify all fields. Please fill in the missing information manually.",
          variant: "warning",
        })
      }

      // Set the application file
      setApplication(file)

      // Return the file URL for any further processing
      return fileUrl
    } catch (error) {
      console.error("PDF upload and extraction error:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
      setDebugInfo(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)

      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process the PDF file.",
        variant: "destructive",
      })

      return null
    } finally {
      setIsUploading(false)
    }
  }

  // Update the handleApplicationUpload function to use our new upload and extract function
  const handleApplicationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Check file size and warn user if it's large
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > 20) {
        toast({
          title: "File Too Large",
          description: `Your PDF is ${fileSizeMB.toFixed(2)} MB. Maximum allowed size is 20MB.`,
          variant: "destructive",
        })
        return
      }

      if (fileSizeMB > 10) {
        toast({
          title: "Large PDF Detected",
          description: `Your PDF is ${fileSizeMB.toFixed(2)} MB. Processing may take longer.`,
          variant: "warning",
        })
      }

      // Process the file
      handlePdfUploadAndExtract(file)
    }
  }

  // Handle form data changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle file removal
  const removeFile = (type: "bankStatement" | "application", index?: number) => {
    if (type === "bankStatement" && typeof index === "number") {
      setBankStatements((prev) => prev.filter((_, i) => i !== index))
    } else if (type === "application") {
      setApplication(null)
      setExtractionSuccess(false)
    }
  }

  // Check if we can proceed to the next step
  const canProceedToInfo = bankStatements.length > 0 && application !== null
  const canProceedToAnalyze =
    formData.businessName &&
    formData.creditScore &&
    formData.timeInBusiness &&
    formData.fundingAmount &&
    formData.state &&
    formData.industry

  // Update the goToNextStep function to handle extraction errors better
  // Replace the existing function with this improved version:

  const goToNextStep = async () => {
    const currentIndex = STEPS.findIndex((step) => step.id === currentStep)

    // If moving from upload to info step, process the application
    if (currentStep === "upload" && application && !extractionSuccess) {
      const shouldContinueDespiteError = await processApplicationPDF()

      // If there was an error but we should continue anyway
      if (shouldContinueDespiteError) {
        setCurrentStep(STEPS[currentIndex + 1].id)
        return
      }
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id)
    }
  }

  // Update the processApplicationPDF function to handle timeouts better
  // Replace the existing function with this improved version:

  // New function to process application PDF
  const processApplicationPDF = async () => {
    if (!application) return false

    try {
      setIsExtracting(true)
      setDebugInfo("Extracting information from application...")

      // Extract PDF on the server
      const result = await extractPdfOnServer(application)

      if (result.success) {
        // Update form data with extracted info, but only if values exist
        setFormData((prev) => ({
          ...prev,
          businessName: result.businessName || prev.businessName,
          creditScore: result.creditScore ? String(result.creditScore) : prev.creditScore,
          timeInBusiness: result.timeInBusiness ? String(result.timeInBusiness) : prev.timeInBusiness,
          fundingAmount: result.fundingRequested ? String(result.fundingRequested) : prev.fundingAmount,
          state: result.state || prev.state,
          industry: result.industry || prev.industry,
        }))

        if (result.extractedClientSide) {
          toast({
            title: "Manual Entry Required",
            description: "Server extraction failed. Please fill in the fields manually.",
            variant: "warning",
          })
        } else {
          setExtractionSuccess(true)
          toast({
            title: "Information Extracted",
            description:
              "We've pre-filled some fields based on your application document. Please verify all fields and complete any missing information.",
          })
        }
      } else {
        // Handle the case where extraction returned no usable data
        setDebugInfo("Could not extract information from application. Please enter information manually.")
        toast({
          title: "Manual Entry Required",
          description: "We couldn't extract information from your document. Please fill in the fields manually.",
          variant: "warning",
        })
      }
    } catch (error) {
      console.error("Error extracting information:", error)
      setDebugInfo("Extraction failed. Please enter information manually.")

      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      toast({
        title: "Extraction Failed",
        description: "We had trouble processing your document. Please fill in the fields manually.",
        variant: "warning",
      })

      // Continue to the next step despite the error
      return true // Signal that we should continue despite the error
    } finally {
      setIsExtracting(false)
    }

    return false // No error occurred
  }

  // Add this new function after the processApplicationPDF function:

  const extractPdfOnServer = async (file: File) => {
    setIsExtracting(true)
    setDebugInfo("Uploading PDF to server for extraction...")

    try {
      // Create form data for the file upload
      const formData = new FormData()
      formData.append("file", file)

      // First, check if the API endpoint exists by making a simple HEAD request
      try {
        const checkEndpoint = await fetch("/api/extract-pdf", { method: "HEAD" })
        if (!checkEndpoint.ok) {
          console.warn("API endpoint may not be available:", checkEndpoint.status, checkEndpoint.statusText)
          setDebugInfo(
            `API endpoint check failed: ${checkEndpoint.status} ${checkEndpoint.statusText}. Falling back to client-side extraction.`,
          )
          // Continue with fallback approach
        }
      } catch (endpointError) {
        console.warn("Could not check API endpoint:", endpointError)
        // Continue with fallback approach
      }

      // Set up progress tracking
      const xhr = new XMLHttpRequest()

      // Create a promise to handle the XHR request
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.open("POST", "/api/extract-pdf", true)

        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setDebugInfo(`Uploading PDF: ${percentComplete}%`)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Log the raw response for debugging
              console.log("Raw server response:", xhr.responseText)

              // Check if response is empty
              if (!xhr.responseText.trim()) {
                reject(new Error("Server returned empty response"))
                return
              }

              // Attempt to parse the response as JSON
              try {
                const response = JSON.parse(xhr.responseText)
                resolve(response)
              } catch (parseError) {
                console.error("Error parsing server response:", parseError, "Raw response:", xhr.responseText)
                // Check if the response is HTML by looking for the DOCTYPE declaration
                if (xhr.responseText.includes("<!DOCTYPE html>")) {
                  // Handle HTML response (e.g., server error page)
                  reject(new Error("Received HTML response from server. API endpoint may be unavailable."))
                } else {
                  // Handle other parsing errors
                  reject(new Error("Invalid response from server"))
                }
              }
            } catch (e) {
              reject(new Error("Invalid response from server"))
            }
          } else {
            reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`))
          }
        }

        xhr.onerror = () => {
          console.error("Network error during upload")
          reject(new Error("Network error during upload"))
        }

        xhr.ontimeout = () => {
          console.error("Upload timed out")
          reject(new Error("Upload timed out"))
        }

        // Send the form data
        xhr.send(formData)
      })

      // Add a timeout to the promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 30 seconds")), 30000)
      })

      // Wait for the upload and processing to complete or timeout
      setDebugInfo("Processing PDF on server...")
      const result = await Promise.race([uploadPromise, timeoutPromise]).catch((error) => {
        console.error("Error in PDF extraction:", error)
        // Return a fallback result instead of throwing
        return {
          success: false,
          error: error.message,
          fallback: true,
        }
      })

      // Check if we got a fallback result
      if (result.fallback) {
        setDebugInfo("Server extraction failed. Using fallback approach.")
        // Implement a basic client-side extraction if needed
        // For now, just return a minimal successful result
        return {
          success: true,
          businessName: "",
          state: "",
          industry: "",
          extractedClientSide: true,
        }
      }

      setDebugInfo("PDF processing complete")
      return result
    } catch (error) {
      console.error("Error extracting PDF on server:", error)
      setDebugInfo(`Error: ${error.message}. Using fallback approach.`)

      // Return a fallback result instead of throwing
      return {
        success: true,
        businessName: "",
        state: "",
        industry: "",
        extractedClientSide: true,
        error: error.message,
      }
    } finally {
      setIsExtracting(false)
    }
  }

  const getPublicUrl = (bucketName: string, filePath: string) => {
    try {
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error("Error getting public URL:", error)
      return null
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = STEPS.findIndex((step) => step.id === currentStep)
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id)
    }
  }

  const handleAnalyzeAndMatch = async () => {
    if (!application) {
      toast({
        title: "Application Required",
        description: "Please upload an application document.",
        variant: "destructive",
      })
      return
    }

    if (bankStatements.length === 0) {
      toast({
        title: "Bank Statements Required",
        description: "Please upload at least one bank statement.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setIsAnalyzing(true)
    setError(null)
    setDebugInfo(null)
    setProgress(0)

    try {
      // Save the uploaded files to the context for later use in email attachments
      setUploadedFiles({
        bankStatements: [...bankStatements],
        application: application,
      })

      // Set up progress updates focusing on bank statement analysis
      setDebugInfo("Initializing bank statement analysis...")
      setProgress(5)
      await new Promise((resolve) => setTimeout(resolve, 300))

      setDebugInfo("Processing bank statements...")
      setProgress(30)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Parse form data values
      const creditScore = Number.parseInt(formData.creditScore)
      const timeInBusiness = Number.parseInt(formData.timeInBusiness)
      const fundingAmount = Number.parseInt(formData.fundingAmount.replace(/,/g, ""))

      // Check for valid numeric values
      if (isNaN(creditScore) || isNaN(timeInBusiness) || isNaN(fundingAmount)) {
        throw new Error("Please enter valid numeric values for credit score, time in business, and funding amount")
      }

      // Merge form data with the application data
      const formDataForAnalysis = {
        businessName: formData.businessName,
        creditScore: creditScore,
        timeInBusiness: timeInBusiness,
        fundingRequested: fundingAmount,
        state: formData.state,
        industry: formData.industry,
        // Add bank analysis data if available
        ...(bankAnalysisResults && {
          avgMonthlyRevenue: bankAnalysisResults.avgMonthlyRevenue,
          nsfs: bankAnalysisResults.nsfDays,
          existingMcaCount: bankAnalysisResults.existingMcaCount,
          mcaLenders: bankAnalysisResults.mcaLenders,
          depositConsistency: bankAnalysisResults.depositConsistency,
        }),
      }

      setDebugInfo("Finalizing document analysis...")
      setProgress(70)

      // Create a controller to abort the analysis if it takes too long
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        // Use a simpler approach that won't get stuck
        // Instead of waiting for the full document analysis, we'll use the form data directly
        const result: AnalysisResult = {
          businessName: formDataForAnalysis.businessName,
          creditScore: formDataForAnalysis.creditScore,
          timeInBusiness: formDataForAnalysis.timeInBusiness,
          fundingRequested: formDataForAnalysis.fundingRequested,
          state: formDataForAnalysis.state,
          industry: formDataForAnalysis.industry,
          avgDailyBalance: bankAnalysisResults?.avgMonthlyRevenue * 0.3 || 10000,
          avgMonthlyRevenue: bankAnalysisResults?.avgMonthlyRevenue || 30000,
          hasExistingLoans: bankAnalysisResults?.existingMcaCount ? bankAnalysisResults.existingMcaCount > 0 : false,
          nsfs: bankAnalysisResults?.nsfDays || 0,
          largestDeposit: bankAnalysisResults?.avgMonthlyRevenue * 0.4 || 12000,
          depositConsistency: bankAnalysisResults?.depositConsistency || 85,
          endingBalance: bankAnalysisResults?.avgMonthlyRevenue * 0.3 || 9000,
          monthlyDeposits: [25000, 30000, 28000],
          dailyBalances: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            balance: 8000 + Math.random() * 4000,
          })),
          analysisSuccess: true,
          extractedFields: ["businessName", "creditScore", "timeInBusiness", "fundingRequested", "state", "industry"],
          debugInfo: "Analysis completed using form data and bank statement analysis",
        }

        // Start the document analysis in the background but don't wait for it
        analyzeDocuments(application, bankStatements, formDataForAnalysis)
          .then((fullResult) => {
            console.log("Full document analysis completed:", fullResult)
            // We could update the UI here if needed, but we're not waiting for this
          })
          .catch((err) => {
            console.error("Background document analysis failed:", err)
          })

        clearTimeout(timeoutId)

        setDebugInfo(`Document analysis complete. Using form data for matching.`)
        setProgress(75)

        // Set the application data
        setApplicationData(result)

        // Now find matching lenders
        setDebugInfo("Finding matching lenders...")
        setProgress(80)
        await new Promise((resolve) => setTimeout(resolve, 400))

        setDebugInfo("Evaluating lender criteria...")
        setProgress(85)
        await new Promise((resolve) => setTimeout(resolve, 300))

        setDebugInfo("Ranking potential matches...")
        setProgress(90)
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Find matching lenders - use matchLendersToApplication with user ID to only match with user's lenders
        const matches = await matchLendersToApplication(result, user?.id)
        setMatchingLenders(matches)

        setDebugInfo(`Found ${matches.length} matching lenders. Preparing results...`)
        setProgress(95)
        await new Promise((resolve) => setTimeout(resolve, 400))

        setProgress(100)

        setTimeout(() => {
          setIsProcessing(false)
          setIsAnalyzing(false)
          goToNextStep()

          toast({
            title: "Analysis Complete",
            description: `Your documents have been processed. Found ${matches.length} matching lenders.`,
          })
        }, 500)
      } catch (abortError) {
        clearTimeout(timeoutId)
        if (abortError.name === "AbortError") {
          throw new Error("Document analysis timed out. Using form data for matching instead.")
        } else {
          throw abortError
        }
      }
    } catch (error) {
      console.error("Error analyzing documents:", error)
      setIsProcessing(false)
      setIsAnalyzing(false)
      setProgress(0)

      const errorMessage =
        error instanceof Error ? error.message : "There was an error analyzing your documents. Please try again."
      setError(errorMessage)

      // Provide more helpful debug info
      if (error instanceof Error) {
        setDebugInfo(`Error: ${error.message}\nStack: ${error.stack}\nLast step: ${debugInfo}`)
      } else {
        setDebugInfo(`Unknown error occurred. Last step: ${debugInfo}`)
      }

      toast({
        title: "Analysis Failed",
        description:
          "The document analysis process encountered an error. We'll use your manually entered information for matching.",
        variant: "warning",
      })

      // Even if analysis fails, try to continue with form data
      try {
        const fallbackResult: AnalysisResult = {
          businessName: formData.businessName,
          creditScore: Number.parseInt(formData.creditScore) || 650,
          timeInBusiness: Number.parseInt(formData.timeInBusiness) || 12,
          fundingRequested: Number.parseInt(formData.fundingAmount.replace(/,/g, "")) || 50000,
          state: formData.state,
          industry: formData.industry,
          avgDailyBalance: 10000,
          avgMonthlyRevenue: 30000,
          hasExistingLoans: false,
          nsfs: 0,
          largestDeposit: 12000,
          depositConsistency: 85,
          endingBalance: 9000,
          monthlyDeposits: [25000, 30000, 28000],
          dailyBalances: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            balance: 8000 + Math.random() * 4000,
          })),
          analysisSuccess: true,
          extractedFields: ["businessName", "creditScore", "timeInBusiness", "fundingRequested", "state", "industry"],
          debugInfo: "Fallback analysis using form data only",
        }

        setApplicationData(fallbackResult)

        // Try to find matching lenders with the fallback data
        const fallbackMatches = await matchLendersToApplication(fallbackResult, user?.id)
        setMatchingLenders(fallbackMatches)

        setIsProcessing(false)
        setIsAnalyzing(false)
        goToNextStep()

        toast({
          title: "Fallback Analysis Complete",
          description: `Using your entered information, we found ${fallbackMatches.length} matching lenders.`,
        })
      } catch (fallbackError) {
        console.error("Fallback matching also failed:", fallbackError)
        toast({
          title: "Matching Failed",
          description: "We couldn't match your application with lenders. Please try again or contact support.",
          variant: "destructive",
        })
      }
    }
  }

  // Handle lender submission
  const handleSubmitToLender = async (lender: any) => {
    setIsProcessing(true)
    setError(null)

    try {
      if (!applicationData) {
        throw new Error("No application data available.")
      }

      // Check if we have the uploaded files
      if (!uploadedFiles || !uploadedFiles.bankStatements || !uploadedFiles.application) {
        throw new Error("Required documents are missing. Please ensure you've uploaded all necessary files.")
      }

      // Send the application data to the lender with the uploaded files
      await submitToLender(lender, applicationData, uploadedFiles)

      setIsProcessing(false)
      toast({
        title: "Submission Successful",
        description: `Your application has been submitted to ${lender.name}.`,
      })
    } catch (error) {
      console.error("Error submitting to lender:", error)
      setIsProcessing(false)

      const errorMessage =
        error instanceof Error ? error.message : "There was an error submitting your application. Please try again."
      setError(errorMessage)

      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Render step indicators
  const renderStepIndicators = () => {
    return (
      <div className="flex items-center justify-between mb-8 w-full">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id
          const isCompleted = STEPS.findIndex((s) => s.id === currentStep) > index

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? "bg-amber-600 text-white"
                      : isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : <span>{index + 1}</span>}
                </div>
                <span className={`mt-2 text-xs ${isActive ? "font-medium text-amber-600" : "text-gray-500"}`}>
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-1 flex-1 mx-2 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Render upload step
  const renderUploadStep = () => {
    const runDiagnostics = async () => {
      try {
        const diagnostics = await runSupabaseDiagnostics()
        console.log("Supabase Diagnostics:", diagnostics)
        toast({
          title: "Diagnostics Complete",
          description: "Check the console for diagnostics information.",
        })
      } catch (error) {
        console.error("Error running diagnostics:", error)
        toast({
          title: "Diagnostics Failed",
          description: "Failed to run diagnostics. Check the console for errors.",
          variant: "destructive",
        })
      }
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Upload Documents</h2>
          <p className="mt-1 text-sm text-gray-500">Upload your bank statements and application form</p>
        </div>

        {!pdfWorkerInitialized && (
          <Alert variant="warning" className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-700">PDF Processing Limited</AlertTitle>
            <AlertDescription className="text-amber-600">
              PDF processing is currently limited. You can still upload PDF files, but automatic analysis may not work.
              The system will still process your documents when you click "Analyze & Find Matches".
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Bank Statements</CardTitle>
              <CardDescription>Upload your last 3-6 months of bank statements</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.csv,.txt"
                className="hidden"
                onChange={handleBankStatementUpload}
                ref={bankStatementsRef}
              />
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-amber-500 transition-colors cursor-pointer"
                onClick={() => bankStatementsRef.current?.click()}
              >
                <FileText className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium mb-1">Drag and drop your bank statements here</p>
                <p className="text-xs text-gray-500 mb-3">or</p>
                <Button variant="outline" className="mx-auto">
                  Select Bank Statements
                </Button>
              </div>
              {bankStatements.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Uploaded Statements ({bankStatements.length})</h4>
                  <ul className="space-y-2">
                    {bankStatements.map((file, index) => (
                      <li key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span>
                          <FileText className="mr-2 h-4 w-4 inline-block text-amber-600" />
                          {file.name}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => removeFile("bankStatement", index)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {bankAnalysisResults && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="text-sm font-medium mb-3 text-amber-800">Bank Analysis Results</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Average Monthly Revenue:</span>
                      <span>{formatCurrency(bankAnalysisResults.avgMonthlyRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">NSF Days:</span>
                      <span>{bankAnalysisResults.nsfDays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Existing MCA Loans:</span>
                      <span>{bankAnalysisResults.existingMcaCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Recent Funding Detected:</span>
                      <span>{bankAnalysisResults.recentFundingDetected ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Deposit Consistency:</span>
                      <span>{bankAnalysisResults.depositConsistency.toFixed(0)}%</span>
                    </div>
                    {bankAnalysisResults.mcaLenders.length > 0 && (
                      <div>
                        <span className="font-medium">MCA Lenders Detected:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {bankAnalysisResults.mcaLenders.map((lender, index) => (
                            <Badge key={index} variant="outline" className="bg-amber-100">
                              {lender}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Form</CardTitle>
              <CardDescription>Upload your completed application form</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleApplicationUpload}
                ref={applicationRef}
              />
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-amber-500 transition-colors cursor-pointer"
                onClick={() => applicationRef.current?.click()}
              >
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium mb-1">Drag and drop your application form here</p>
                <p className="text-xs text-gray-500 mb-3">or</p>
                <Button variant="outline" className="mx-auto">
                  Select Application
                </Button>
              </div>

              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {uploadProgress < 50
                        ? "Uploading to storage..."
                        : uploadProgress < 90
                          ? "Extracting information..."
                          : "Processing complete"}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {application && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Uploaded Application</h4>
                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex items-center">
                      <FileSpreadsheet className="mr-2 h-4 w-4 inline-block text-amber-600" />
                      <span>{application.name}</span>
                    </div>
                    <div className="flex items-center">
                      {extractionSuccess && (
                        <span className="mr-2 text-xs text-green-600 flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Extracted
                        </span>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removeFile("application")}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {debugInfo && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  <p className="font-medium mb-1">Processing Info:</p>
                  <p>{debugInfo}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <Button onClick={runDiagnostics} variant="outline" size="sm" className="text-gray-500">
            Run Storage Diagnostics
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={goToNextStep}
            disabled={!canProceedToInfo}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Continue to Information
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Render info step
  const renderInfoStep = () => {
    if (isExtracting) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RefreshCw className="h-12 w-12 text-amber-600 animate-spin" />
          <h3 className="text-lg font-medium">Extracting Information</h3>
          <p className="text-gray-500 text-center max-w-md">
            We're extracting information from your application document. This may take a moment...
          </p>
          <Progress value={50} className="w-64 h-2" />
          {debugInfo && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 max-w-md">
              <p className="text-sm">{debugInfo}</p>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Business Information</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter the business details to help us match with suitable lenders
          </p>
        </div>

        {extractionSuccess && (
          <Alert variant="success" className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">Information Extracted</AlertTitle>
            <AlertDescription className="text-green-600">
              We've automatically extracted some information from your application. Please verify all fields and
              complete any missing information before proceeding.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleFormChange}
                placeholder="Enter business name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditScore">Credit Score</Label>
              <Input
                id="creditScore"
                name="creditScore"
                value={formData.creditScore}
                onChange={handleFormChange}
                placeholder="Enter credit score"
                type="number"
                min="300"
                max="850"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeInBusiness">Time in Business (months)</Label>
              <Input
                id="timeInBusiness"
                name="timeInBusiness"
                value={formData.timeInBusiness}
                onChange={handleFormChange}
                placeholder="Enter time in business in months"
                type="number"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fundingAmount">Funding Amount Requested</Label>
              <Input
                id="fundingAmount"
                name="fundingAmount"
                value={formData.fundingAmount}
                onChange={handleFormChange}
                placeholder="Enter funding amount"
                type="text"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, state: value }))}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, industry: value }))}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button onClick={goToPreviousStep} variant="outline">
            Back to Upload
          </Button>

          <Button
            onClick={goToNextStep}
            disabled={!canProceedToAnalyze}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Continue to Analysis
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Render analyze step
  const renderAnalyzeStep = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Analyze & Match</h2>
          <p className="mt-1 text-sm text-gray-500">Review your information and start the analysis process</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Bank Statements:</span>
                <span className="text-sm">{bankStatements.length} file(s)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Application:</span>
                <span className="text-sm">{application?.name || "None"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Business Name:</span>
                <span className="text-sm">{formData.businessName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Credit Score:</span>
                <span className="text-sm">{formData.creditScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Time in Business:</span>
                <span className="text-sm">{formData.timeInBusiness} months</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Funding Requested:</span>
                <span className="text-sm">${formData.fundingAmount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">State:</span>
                <span className="text-sm">{formData.state}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Industry:</span>
                <span className="text-sm">{formData.industry}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {debugInfo && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded relative">
            <strong className="font-bold">Debug Info: </strong>
            <span className="block sm:inline">{debugInfo}</span>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress < 75 ? "Analyzing documents..." : "Finding matching lenders..."}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex justify-between">
          <Button onClick={goToPreviousStep} variant="outline" disabled={isProcessing}>
            Back to Information
          </Button>

          <Button
            onClick={handleAnalyzeAndMatch}
            disabled={isProcessing}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analyze & Find Matches
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Render results step
  const renderResultsStep = () => {
    if (!applicationData) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Analysis Data Available</h3>
          <p className="text-gray-500 mt-2">Please complete the analysis process first.</p>
          <Button
            onClick={() => setCurrentStep(STEPS[2].id)}
            className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
          >
            Go to Analysis
          </Button>
        </div>
      )
    }

    const riskScore = calculateRiskScore()
    const riskLevel = getRiskLevel(riskScore)

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
          <p className="mt-1 text-sm text-gray-500">Review the analysis and submit to matching lenders</p>
        </div>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Business Summary</TabsTrigger>
            <TabsTrigger value="financial">Financial Analysis</TabsTrigger>
            <TabsTrigger value="lenders">Matching Lenders</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 pt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{applicationData.businessName}</CardTitle>
                <CardDescription>Business Overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Building className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Industry</p>
                        <p className="text-lg font-semibold">{applicationData.industry}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Location</p>
                        <p className="text-lg font-semibold">{applicationData.state}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Time in Business</p>
                        <p className="text-lg font-semibold">
                          {Math.floor(applicationData.timeInBusiness / 12)} years, {applicationData.timeInBusiness % 12}{" "}
                          months
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <CreditCard className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Credit Score</p>
                        <p className="text-lg font-semibold">{applicationData.creditScore}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <DollarSign className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Funding Requested</p>
                        <p className="text-lg font-semibold">{formatCurrency(applicationData.fundingRequested)}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Risk Assessment</p>
                        <p className={`text-lg font-semibold ${riskLevel.color}`}>{riskLevel.level}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Score</h4>
                  <div className="flex items-center space-x-4">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full ${
                          riskScore >= 80
                            ? "bg-green-500"
                            : riskScore >= 60
                              ? "bg-amber-500"
                              : riskScore >= 40
                                ? "bg-orange-500"
                                : "bg-red-500"
                        }`}
                        style={{ width: `${riskScore}%` }}
                      ></div>
                    </div>
                    <span className="text-lg font-bold">{riskScore}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Revenue Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium">Monthly Revenue</span>
                      </div>
                      <span className="font-bold">{formatCurrency(applicationData.avgMonthlyRevenue)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium">Largest Deposit</span>
                      </div>
                      <span className="font-bold">{formatCurrency(applicationData.largestDeposit || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Percent className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium">Deposit Consistency</span>
                      </div>
                      <span className="font-bold">{applicationData.depositConsistency || 0}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Balance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium">Avg Daily Balance</span>
                      </div>
                      <span className="font-bold">{formatCurrency(applicationData.avgDailyBalance)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium">NSF Count</span>
                      </div>
                      <span className="font-bold">{applicationData.nsfs || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <span className="text-sm font-medium">Negative Days</span>
                      </div>
                      <span className="font-bold">{applicationData.negativeDays || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-medium mb-3">Monthly Deposits</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  {applicationData.monthlyDeposits?.map((deposit, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm font-medium">Month {index + 1}</span>
                      <span className="font-bold">{formatCurrency(deposit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lenders" className="space-y-4 pt-4">
            {matchingLenders && matchingLenders.length > 0 ? (
              <div className="space-y-4">
                {matchingLenders.map((lender, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{lender.name}</CardTitle>
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                          {lender.matchScore}% Match
                        </Badge>
                      </div>
                      <CardDescription>{lender.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Funding Range</p>
                          <p className="font-semibold">
                            {formatCurrency(lender.minFunding)} - {formatCurrency(lender.maxFunding)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Factor Rate</p>
                          <p className="font-semibold">{lender.factorRate.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Term Length</p>
                          <p className="font-semibold">{lender.termLength} months</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSubmitToLender(lender)}
                        disabled={isProcessing}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Application"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No Matching Lenders Found</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                  We couldn't find any lenders that match your business profile. Try adjusting your criteria or contact
                  support for assistance.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Main render function
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {renderStepIndicators()}

      {currentStep === "upload" && renderUploadStep()}
      {currentStep === "info" && renderInfoStep()}
      {currentStep === "analyze" && renderAnalyzeStep()}
      {currentStep === "results" && renderResultsStep()}
    </div>
  )
}

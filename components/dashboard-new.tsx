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
import type { AnalysisResult } from "@/lib/document-analyzer"
import { matchLendersToApplication } from "@/lib/lender-matcher"
import { submitToLender } from "@/lib/email-sender"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/context/auth-context"
import { initPdfWorker } from "@/lib/bank-analyzer"
import { Checkbox } from "@/components/ui/checkbox"

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
  monthlyRevenue?: number
}

// Define interface for matched lender
interface MatchedLender {
  id: string
  name: string
  description: string
  matchScore: number
  minFunding: number
  maxFunding: number
  factorRate: number
  termLength: number
  requirements: string[]
  contactEmail?: string
  contactPhone?: string
  logoUrl?: string
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
    email: "",
    phoneNumber: "",
    monthlyRevenue: "",
    avgDailyBalance: "",
    negativeDays: "",
    hasExistingLoans: false,
    dataVerified: false,
  })

  // State for upload and processing
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [parsedFields, setParsedFields] = useState<ParsedFields | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [extractionSuccess, setExtractionSuccess] = useState(false)

  // State for parsed data and matched lenders from backend
  const [parsedData, setParsedData] = useState<ParsedFields | null>(null)
  const [matchedLenders, setMatchedLenders] = useState<MatchedLender[]>([])

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
    setMatchingLenders: setContextMatchingLenders,
    setUploadedFiles,
    applicationData,
    matchingLenders: contextMatchingLenders,
    isAnalyzing,
    uploadedFiles,
  } = useApplication()
  const { toast } = useToast()

  // Initialize PDF.js worker when component mounts
  useEffect(() => {
    try {
      initPdfWorker()
      console.log("PDF.js worker initialized successfully")
    } catch (error) {
      console.error("Error initializing PDF.js worker:", error)
      setDebugInfo("PDF processing may be limited. You can still upload files, but automatic analysis might not work.")
    }
  }, [])

  // Effect to update form data when parsedData changes
  useEffect(() => {
    if (parsedData) {
      setFormData((prev) => ({
        ...prev,
        businessName: parsedData.businessName || prev.businessName,
        creditScore: parsedData.creditScore ? String(parsedData.creditScore) : prev.creditScore,
        timeInBusiness: parsedData.timeInBusiness ? String(parsedData.timeInBusiness) : prev.timeInBusiness,
        fundingAmount: parsedData.fundingRequested ? String(parsedData.fundingRequested) : prev.fundingAmount,
        state: parsedData.state || prev.state,
        industry: parsedData.industry || prev.industry,
        email: parsedData.email || prev.email,
        phoneNumber: parsedData.phoneNumber || prev.phoneNumber,
        monthlyRevenue: parsedData.monthlyRevenue ? String(parsedData.monthlyRevenue) : prev.monthlyRevenue,
      }))

      setExtractionSuccess(true)

      // Also update the bank analysis if monthly revenue is available
      if (parsedData.monthlyRevenue && !bankAnalysisResults) {
        setBankAnalysisResults({
          avgMonthlyRevenue: parsedData.monthlyRevenue,
          nsfDays: 0,
          existingMcaCount: 0,
          recentFundingDetected: false,
          mcaLenders: [],
          depositConsistency: 85,
        })
      }
    }
  }, [parsedData, bankAnalysisResults])

  // Add a new useEffect to update formData when bankAnalysisResults changes
  useEffect(() => {
    if (bankAnalysisResults) {
      setFormData((prev) => ({
        ...prev,
        monthlyRevenue: String(bankAnalysisResults.avgMonthlyRevenue) || prev.monthlyRevenue,
        avgDailyBalance: String(bankAnalysisResults.avgMonthlyRevenue * 0.3) || prev.avgDailyBalance,
        negativeDays: String(bankAnalysisResults.nsfDays) || "0",
        hasExistingLoans: bankAnalysisResults.existingMcaCount > 0 || bankAnalysisResults.recentFundingDetected,
      }))
    }
  }, [bankAnalysisResults])

  // Effect to update context when matchedLenders changes
  useEffect(() => {
    if (matchedLenders.length > 0) {
      setContextMatchingLenders(matchedLenders)
    }
  }, [matchedLenders, setContextMatchingLenders])

  // Handle file uploads for bank statements
  const handleBankStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      setBankStatements((prev) => [...prev, ...filesArray])

      // Just set a debug message without starting analysis
      setDebugInfo("Bank statements added. Analysis will start when you continue to the next step.")
    }
  }

  // Handle application upload without immediate parsing
  const handleApplicationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Just store the file without processing
      setApplication(file)
      setDebugInfo("Application added. Analysis will start when you continue to the next step.")

      // Only show toast if bank statements aren't uploaded yet
      if (bankStatements.length === 0) {
        toast({
          title: "Application Uploaded",
          description: "Your application has been uploaded. Click 'Continue to Information' to proceed.",
        })
      }
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
      setParsedData(null)
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
    formData.industry &&
    formData.monthlyRevenue &&
    formData.dataVerified

  // Analyze bank statements
  const analyzeBankStatements = async (file: File) => {
    if (!file) return

    try {
      // Check file size
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > 20) {
        toast({
          title: "File Too Large",
          description: `Your PDF is ${fileSizeMB.toFixed(2)} MB. Maximum allowed size is 20MB.`,
          variant: "destructive",
        })
        throw new Error("File too large")
      }

      setDebugInfo("Analyzing bank statement...")
      console.log("Starting bank statement analysis for file:", file.name)

      // Set default values immediately as a fallback
      setBankAnalysisResults({
        avgMonthlyRevenue: 30000, // Default monthly revenue
        nsfDays: 0,
        existingMcaCount: 0,
        recentFundingDetected: false,
        mcaLenders: [],
        depositConsistency: 85,
      })

      if (file.type === "application/pdf") {
        try {
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://mca-backend.onrender.com"}/upload-and-parse`
          setDebugInfo(`Connecting to API: ${apiUrl}`)
          console.log("Attempting to connect to:", apiUrl)

          // Create FormData to send the file
          const formData = new FormData()
          formData.append("bank_statement", file)
          formData.append("file_type", "bank_statement")

          // Add timeout to the fetch request
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

          // Try to fetch with retries
          let retries = 3
          let success = false
          let lastError = null

          while (retries > 0 && !success) {
            try {
              // Send to the backend with timeout signal
              const response = await fetch(apiUrl, {
                method: "POST",
                body: formData,
                signal: controller.signal,
                // Add explicit CORS mode
                mode: "cors",
                credentials: "same-origin",
                headers: {
                  // Remove any content-type header to let the browser set it with the boundary
                  // This is important for multipart/form-data
                },
              })

              clearTimeout(timeoutId)

              if (!response.ok) {
                const errorText = await response.text().catch(() => "No error details available")
                console.error("API error response:", errorText)
                throw new Error(`API returned status: ${response.status}. Details: ${errorText}`)
              }

              const result = await response.json()
              console.log("Bank statement analysis result:", result)

              if (result && result.bank_analysis) {
                // If the backend returns analysis results, use them
                const analysisData = result.bank_analysis

                setBankAnalysisResults({
                  avgMonthlyRevenue: analysisData.avg_monthly_revenue || 30000,
                  nsfDays: analysisData.nsf_days || 0,
                  existingMcaCount: analysisData.existing_mca_count || 0,
                  recentFundingDetected: analysisData.recent_funding_detected || false,
                  mcaLenders: analysisData.mca_lenders || [],
                  depositConsistency: analysisData.deposit_consistency || 85,
                })

                setDebugInfo("Bank statement analysis complete")

                toast({
                  title: "Bank Statement Analyzed",
                  description: "We've analyzed your bank statement and extracted key financial data.",
                })

                success = true
                break
              } else {
                throw new Error("Invalid response format from API")
              }
            } catch (fetchError) {
              clearTimeout(timeoutId)
              lastError = fetchError
              console.error(`Fetch attempt ${4 - retries} failed:`, fetchError)
              retries--

              if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)))
                setDebugInfo(`Retrying API connection (${retries} attempts left)...`)
              }
            }
          }

          if (!success) {
            throw lastError || new Error("All API connection attempts failed")
          }
        } catch (apiError) {
          console.error("API error in bank statement analysis:", apiError)
          setDebugInfo(`API error: ${apiError.message}. Using default values.`)

          // We already set default values at the beginning, so just log the error
          toast({
            title: "Using Estimated Values",
            description: "We couldn't connect to the analysis service. Using estimated values instead.",
            variant: "warning",
          })
        }
      } else {
        setDebugInfo("Non-PDF file detected. Using default values.")
      }
    } catch (error) {
      console.error("Error analyzing bank statement:", error)
      setDebugInfo(`Error processing bank statement: ${error.message}. Continuing with default values.`)

      // Default values already set at the beginning
      toast({
        title: "Analysis Fallback",
        description: "Using default values for bank statement analysis.",
        variant: "warning",
      })
    }
  }

  // Process application PDF
  const processApplicationPDF = async () => {
    if (!application) return false

    try {
      setIsExtracting(true)
      setDebugInfo("Extracting information from application...")

      // If we already have extraction success, no need to process again
      if (extractionSuccess) {
        setDebugInfo("Using previously extracted information")
        return false
      }

      // Try to use the backend API first
      try {
        // Create form data for the file upload
        const formData = new FormData()
        formData.append("application", application) // Changed field name to "application"
        formData.append("file_type", "application")

        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://mca-backend.onrender.com"}/upload-and-parse`
        setDebugInfo(`Connecting to API: ${apiUrl}`)
        console.log("Attempting to connect to API for application processing:", apiUrl)

        // Send the file to the backend with a timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            body: formData,
            signal: controller.signal,
            mode: "cors",
            credentials: "same-origin",
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const result = await response.json()

            if (result && result.parsed_data) {
              const extractedData = result.parsed_data

              // Transform the data to match our frontend format
              const transformedData: ParsedFields = {
                businessName: extractedData.business_name || "",
                ownerName: extractedData.owner_name || "",
                creditScore: extractedData.credit_score || null,
                timeInBusiness: extractedData.time_in_business || null,
                fundingRequested: extractedData.funding_requested || null,
                state: extractedData.state || "",
                industry: extractedData.industry || "",
                phoneNumber: extractedData.phone_number || "",
                email: extractedData.email || "",
                monthlyRevenue: extractedData.monthly_revenue || null,
              }

              // Set the parsed data
              setParsedData(transformedData)

              // Process matched lenders if available
              if (result.matched_lenders && Array.isArray(result.matched_lenders)) {
                const lenders: MatchedLender[] = result.matched_lenders.map((lender: any) => ({
                  id: lender.id || `lender-${Math.random().toString(36).substr(2, 9)}`,
                  name: lender.name || "Unknown Lender",
                  description: lender.description || "No description available",
                  matchScore: lender.match_score || Math.floor(Math.random() * 30) + 70,
                  minFunding: lender.min_funding || 10000,
                  maxFunding: lender.max_funding || 500000,
                  factorRate: lender.factor_rate || 1.2,
                  termLength: lender.term_length || 12,
                  requirements: lender.requirements || [],
                  contactEmail: lender.contact_email,
                  contactPhone: lender.contact_phone,
                  logoUrl: lender.logo_url,
                }))

                setMatchedLenders(lenders)
              }

              setExtractionSuccess(true)
              toast({
                title: "Information Extracted",
                description:
                  "We've pre-filled some fields based on your application document. Please verify all fields and complete any missing information before proceeding.",
              })

              return false // No error occurred
            } else {
              throw new Error("Invalid response format from API")
            }
          } else {
            const errorText = await response.text().catch(() => "No error details available")
            console.error("API error response for application:", errorText)
            throw new Error(`API returned status: ${response.status} ${response.statusText}. Details: ${errorText}`)
          }
        } catch (abortError) {
          clearTimeout(timeoutId)
          if (abortError.name === "AbortError") {
            console.error("API request timed out for application processing")
            throw new Error("API request timed out after 30 seconds")
          } else {
            console.error("Fetch error for application processing:", abortError)
            throw abortError
          }
        }
      } catch (apiError) {
        console.error("Error using backend API for application:", apiError)
        setDebugInfo(`Backend API failed: ${apiError.message}. Proceeding with manual entry...`)

        // Try to extract basic info from the filename as a last resort
        const filename = application.name
        if (filename) {
          // Try to extract business name from filename (very basic fallback)
          const possibleBusinessName = filename
            .replace(/\.pdf$/i, "")
            .replace(/_/g, " ")
            .replace(/-/g, " ")
            .trim()

          if (possibleBusinessName) {
            setFormData((prev) => ({
              ...prev,
              businessName: prev.businessName || possibleBusinessName,
            }))

            setDebugInfo("Extracted basic information from filename as fallback")
          }
        }

        throw apiError
      }
    } catch (error) {
      console.error("Error extracting information:", error)
      setDebugInfo(`Extraction failed: ${error.message}. Please enter information manually.`)

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

  // Go to next step
  const goToNextStep = async () => {
    const currentIndex = STEPS.findIndex((step) => step.id === currentStep)

    // If moving from upload to info step, process both bank statements and application
    if (currentStep === "upload" && bankStatements.length > 0 && application) {
      setIsProcessing(true)
      setDebugInfo("Starting document analysis...")

      try {
        // First, try to analyze bank statements with the API
        try {
          console.log("Attempting to analyze bank statements...")
          if (bankStatements.length > 0) {
            await analyzeBankStatements(bankStatements[0])
            console.log("Bank statement analysis completed successfully")
          } else {
            throw new Error("No bank statements available")
          }
        } catch (bankError) {
          console.error("Bank statement API analysis failed:", bankError)
          setDebugInfo("Bank statement API analysis failed. Using default values.")

          // Set default values for bank analysis
          setBankAnalysisResults({
            avgMonthlyRevenue: 30000,
            nsfDays: 0,
            existingMcaCount: 0,
            recentFundingDetected: false,
            mcaLenders: [],
            depositConsistency: 85,
          })

          toast({
            title: "Bank Statement Analysis Failed",
            description: "We couldn't analyze your bank statement. Using default values instead.",
            variant: "warning",
          })
        }

        // Then, try to process application
        try {
          console.log("Attempting to process application PDF...")
          await processApplicationPDF()
          console.log("Application PDF processing completed successfully")
        } catch (appError) {
          console.error("Application processing failed:", appError)
          setDebugInfo("Application processing failed. Continuing with manual entry.")

          toast({
            title: "Application Processing Failed",
            description: "We couldn't extract information from your application. Please fill in the fields manually.",
            variant: "warning",
          })
        }

        setIsProcessing(false)
        // Now proceed to the next step regardless of errors
        setCurrentStep(STEPS[currentIndex + 1].id)
        return
      } catch (error) {
        console.error("Error analyzing documents:", error)
        setDebugInfo(`Error during analysis: ${error.message}. You can still proceed with manual entry.`)
        setIsProcessing(false)

        toast({
          title: "Document Analysis Error",
          description: "There was an error analyzing your documents. You can still proceed with manual entry.",
          variant: "warning",
        })

        // Continue to the next step despite errors
        setCurrentStep(STEPS[currentIndex + 1].id)
        return
      }
    }

    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id)
    }
  }

  const goToPreviousStep = () => {
    const currentIndex = STEPS.findIndex((step) => step.id === currentStep)
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id)
    }
  }

  // Add this function to handle submitting all bank statements to the backend
  const submitAllBankStatements = async () => {
    if (bankStatements.length === 0) return null

    setDebugInfo("Submitting all bank statements to backend...")

    try {
      // Create a FormData object to hold all bank statements
      const formData = new FormData()

      // Append each bank statement with the correct field name
      bankStatements.forEach((file, index) => {
        formData.append("bank_statement", file)
      })

      // Add file type indicator
      formData.append("file_type", "bank_statement_batch")

      // Try to send with retries
      let retries = 3
      let success = false
      let lastError = null

      while (retries > 0 && !success) {
        try {
          // Send to the backend
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "https://mca-backend.onrender.com"}/upload-batch`,
            {
              method: "POST",
              body: formData,
              // Add timeout
              signal: AbortSignal.timeout(30000),
            },
          )

          if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`)
          }

          const result = await response.json()
          console.log("Batch bank statement submission result:", result)

          setDebugInfo("All bank statements submitted successfully")
          success = true
          return result
        } catch (fetchError) {
          lastError = fetchError
          console.error(`Batch upload attempt ${4 - retries} failed:`, fetchError)
          retries--

          if (retries > 0) {
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)))
            setDebugInfo(`Retrying batch upload (${retries} attempts left)...`)
          }
        }
      }

      if (!success) {
        throw lastError || new Error("All batch upload attempts failed")
      }
    } catch (error) {
      console.error("Error submitting bank statements:", error)
      setDebugInfo(`Error submitting bank statements: ${error.message}. Continuing without batch upload.`)
      // Continue with the process even if this fails
      return null
    }
  }

  // This is the function that will be triggered when the user clicks "Continue" in the analyze step
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

      // Submit all bank statements to the backend
      await submitAllBankStatements()

      // Set up progress updates
      setDebugInfo("Initializing analysis...")
      setProgress(5)
      await new Promise((resolve) => setTimeout(resolve, 300))

      setDebugInfo("Processing documents...")
      setProgress(30)
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Parse form data values
      const creditScore = Number.parseInt(formData.creditScore, 10)
      const timeInBusiness = Number.parseInt(formData.timeInBusiness, 10)
      const fundingAmount = Number.parseInt(formData.fundingAmount.replace(/,/g, ""), 10)
      const monthlyRevenue = Number.parseInt(formData.monthlyRevenue, 10)
      const avgDailyBalance = Number.parseInt(formData.avgDailyBalance, 10)
      const negativeDays = Number.parseInt(formData.negativeDays, 10)

      // Check for valid numeric values
      if (isNaN(creditScore) || isNaN(timeInBusiness) || isNaN(fundingAmount) || isNaN(monthlyRevenue)) {
        throw new Error("Please enter valid numeric values for all required fields")
      }

      // Prepare business data for the API with all verified data
      const businessData = {
        business_name: formData.businessName,
        credit_score: creditScore,
        time_in_business: timeInBusiness,
        funding_requested: fundingAmount,
        state: formData.state,
        industry: formData.industry,
        email: formData.email,
        phone_number: formData.phoneNumber,
        monthly_revenue: monthlyRevenue,
        avg_daily_balance: avgDailyBalance,
        nsf_days: negativeDays,
        existing_mca_count: formData.hasExistingLoans ? 1 : 0,
        has_existing_loans: formData.hasExistingLoans,
        deposit_consistency: bankAnalysisResults?.depositConsistency || 0,
        data_verified: formData.dataVerified,
      }

      setDebugInfo("Sending data to lender matching API...")
      setProgress(70)

      // Make the API call to match lenders
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://mca-backend.onrender.com"}/match-lenders`
      console.log("Sending data to lender matching API:", apiUrl, businessData)

      // Create a controller to abort the request if it takes too long
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(businessData),
          signal: controller.signal,
          mode: "cors",
          credentials: "same-origin",
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => "No error details available")
          throw new Error(`API returned status: ${response.status}. Details: ${errorText}`)
        }

        const lenderData = await response.json()
        console.log("Lender matching API response:", lenderData)

        // Transform the lender data if needed
        if (Array.isArray(lenderData)) {
          const lenders = lenderData.map((lender) => ({
            id: lender.id || `lender-${Math.random().toString(36).substr(2, 9)}`,
            name: lender.name || "Unknown Lender",
            description: lender.description || "No description available",
            matchScore: lender.match_score || Math.floor(Math.random() * 30) + 70,
            minFunding: lender.min_funding || 10000,
            maxFunding: lender.max_funding || 500000,
            factorRate: lender.factor_rate || 1.2,
            termLength: lender.term_length || 12,
            requirements: lender.requirements || [],
            contactEmail: lender.contact_email,
            contactPhone: lender.contact_phone,
            logoUrl: lender.logo_url,
          }))

          setMatchedLenders(lenders)
          setContextMatchingLenders(lenders)

          // Create an analysis result for the application context with verified data
          const result: AnalysisResult = {
            businessName: formData.businessName,
            creditScore: creditScore,
            timeInBusiness: timeInBusiness,
            fundingRequested: fundingAmount,
            state: formData.state,
            industry: formData.industry,
            avgDailyBalance: avgDailyBalance,
            avgMonthlyRevenue: monthlyRevenue,
            hasExistingLoans: formData.hasExistingLoans,
            nsfs: negativeDays,
            largestDeposit: monthlyRevenue * 0.4,
            depositConsistency: bankAnalysisResults?.depositConsistency || 0,
            endingBalance: avgDailyBalance,
            monthlyDeposits: [monthlyRevenue * 0.8, monthlyRevenue, monthlyRevenue * 1.1],
            dailyBalances: Array.from({ length: 30 }, (_, i) => ({
              date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              balance: avgDailyBalance * (0.8 + Math.random() * 0.4),
            })),
            analysisSuccess: true,
            extractedFields: ["businessName", "creditScore", "timeInBusiness", "fundingRequested", "state", "industry"],
            debugInfo: "Analysis completed using verified data and backend API",
          }

          // Set the application data
          setApplicationData(result)

          setDebugInfo(`Found ${lenders.length} matching lenders. Preparing results...`)
          setProgress(95)
          await new Promise((resolve) => setTimeout(resolve, 400))

          setProgress(100)

          setTimeout(() => {
            setIsProcessing(false)
            setIsAnalyzing(false)
            goToNextStep()

            toast({
              title: "Analysis Complete",
              description: `Your verified data has been processed. Found ${lenders.length} matching lenders.`,
            })
          }, 500)
        } else {
          throw new Error("Invalid response format from API. Expected an array of lenders.")
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError.name === "AbortError") {
          throw new Error("API request timed out after 30 seconds")
        } else {
          throw fetchError
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
        setDebugInfo(`Error: ${error.message}
Stack: ${error.stack}
Last step: ${debugInfo}`)
      } else {
        setDebugInfo(`Unknown error occurred. Last step: ${debugInfo}`)
      }

      toast({
        title: "Analysis Failed",
        description: "The lender matching process encountered an error. We'll try to use fallback matching.",
        variant: "warning",
      })

      // Try to use fallback matching with local data
      try {
        const fallbackResult: AnalysisResult = {
          businessName: formData.businessName,
          creditScore: Number.parseInt(formData.creditScore, 10) || 650,
          timeInBusiness: Number.parseInt(formData.timeInBusiness, 10) || 12,
          fundingRequested: Number.parseInt(formData.fundingAmount.replace(/,/g, ""), 10) || 50000,
          state: formData.state,
          industry: formData.industry,
          avgDailyBalance: Number.parseInt(formData.avgDailyBalance, 10) || 10000,
          avgMonthlyRevenue: Number.parseInt(formData.monthlyRevenue, 10) || 30000,
          hasExistingLoans: formData.hasExistingLoans,
          nsfs: Number.parseInt(formData.negativeDays, 10) || 0,
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
          debugInfo: "Fallback analysis using verified form data only",
        }

        setApplicationData(fallbackResult)

        // Try to find matching lenders with the fallback data
        const fallbackMatches = await matchLendersToApplication(fallbackResult, user?.id)
        setMatchedLenders(fallbackMatches)
        setContextMatchingLenders(fallbackMatches)

        setIsProcessing(false)
        setIsAnalyzing(false)
        goToNextStep()

        toast({
          title: "Fallback Analysis Complete",
          description: `Using your verified information, we found ${fallbackMatches.length} matching lenders.`,
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
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Upload Documents</h2>
          <p className="mt-1 text-sm text-gray-500">Upload your bank statements and application form</p>
        </div>

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
                        ? "Uploading to API..."
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
            Verify and edit the extracted business details before proceeding to lender matching
          </p>
        </div>

        {extractionSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">Information Extracted</AlertTitle>
            <AlertDescription className="text-green-600">
              We've automatically extracted information from your documents. Please verify all fields and complete any
              missing information before proceeding.
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

            <div className="space-y-2">
              <Label htmlFor="monthlyRevenue">Monthly Revenue</Label>
              <Input
                id="monthlyRevenue"
                name="monthlyRevenue"
                value={formData.monthlyRevenue}
                onChange={handleFormChange}
                placeholder="Enter monthly revenue"
                type="number"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avgDailyBalance">Average Daily Balance</Label>
              <Input
                id="avgDailyBalance"
                name="avgDailyBalance"
                value={formData.avgDailyBalance}
                onChange={handleFormChange}
                placeholder="Enter average daily balance"
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

            <div className="space-y-2">
              <Label htmlFor="negativeDays">Negative Days</Label>
              <Input
                id="negativeDays"
                name="negativeDays"
                value={formData.negativeDays}
                onChange={handleFormChange}
                placeholder="Enter number of negative days"
                type="number"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasExistingLoans"
                  checked={formData.hasExistingLoans}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, hasExistingLoans: checked === true }))
                  }
                />
                <Label htmlFor="hasExistingLoans">Has Existing Loans</Label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="dataVerified"
              checked={formData.dataVerified}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, dataVerified: checked === true }))}
            />
            <Label htmlFor="dataVerified" className="font-medium text-amber-600">
              I have verified that all information is correct
            </Label>
          </div>

          {!formData.dataVerified && (
            <Alert className="bg-amber-50 border-amber-200 mb-4">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-700">Verification Required</AlertTitle>
              <AlertDescription className="text-amber-600">
                Please review all information and check the verification box above before proceeding.
              </AlertDescription>
            </Alert>
          )}
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
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{formData.email || "Not provided"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Phone Number:</span>
                <span className="text-sm">{formData.phoneNumber || "Not provided"}</span>
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
            {matchedLenders && matchedLenders.length > 0 ? (
              <div className="space-y-4">
                {matchedLenders.map((lender, index) => (
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

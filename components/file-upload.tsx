"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, FileText, FileSpreadsheet, AlertCircle, Search, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useApplication } from "@/context/application-context"
import { analyzeDocuments } from "@/lib/document-analyzer"
import { findMatchingLenders } from "@/lib/lender-matcher"
import { useAuth } from "@/context/auth-context"
import { extractBankText, analyzeBankTransactions, initPdfWorker } from "@/lib/bank-analyzer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface FileUploadProps {
  onAnalysisComplete: () => void
  onMatchingComplete?: () => void
}

export function FileUpload({ onAnalysisComplete, onMatchingComplete }: FileUploadProps) {
  const [bankStatements, setBankStatements] = useState<File[]>([])
  const [application, setApplication] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pdfWorkerError, setPdfWorkerError] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const applicationInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { setApplicationData, setIsAnalyzing, setMatchingLenders, setUploadedFiles } = useApplication()

  const { user } = useAuth()

  // Initialize PDF.js worker when component mounts
  useEffect(() => {
    try {
      initPdfWorker()
      setPdfWorkerError(false)
    } catch (error) {
      console.error("Failed to initialize PDF.js worker:", error)
      setPdfWorkerError(true)
    }
  }, [])

  const handleBankStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      setBankStatements((prev) => [...prev, ...filesArray])

      // Only attempt PDF analysis if we're not in an error state
      if (!pdfWorkerError) {
        try {
          // Process the first file for immediate analysis
          const file = filesArray[0]

          // Check if it's a PDF before attempting PDF-specific processing
          if (file.type === "application/pdf") {
            setIsUploading(true)
            setProgress(10)

            try {
              // Extract text from the bank statement
              const text = await extractBankText(file)
              setProgress(50)

              // Analyze the extracted text
              const analysis = analyzeBankTransactions(text)
              setProgress(90)

              console.log("Bank Analysis Result:", analysis)

              // Update application data with bank analysis results
              if (analysis.analysisSuccess) {
                setApplicationData((prev) => ({
                  ...prev,
                  avgMonthlyRevenue: analysis.avgMonthlyRevenue,
                  nsfs: analysis.nsfDays,
                  negativeDays: analysis.nsfDays, // Using NSF days as a proxy for negative days
                  hasExistingLoans: analysis.existingMcaCount > 0,
                  existingMcaCount: analysis.existingMcaCount,
                  mcaLenders: analysis.mcaLenders,
                  depositConsistency: analysis.depositConsistency * 100, // Convert to percentage
                  avgDailyBalance: analysis.avgDailyBalance,
                  totalDeposits: analysis.totalDeposits,
                }))

                toast({
                  title: "Bank Statement Analysis Complete",
                  description: `Detected ${analysis.existingMcaCount} MCA loans and ${formatCurrency(analysis.avgMonthlyRevenue)} average monthly revenue.`,
                })
              } else {
                toast({
                  title: "Analysis Completed with Issues",
                  description: analysis.errorMessage || "Some data couldn't be extracted properly.",
                  variant: "warning",
                })
              }
            } catch (pdfError) {
              console.error("PDF processing error:", pdfError)
              // Don't show an error toast here, just log it
              // We'll still keep the file in the list
            }
          } else {
            // For non-PDF files, just add them to the list without analysis
            console.log("Non-PDF file added:", file.name)
          }
        } catch (error) {
          console.error("Error analyzing bank statement:", error)
          // Don't show an error toast here, just log it
        } finally {
          setIsUploading(false)
          setProgress(0)
        }
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const handleApplicationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setApplication(e.target.files[0])
    }
  }

  const removeFile = (type: "bankStatement" | "application", index?: number) => {
    if (type === "bankStatement" && typeof index === "number") {
      setBankStatements((prev) => prev.filter((_, i) => i !== index))
    } else if (type === "application") {
      setApplication(null)
    }
  }

  const handleSubmit = async () => {
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

    setIsUploading(true)
    setIsAnalyzing(true)
    setError(null)
    setProgress(0)

    try {
      // Save the uploaded files to the context for later use in email attachments
      setUploadedFiles({
        bankStatements: [...bankStatements],
        application: application,
      })

      // Set up progress updates for document analysis
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 70) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 500)

      // Analyze the documents
      const result = await analyzeDocuments(application, bankStatements)

      clearInterval(progressInterval)
      setProgress(75)

      // Check if there were any extraction issues
      if ((result as any)._missingFields || (result as any)._requiresManualEntry) {
        console.log("Document analysis completed with some missing data. User will need to review and edit.")

        // We'll still proceed, but notify the user they'll need to review
        toast({
          title: "Analysis Completed with Warnings",
          description: "Some data couldn't be automatically extracted. Please review and edit the results.",
          variant: "warning",
        })
      }

      // Set the application data
      setApplicationData(result)

      // Now find matching lenders
      setIsMatching(true)

      // Set up progress updates for lender matching
      const matchingInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(matchingInterval)
            return prev
          }
          return prev + 5
        })
      }, 300)

      // Find matching lenders - pass the user ID to only match with the user's lenders
      const matches = await findMatchingLenders(result, user?.id)
      setMatchingLenders(matches)

      clearInterval(matchingInterval)
      setProgress(100)

      setTimeout(() => {
        setIsUploading(false)
        setIsMatching(false)
        setIsAnalyzing(false)
        onAnalysisComplete()

        // If we have matching lenders and a callback, call it
        if (matches.length > 0 && onMatchingComplete) {
          onMatchingComplete()
        }

        toast({
          title: "Analysis Complete",
          description: `Your documents have been processed. Found ${matches.length} matching lenders.`,
        })
      }, 500)
    } catch (error) {
      console.error("Error analyzing documents:", error)
      setIsUploading(false)
      setIsMatching(false)
      setIsAnalyzing(false)
      setProgress(0)

      const errorMessage =
        error instanceof Error ? error.message : "There was an error analyzing your documents. Please try again."
      setError(errorMessage)

      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const getFileIcon = (file: File) => {
    const fileType = file.type.toLowerCase()
    if (fileType.includes("pdf")) {
      return <FileText className="h-4 w-4 text-red-500" />
    } else if (
      fileType.includes("excel") ||
      fileType.includes("spreadsheet") ||
      fileType.includes("csv") ||
      fileType.includes("xls")
    ) {
      return <FileSpreadsheet className="h-4 w-4 text-green-500" />
    } else {
      return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Upload MCA Documents</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload bank statements and application documents to analyze and match with lenders
        </p>
      </div>

      {pdfWorkerError && (
        <Alert variant="warning" className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700">PDF Processing Limited</AlertTitle>
          <AlertDescription className="text-amber-600">
            PDF processing is currently limited. You can still upload PDF files, but automatic analysis may not work.
            The system will still process your documents when you click "Analyze & Find Matches".
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank Statements Upload */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Bank Statements</h3>
            <span className="text-sm text-gray-500">{bankStatements.length} file(s) selected</span>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleBankStatementUpload}
              className="hidden"
              multiple
              accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.txt"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <FileSpreadsheet className="h-10 w-10 text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-medium text-amber-600">Click to upload</span> or drag and drop
              </div>
              <p className="text-xs text-gray-500">PDF, CSV, Excel, Text, or Image files</p>
            </div>
          </div>

          {bankStatements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Uploaded Files:</h4>
              <ul className="space-y-2">
                {bankStatements.map((file, index) => (
                  <li key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(file)}
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile("bankStatement", index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Application Upload */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Application Document</h3>
            <span className="text-sm text-gray-500">{application ? "1 file selected" : "No file selected"}</span>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => applicationInputRef.current?.click()}
          >
            <input
              type="file"
              ref={applicationInputRef}
              onChange={handleApplicationUpload}
              className="hidden"
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <FileText className="h-10 w-10 text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-medium text-amber-600">Click to upload</span> or drag and drop
              </div>
              <p className="text-xs text-gray-500">PDF, Word, Text, or Image files</p>
            </div>
          </div>

          {application && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Uploaded File:</h4>
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                <div className="flex items-center space-x-2">
                  {getFileIcon(application)}
                  <span className="text-sm truncate max-w-[200px]">{application.name}</span>
                </div>
                <button onClick={() => removeFile("application")} className="text-red-500 hover:text-red-700 text-sm">
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{isMatching ? "Finding matching lenders..." : "Analyzing documents..."}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <div className="flex justify-center">
        <Button
          onClick={handleSubmit}
          disabled={isUploading || !application || bankStatements.length === 0}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {isUploading ? (
            isMatching ? (
              <>
                <Search className="mr-2 h-4 w-4 animate-pulse" />
                Finding Matches...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4 animate-pulse" />
                Analyzing...
              </>
            )
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Analyze & Find Matches
            </>
          )}
        </Button>
      </div>

      <div className="text-sm text-gray-500 flex items-start space-x-2 bg-amber-50 p-4 rounded-md">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Important:</p>
          <p>
            The system will analyze your documents and automatically match with suitable lenders based on the extracted
            data. If some information can't be extracted, you'll be able to edit the results manually before finalizing
            matches. All uploaded documents will be attached to emails sent to matched lenders.
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import {
  CreditCard,
  DollarSign,
  Calendar,
  MapPin,
  Briefcase,
  BadgeDollarSign,
  CircleCheck,
  CircleX,
  ArrowRight,
  Edit2,
  Save,
  X,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useApplication } from "@/context/application-context"
import { findMatchingLenders } from "@/lib/lender-matcher"
import { useToast } from "@/hooks/use-toast"

interface AnalysisResultsProps {
  onViewMatches: () => void
}

export function AnalysisResults({ onViewMatches }: AnalysisResultsProps) {
  const { applicationData, isAnalyzing, setApplicationData, setMatchingLenders } = useApplication()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<any>(null)
  const { toast } = useToast()

  // Check if there were extraction issues
  const hasExtractionIssues =
    applicationData && ((applicationData as any)._missingFields || (applicationData as any)._requiresManualEntry)

  // Auto-enable editing mode if there were extraction issues
  useEffect(() => {
    if (hasExtractionIssues && applicationData) {
      setIsEditing(true)
    }
  }, [hasExtractionIssues, applicationData])

  useEffect(() => {
    if (applicationData) {
      setEditedData({ ...applicationData })
    }
  }, [applicationData])

  useEffect(() => {
    const fetchMatchingLenders = async () => {
      if (applicationData) {
        const matches = await findMatchingLenders(applicationData)
        setMatchingLenders(matches)
      }
    }

    fetchMatchingLenders()
  }, [applicationData, setMatchingLenders])

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        <p className="mt-4 text-gray-600">Analyzing documents...</p>
      </div>
    )
  }

  if (!applicationData || !editedData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No analysis data available. Please upload and analyze documents first.</p>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatTimeInBusiness = (months: number) => {
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12

    if (years === 0) {
      return `${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`
    } else if (remainingMonths === 0) {
      return `${years} year${years !== 1 ? "s" : ""}`
    } else {
      return `${years} year${years !== 1 ? "s" : ""}, ${remainingMonths} month${remainingMonths !== 1 ? "s" : ""}`
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleNumberInputChange = (field: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value)
    setEditedData((prev: any) => ({
      ...prev,
      [field]: numValue,
    }))
  }

  const handleSaveChanges = async () => {
    // Remove any extraction issue flags
    const cleanedData = { ...editedData }
    delete cleanedData._missingFields
    delete cleanedData._requiresManualEntry
    delete cleanedData._error

    setApplicationData(cleanedData)
    setIsEditing(false)

    // Recalculate matching lenders with the updated data
    const matches = await findMatchingLenders(cleanedData)
    setMatchingLenders(matches)

    toast({
      title: "Changes Saved",
      description: "The application data has been updated.",
    })
  }

  const handleCancelEdit = () => {
    setEditedData({ ...applicationData })

    // Only allow canceling edit if there were no extraction issues
    if (!hasExtractionIssues) {
      setIsEditing(false)
    } else {
      toast({
        title: "Data Needs Review",
        description: "Please review and complete the missing information before proceeding.",
        variant: "warning",
      })
    }
  }

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
  ]

  // Get missing fields if any
  const missingFields = (applicationData as any)._missingFields || []

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
        <p className="mt-1 text-sm text-gray-500">Key metrics extracted from the uploaded documents</p>
      </div>

      {hasExtractionIssues && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Data Extraction Warning</AlertTitle>
          <AlertDescription>
            {(applicationData as any)._error
              ? (applicationData as any)._error
              : "Some data couldn't be automatically extracted from your documents. Please review and complete the information below."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        {isEditing ? (
          <div className="space-x-2">
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} className="bg-green-600 hover:bg-green-700 text-white">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        ) : (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Results
          </Button>
        )}
      </div>

      <Card>
        {isEditing && hasExtractionIssues && (
          <CardHeader className="bg-amber-50 border-b border-amber-100">
            <div className="text-sm text-amber-800">
              <p className="font-medium">Please review and complete the following information:</p>
              <ul className="list-disc list-inside mt-1">
                {missingFields.map((field: string) => (
                  <li key={field}>{field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}</li>
                ))}
                {missingFields.length === 0 && <li>All required fields need review</li>}
              </ul>
            </div>
          </CardHeader>
        )}
        <CardContent className="p-6">
          {isEditing ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Label htmlFor="businessName" className="text-lg font-medium">
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  value={editedData.businessName}
                  onChange={(e) => handleInputChange("businessName", e.target.value)}
                  className={`mt-1 text-center text-xl font-bold ${missingFields.includes("businessName") ? "border-amber-500" : ""}`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="creditScore" className="text-sm font-medium">
                      Credit Score
                    </Label>
                    <Input
                      id="creditScore"
                      type="number"
                      min="300"
                      max="850"
                      value={editedData.creditScore}
                      onChange={(e) => handleNumberInputChange("creditScore", e.target.value)}
                      className={`mt-1 ${missingFields.includes("creditScore") ? "border-amber-500" : ""}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="avgDailyBalance" className="text-sm font-medium">
                        Average Daily Balance
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Average daily balance is calculated by adding each day's ending balance and dividing by
                              the number of days in the statement period.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="avgDailyBalance"
                      type="number"
                      min="0"
                      value={editedData.avgDailyBalance}
                      onChange={(e) => handleNumberInputChange("avgDailyBalance", e.target.value)}
                      className={`mt-1 ${missingFields.includes("avgDailyBalance") ? "border-amber-500" : ""}`}
                    />
                  </div>

                  <div>
                    <Label htmlFor="avgMonthlyRevenue" className="text-sm font-medium">
                      Average Monthly Revenue
                    </Label>
                    <Input
                      id="avgMonthlyRevenue"
                      type="number"
                      min="0"
                      value={editedData.avgMonthlyRevenue}
                      onChange={(e) => handleNumberInputChange("avgMonthlyRevenue", e.target.value)}
                      className={`mt-1 ${missingFields.includes("avgMonthlyRevenue") ? "border-amber-500" : ""}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="hasExistingLoans"
                        checked={editedData.hasExistingLoans}
                        onCheckedChange={(checked) => handleInputChange("hasExistingLoans", checked)}
                      />
                      <Label htmlFor="hasExistingLoans" className="text-sm font-medium">
                        Has Existing Loans
                      </Label>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="hasPriorDefaults"
                        checked={editedData.hasPriorDefaults || false}
                        onCheckedChange={(checked) => handleInputChange("hasPriorDefaults", checked)}
                      />
                      <Label htmlFor="hasPriorDefaults" className="text-sm font-medium">
                        Has Prior Defaults
                      </Label>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="needsFirstPosition"
                        checked={editedData.needsFirstPosition || false}
                        onCheckedChange={(checked) => handleInputChange("needsFirstPosition", checked)}
                      />
                      <Label htmlFor="needsFirstPosition" className="text-sm font-medium">
                        Needs 1st Position Funding
                      </Label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="negativeDays" className="text-sm font-medium">
                      Negative Days
                    </Label>
                    <Input
                      id="negativeDays"
                      name="negativeDays"
                      type="number"
                      value={editedData.negativeDays || 0}
                      onChange={(e) => handleNumberInputChange("negativeDays", e.target.value)}
                      min={0}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="timeInBusiness" className="text-sm font-medium">
                      Time in Business (months)
                    </Label>
                    <Input
                      id="timeInBusiness"
                      type="number"
                      min="0"
                      value={editedData.timeInBusiness}
                      onChange={(e) => handleNumberInputChange("timeInBusiness", e.target.value)}
                      className={`mt-1 ${missingFields.includes("timeInBusiness") ? "border-amber-500" : ""}`}
                    />
                  </div>

                  <div>
                    <Label htmlFor="state" className="text-sm font-medium">
                      State
                    </Label>
                    <Select value={editedData.state} onValueChange={(value) => handleInputChange("state", value)}>
                      <SelectTrigger className={`mt-1 ${missingFields.includes("state") ? "border-amber-500" : ""}`}>
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

                  <div>
                    <Label htmlFor="industry" className="text-sm font-medium">
                      Industry
                    </Label>
                    <Select value={editedData.industry} onValueChange={(value) => handleInputChange("industry", value)}>
                      <SelectTrigger className={`mt-1 ${missingFields.includes("industry") ? "border-amber-500" : ""}`}>
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

                  <div>
                    <Label htmlFor="fundingRequested" className="text-sm font-medium">
                      Funding Requested
                    </Label>
                    <Input
                      id="fundingRequested"
                      type="number"
                      min="0"
                      value={editedData.fundingRequested}
                      onChange={(e) => handleNumberInputChange("fundingRequested", e.target.value)}
                      className={`mt-1 ${missingFields.includes("fundingRequested") ? "border-amber-500" : ""}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="fundingPurpose" className="text-sm font-medium">
                  Funding Purpose
                </Label>
                <Textarea
                  id="fundingPurpose"
                  value={editedData.fundingPurpose || ""}
                  onChange={(e) => handleInputChange("fundingPurpose", e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{applicationData.businessName}</h3>
                <p className="text-sm text-gray-500">Application Analysis</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="flex items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Average Daily Balance</p>
                        <p className="text-lg font-semibold">{formatCurrency(applicationData.avgDailyBalance)}</p>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-400 ml-2" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Average daily balance is calculated by adding each day's ending balance and dividing by
                              the number of days in the statement period.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <DollarSign className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Average Monthly Revenue</p>
                      <p className="text-lg font-semibold">{formatCurrency(applicationData.avgMonthlyRevenue)}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    {applicationData.hasExistingLoans ? (
                      <CircleCheck className="h-5 w-5 text-amber-600 mt-0.5" />
                    ) : (
                      <CircleX className="h-5 w-5 text-gray-600 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-500">Existing Loans</p>
                      <p className="text-lg font-semibold">{applicationData.hasExistingLoans ? "Yes" : "No"}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    {applicationData.hasPriorDefaults ? (
                      <CircleCheck className="h-5 w-5 text-amber-600 mt-0.5" />
                    ) : (
                      <CircleX className="h-5 w-5 text-gray-600 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-500">Prior Defaults</p>
                      <p className="text-lg font-semibold">{applicationData.hasPriorDefaults ? "Yes" : "No"}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    {applicationData.needsFirstPosition ? (
                      <CircleCheck className="h-5 w-5 text-amber-600 mt-0.5" />
                    ) : (
                      <CircleX className="h-5 w-5 text-gray-600 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-500">Needs 1st Position</p>
                      <p className="text-lg font-semibold">{applicationData.needsFirstPosition ? "Yes" : "No"}</p>
                    </div>
                  </div>

                  {applicationData.negativeDays !== undefined && (
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Negative Days</p>
                        <p className="text-lg font-semibold">{applicationData.negativeDays}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Time in Business</p>
                      <p className="text-lg font-semibold">{formatTimeInBusiness(applicationData.timeInBusiness)}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">State</p>
                      <p className="text-lg font-semibold">{applicationData.state}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Briefcase className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Industry</p>
                      <p className="text-lg font-semibold">{applicationData.industry}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <BadgeDollarSign className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Funding Requested</p>
                      <p className="text-lg font-semibold">{formatCurrency(applicationData.fundingRequested)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {applicationData.fundingPurpose && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Funding Purpose</h4>
                  <p className="text-gray-700">{applicationData.fundingPurpose}</p>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Assessment Summary</h4>
                <p className="text-gray-700">
                  {applicationData.businessName} is a {applicationData.industry.toLowerCase()} business operating in{" "}
                  {applicationData.state} for {formatTimeInBusiness(applicationData.timeInBusiness)}. With an average
                  monthly revenue of {formatCurrency(applicationData.avgMonthlyRevenue)} and a credit score of{" "}
                  {applicationData.creditScore}, the business is seeking{" "}
                  {formatCurrency(applicationData.fundingRequested)} in funding
                  {applicationData.fundingPurpose ? ` for ${applicationData.fundingPurpose.toLowerCase()}` : ""}.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center space-y-4">
        {isEditing && (
          <div className="w-full max-w-md bg-amber-50 border border-amber-200 rounded-md p-4 mb-2">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Please save your changes</p>
                <p className="text-sm text-amber-700">You need to save your changes before viewing matching lenders.</p>
              </div>
            </div>
            <div className="mt-3 flex justify-center">
              <Button
                onClick={handleSaveChanges}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          {isEditing ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Save Required",
                        description: "Please save your changes before viewing matching lenders.",
                        variant: "warning",
                      })
                    }}
                    className="bg-gray-400 hover:bg-gray-400 text-white px-6 py-2 cursor-not-allowed"
                  >
                    View Matching Lenders
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-amber-50 border border-amber-200 p-2">
                  <p className="text-amber-800">Please save your changes first</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={onViewMatches}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2"
              disabled={hasExtractionIssues}
            >
              View Matching Lenders
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

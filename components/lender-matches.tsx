"use client"

import { useState, useEffect } from "react"
import { Mail, CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApplication } from "@/context/application-context"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { matchLendersToApplication } from "@/lib/lender-matcher"
import { useAuth } from "@/context/auth-context"
import { submitToLender } from "@/lib/email-sender"

interface LenderMatch {
  id: string
  name: string
  email: string
  description?: string
  match_score: number
  match_reasons: string[]
  mismatch_reasons: string[]
}

interface Application {
  id: string
  business_name: string
  credit_score: number
  avg_monthly_revenue: number
  avg_daily_balance: number
  time_in_business: number
  funding_requested: number
  has_existing_loans: boolean
  state: string
  industry: string
  // Add any other fields that might be needed
}

interface LenderMatchesProps {
  application: Application
  onBack?: () => void
}

export function LenderMatches({ application, onBack }: LenderMatchesProps) {
  const [matches, setMatches] = useState<LenderMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    applicationData,
    allLenders,
    matchingLenders,
    isAnalyzing,
    networkLenderIds,
    toggleLenderNetwork,
    uploadedFiles,
  } = useApplication()

  const [selectedLender, setSelectedLender] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<"matching" | "all" | "network">("matching")
  const [showOnlyNetwork, setShowOnlyNetwork] = useState(false)

  useEffect(() => {
    if (applicationData) {
      fetchMatches()
    }
  }, [applicationData])

  const fetchMatches = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Pass the user ID to match only with the user's lenders
      const matchedLenders = await matchLendersToApplication(applicationData, user?.id)
      setMatches(matchedLenders)
    } catch (error) {
      console.error("Error fetching lender matches:", error)
      setError("Failed to fetch lender matches. Please try again.")
      toast({
        title: "Error",
        description: "Failed to fetch lender matches.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCollapsible = (id: string) => {
    setOpenCollapsibles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getMatchColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 60) return "bg-amber-500"
    if (score >= 40) return "bg-orange-500"
    return "bg-red-500"
  }

  const getMatchText = (score: number) => {
    if (score >= 80) return "Excellent Match"
    if (score >= 60) return "Good Match"
    if (score >= 40) return "Fair Match"
    return "Poor Match"
  }

  const getMatchBadgeVariant = (score: number) => {
    if (score >= 80) return "success"
    if (score >= 60) return "warning"
    if (score >= 40) return "warning"
    return "destructive"
  }

  const handleSubmit = async (lender: any) => {
    setIsSubmitting(true)
    try {
      if (!applicationData) {
        throw new Error("No application data available")
      }

      // Pass the uploaded files to the email sender
      const success = await submitToLender(lender, applicationData, uploadedFiles)

      if (success) {
        toast({
          title: "Application Submitted",
          description: `Application submitted to ${lender.name}.`,
        })
      } else {
        toast({
          title: "Error",
          description: `Failed to submit application to ${lender.name}.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error submitting to lender:", error)
      toast({
        title: "Error",
        description: `Failed to submit application. ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate total number of attachments
  const getTotalAttachments = () => {
    if (!uploadedFiles) return 0
    return (uploadedFiles.application ? 1 : 0) + uploadedFiles.bankStatements.length
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Finding Lender Matches</CardTitle>
          <CardDescription>Analyzing application data to find suitable lenders...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Finding Matches</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchMatches} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Matching Lenders Found</CardTitle>
          <CardDescription>
            We couldn't find any lenders that match this application. Try adjusting your criteria or adding more lenders
            to your database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchMatches} variant="outline">
            Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lender Matches</CardTitle>
        <CardDescription>
          Found {matches.length} potential lender {matches.length === 1 ? "match" : "matches"} for{" "}
          {applicationData.businessName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Matches</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="space-y-4">
              {matches.map((match) => (
                <Collapsible
                  key={match.id}
                  open={openCollapsibles[match.id]}
                  onOpenChange={() => toggleCollapsible(match.id)}
                  className="border rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{match.name}</h3>
                          <Badge variant={getMatchBadgeVariant(match.match_score) as any}>
                            {getMatchText(match.match_score)}
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Mail className="h-3 w-3 mr-1" />
                          {match.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium">{match.match_score}% Match</span>
                        <div className="w-24 h-2 mt-1">
                          <Progress value={match.match_score} className={getMatchColor(match.match_score)} />
                        </div>
                      </div>

                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {openCollapsibles[match.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="p-4 border-t">
                      {match.description && <p className="text-sm text-gray-600 mb-4">{match.description}</p>}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Matching Criteria
                          </h4>
                          <ul className="text-sm space-y-1">
                            {match.match_reasons.map((reason, index) => (
                              <li key={index} className="text-gray-600">
                                • {reason}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {match.mismatch_reasons.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center">
                              <XCircle className="h-4 w-4 mr-1" /> Mismatched Criteria
                            </h4>
                            <ul className="text-sm space-y-1">
                              {match.mismatch_reasons.map((reason, index) => (
                                <li key={index} className="text-gray-600">
                                  • {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t flex justify-end">
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 flex items-center"
                          onClick={() => handleSubmit(match)}
                          disabled={isSubmitting}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Submit Application
                          {getTotalAttachments() > 0 && (
                            <span className="ml-2 flex items-center text-xs bg-amber-700 px-1.5 py-0.5 rounded-full">
                              <Paperclip className="h-3 w-3 mr-1" />
                              {getTotalAttachments()}
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

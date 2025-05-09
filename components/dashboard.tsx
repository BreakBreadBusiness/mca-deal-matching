"use client"

import { useState } from "react"
import { FileUpload } from "@/components/file-upload"
import { AnalysisResults } from "@/components/analysis-results"
import { LenderMatches } from "@/components/lender-matches"
import { useApplication } from "@/context/application-context"

export function Dashboard() {
  const [currentStep, setCurrentStep] = useState<"upload" | "analysis" | "matches">("upload")
  const { applicationData, matchingLenders } = useApplication()

  const handleAnalysisComplete = () => {
    setCurrentStep("analysis")
  }

  const handleViewMatches = () => {
    setCurrentStep("matches")
  }

  const handleMatchingComplete = () => {
    // If we have matching lenders, go directly to matches view
    if (matchingLenders && matchingLenders.length > 0) {
      setCurrentStep("matches")
    } else {
      setCurrentStep("analysis")
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {currentStep === "upload" && (
        <FileUpload onAnalysisComplete={handleAnalysisComplete} onMatchingComplete={handleMatchingComplete} />
      )}
      {currentStep === "analysis" && applicationData && <AnalysisResults onViewMatches={handleViewMatches} />}
      {currentStep === "matches" && applicationData && <LenderMatches onBack={() => setCurrentStep("analysis")} />}
    </div>
  )
}

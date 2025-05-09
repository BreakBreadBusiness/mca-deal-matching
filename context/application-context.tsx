"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface ApplicationContextType {
  applicationData: any
  setApplicationData: (data: any) => void
  isAnalyzing: boolean
  setIsAnalyzing: (isAnalyzing: boolean) => void
  matchingLenders: any[]
  setMatchingLenders: (lenders: any[]) => void
  allLenders: any[]
  setAllLenders: (lenders: any[]) => void
  networkLenderIds: string[]
  setNetworkLenderIds: (ids: string[]) => void
  toggleLenderNetwork: (id: string) => void
  uploadedFiles: {
    bankStatements: File[]
    application: File | null
  }
  setUploadedFiles: (files: { bankStatements: File[]; application: File | null }) => void
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined)

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applicationData, setApplicationData] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [matchingLenders, setMatchingLenders] = useState<any[]>([])
  const [allLenders, setAllLenders] = useState<any[]>([])
  const [networkLenderIds, setNetworkLenderIds] = useState<string[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<{
    bankStatements: File[]
    application: File | null
  }>({
    bankStatements: [],
    application: null,
  })

  const toggleLenderNetwork = (id: string) => {
    setNetworkLenderIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((lenderId) => lenderId !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  return (
    <ApplicationContext.Provider
      value={{
        applicationData,
        setApplicationData,
        isAnalyzing,
        setIsAnalyzing,
        matchingLenders,
        setMatchingLenders,
        allLenders,
        setAllLenders,
        networkLenderIds,
        setNetworkLenderIds,
        toggleLenderNetwork,
        uploadedFiles,
        setUploadedFiles,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  )
}

export function useApplication() {
  const context = useContext(ApplicationContext)
  if (context === undefined) {
    throw new Error("useApplication must be used within an ApplicationProvider")
  }
  return context
}

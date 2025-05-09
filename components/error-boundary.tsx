"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("Global error caught:", error)
      setError(error.error || new Error("An unknown error occurred"))
      setHasError(true)
    }

    window.addEventListener("error", handleError)

    return () => {
      window.removeEventListener("error", handleError)
    }
  }, [])

  if (hasError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Something went wrong. Please try refreshing the page.
            {error && <div className="mt-2 text-xs opacity-70">{error.message}</div>}
          </AlertDescription>
        </Alert>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
          <Button onClick={() => (window.location.href = "/login")} variant="default">
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

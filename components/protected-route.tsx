"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  children: React.ReactNode
  adminRequired?: boolean
}

export function ProtectedRoute({ children, adminRequired = false }: ProtectedRouteProps) {
  const { user, isLoading, authError, setIsLoading } = useAuth()
  const router = useRouter()
  const [showTimeout, setShowTimeout] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [initialRender, setInitialRender] = useState(true)
  // Add a new state for tracking timeout
  const [loadingTimeout, setLoadingTimeout] = useState(false)

  // Mark initial render complete after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialRender(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Update the timeout effect to handle long loading times
  useEffect(() => {
    if (!isLoading) return

    const timeoutId = setTimeout(() => {
      setShowTimeout(true)
    }, 5000) // 5 seconds

    const criticalTimeoutId = setTimeout(() => {
      setLoadingTimeout(true)
      setIsLoading(false) // Force loading to end after critical timeout
    }, 15000) // 15 seconds - critical timeout

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(criticalTimeoutId)
    }
  }, [isLoading, setIsLoading])

  // Handle redirects
  useEffect(() => {
    if (initialRender || isLoading || redirecting) return

    if (!user) {
      setRedirecting(true)
      router.push("/login")
    } else if (user.status !== "approved") {
      setRedirecting(true)
      router.push("/pending-approval")
    } else if (adminRequired && !user.isAdmin) {
      setRedirecting(true)
      router.push("/") // Redirect to home if admin access is required but user is not admin
    }
  }, [user, isLoading, router, adminRequired, redirecting, initialRender])

  // Show a lightweight loading UI during initial render
  if (initialRender) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mb-4"></div>
        <p className="text-gray-600 text-center">Loading your account...</p>

        {showTimeout && (
          <div className="mt-8 max-w-md">
            <Alert variant="warning" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>This is taking longer than expected. You can try refreshing the page.</AlertDescription>
            </Alert>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full mt-2">
              Refresh Page
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Add a condition to handle loading timeout in the render logic
  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Loading took too long. Please try refreshing the page or logging in again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
          Refresh Page
        </Button>
        <Button onClick={() => router.push("/login")} variant="default" className="mt-2">
          Go to Login
        </Button>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{authError}</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
          Refresh Page
        </Button>
        <Button onClick={() => router.push("/login")} variant="default" className="mt-2">
          Go to Login
        </Button>
      </div>
    )
  }

  if (!user || user.status !== "approved" || (adminRequired && !user.isAdmin)) {
    return null
  }

  return <>{children}</>
}
